# Masking Server Responses Before They Reach the Browser (Next.js Server Actions)

A pattern for making sure that when a Server Action or Server Component talks to a backend
API, **only a safe, serializable, UI-ready shape** ever crosses the boundary into the
browser — never a raw error object, stack trace, request config, auth token, or anything
else the backend/HTTP client happened to attach.

## Why this matters

- **Security** — a raw Axios/fetch error object can carry the full request config: the
  backend base URL, headers, and (if you're not careful) an `Authorization: Bearer <token>`
  header. If that object is ever serialized back to the client, it leaks straight into the
  browser's network tab / React state / error boundaries.
- **Next.js Server Action constraints** — a Server Action's return value must be
  React-serializable. If a Server Action *throws* an `Error` instead of returning one, Next
  replaces it in production with a generic message plus an opaque `digest` id (by design,
  so server internals aren't leaked) — which means your UI loses the actual error message
  ("Insufficient stock", "Duplicate SKU", etc.) and can only show "Something went wrong."
  The fix is structural: **never let a Server Action throw; always catch and return a
  normalized result object instead.**
- **Consistency** — every feature's errors should resolve to the same `{ title, message }`
  shape, regardless of whether the failure was a 401, a 422 validation error, or a dropped
  connection, so one generic error-toast/banner component can render all of them.

## Architecture overview

```
Backend API
   │  raw HTTP response / raw error (axios error object)
   ▼
Provider layer (class extending a BaseProvider)
   - unwraps success responses to plain data (response.data)
   - on failure, RE-THROWS the raw error unchanged (this layer is not the masking layer)
   │
   ▼
Server Action ("use server", one per read/write operation)
   - try { calls provider; returns { success: true, data } }
   - catch (error) { normalizes error -> returns { success: false, error, statusCode } }
   - NEVER throws — always returns a discriminated-union result object
   │  (only ever a plain string message + optional numeric status code — never an Error
   │   instance, never axios internals)
   ▼
Client hook (wraps the Server Action call)
   - unwraps the result
   - success -> use `data`
   - failure -> surface `error` via toast / form state / error boundary
   │
   ▼
Component (renders data, or the normalized error message)
```

Two independent layers do the masking, and both matter:

1. **Error normalization** — reducing "whatever the HTTP client threw" to a plain,
   serializable `{ title, message }` (or similar) with no internals attached.
2. **Return-not-throw discipline** — every Server Action always resolves successfully at
   the JS level (no unhandled rejection reaches the RSC boundary); *failure* is represented
   as data (`{ success: false, ... }`), not as a thrown exception.

Skipping either one re-opens the leak: normalizing the error but still `throw`-ing it still
hits Next's digest-masking (losing your nice message); returning it without normalizing
still risks serializing raw HTTP-client internals.

## 1. Provider layer: unwrap on success, don't normalize on failure

Keep one thin base class that all API-calling classes extend. It should unwrap the HTTP
client's response envelope on success, but it does **not** need to normalize errors — that
happens one layer up, in the Server Action, where you have the context (which operation
failed, what fallback message makes sense) to do it well.

```ts
// lib/api/base-provider.ts
export class BaseProvider {
    protected client: AxiosInstance;

    protected async get<TResponse = unknown>(options: GetRequestOptions): Promise<TResponse> {
        const response = await this.client.get(options.endpoint, { params: options.params });
        return response.data; // unwrap the envelope; nothing about errors happens here
    }

    // post / put / patch / delete follow the same "unwrap and return, or let it throw" shape
}
```

A response interceptor is a fine place for *cross-cutting* concerns that are unrelated to
what gets sent to the browser — e.g. redirecting to a login page on `401`, or logging the
failed request server-side for observability — but it should still end with
`return Promise.reject(error)` so the raw error keeps propagating up to the Server Action,
which is the layer responsible for shaping what the client actually sees.

## 2. A single error-normalization utility

One function, used everywhere, that takes "any thrown value" and returns a plain,
serializable shape:

```ts
// lib/utils/error.ts
export interface ErrorMessage {
    title: string;
    message: string;
}

const errorStatusMap: Record<number, ErrorMessage> = {
    400: { title: "Bad Request", message: "The request was invalid." },
    401: { title: "Unauthorized", message: "Your session has expired. Please log in again." },
    403: { title: "Forbidden", message: "You don't have permission to do this." },
    404: { title: "Not Found", message: "The requested resource could not be found." },
    409: { title: "Conflict", message: "This resource already exists or was modified." },
    422: { title: "Validation Error", message: "Some fields are invalid." },
    429: { title: "Too Many Requests", message: "Please slow down and try again shortly." },
    500: { title: "Server Error", message: "Something went wrong on our end." },
};

export function extractErrorMessage(error: unknown, fallbackMessage?: string): ErrorMessage {
    if (isAxiosError(error)) {
        const errorMessage = errorStatusMap[error.response?.status ?? 0] ?? {
            title: "Error",
            message: fallbackMessage ?? "An unexpected error occurred.",
        };
        // Allow a backend-provided message string through — it's just text, not an object.
        if (error.response?.data?.message) {
            errorMessage.message = error.response.data.message;
        }
        return { ...errorMessage };
    }
    return { title: "Error", message: fallbackMessage ?? "An unexpected error occurred." };
}
```

Rules that make this safe:

- It only ever reads `error.response.status` and `error.response.data.message` — plain
  primitives — off the original error. It never spreads or forwards the error object, its
  `.stack`, or its `.config` (which is exactly where the request URL/headers/token live).
- It always returns the same two-field shape, so callers don't need to know what kind of
  error occurred to render it.
- Unknown/non-HTTP errors (network failures, thrown strings, programming errors) fall back
  to one generic message instead of being serialized as-is.

## 3. A discriminated-union result type for every Server Action

```ts
// types/common.ts
export type ServerActionResult<T> =
    | { success: true; data: T }
    | { success: false; error: string; statusCode?: number };

export type ServerActionDeleteResult =
    | { success: true }
    | { success: false; error: string; statusCode?: number };
```

The failure branch carries **only a string and an optional number** — nothing that could
fail to serialize, and nothing that leaks internals. This type is the contract every
Server Action promises to fulfill, success or failure.

## 4. Server Actions: try/catch, never throw

Every fetch/mutation Server Action follows the same shape. This is the layer where "return,
don't throw" is enforced:

```ts
// features/product/action.ts
"use server";

function toErrorResult(error: unknown): ServerActionResult<never> {
    const { message } = extractErrorMessage(error);
    return {
        success: false,
        error: message,
        statusCode: isAxiosError(error) ? error.response?.status : undefined,
    };
}

export async function fetchProductListAction(
    params?: Record<string, string>,
): Promise<ServerActionResult<MetaResponse<Product>>> {
    try {
        const response = await productProvider.fetchProducts(params);
        return { success: true, data: response };
    } catch (error) {
        return toErrorResult(error);
    }
}

export async function deleteProductAction(id: string): Promise<ServerActionDeleteResult> {
    try {
        await productProvider.deleteProduct(id);
        revalidatePath("/products"); // refresh any Server Component reading this route
        return { success: true };
    } catch (error) {
        return toErrorResult(error);
    }
}
```

Checklist for every Server Action:

- [ ] Wrap the provider call in `try/catch`.
- [ ] On success, return `{ success: true, data }` (or `{ success: true }` for deletes).
- [ ] On failure, return `toErrorResult(error)` — never `throw error`, never `throw new Error(...)`.
- [ ] Call `revalidatePath(...)` for every route the mutation affects, inside the `try`
      block, before returning success.
- [ ] Never return the raw provider/axios error, and never spread `error` into the return
      value.

> **Optional optimization, not required for correctness:** if a Server Action's payload is
> large (e.g. big paginated lists) and you want to shrink what crosses the RSC wire, you can
> serialize the `ServerActionResult` through a compact binary codec (e.g. msgpack + gzip)
> instead of relying on Next's default JSON-ish RSC serialization, and decode it on the
> client hook. This is purely a payload-size optimization layered on top of the pattern
> above — implement the plain `{ success, data | error }` object first, and only add binary
> packing later if you actually measure a payload-size problem.

## 5. Client hooks: unwrap the result, surface the error

One generic "query" hook and one generic "mutation" hook, each used by every feature,
so error handling is written once instead of per-component.

```ts
// hooks/use-server-query.ts
"use client";

class ServerActionError extends Error {
    constructor(message: string, public statusCode?: number) {
        super(message);
    }
}

export function useServerQuery<T>(options: { queryKey: unknown[]; action: () => Promise<ServerActionResult<T>> }) {
    return useQuery({
        queryKey: options.queryKey,
        queryFn: async () => {
            const result = await options.action();
            if (!result.success) {
                throw new ServerActionError(result.error, result.statusCode);
            }
            return result.data;
        },
    });
    // `error` on the returned query object is now a typed ServerActionError with a clean
    // message — components render `query.error?.message` directly, no branching on shape.
}
```

```ts
// hooks/use-server-mutation.ts
"use client";

export function useServerMutation<TResult, TVariables>(options: {
    mutationFn: (variables: TVariables) => Promise<ServerActionResult<TResult>>;
    onSuccess?: (data: TResult, variables: TVariables) => void;
    onError?: (error: { message: string; statusCode?: number }, variables: TVariables) => void;
}) {
    const [isPending, startTransition] = useTransition();

    const mutation = useMutation({
        mutationFn: options.mutationFn,
        onSuccess: (result, variables) => {
            if (result.success) {
                options.onSuccess?.(result.data, variables);
            } else {
                options.onError?.({ message: result.error, statusCode: result.statusCode }, variables);
            }
        },
    });

    return {
        mutate: (variables: TVariables) => startTransition(() => mutation.mutate(variables)),
        isPending: isPending || mutation.isPending,
    };
}
```

Key points:

- The hook is the single place that decides what "success" vs "failure" means for the UI —
  components never inspect `result.success` themselves.
- `useTransition` wraps the mutation call so a `isPending` flag is available for a loading
  state without manual `useState` bookkeeping.
- Only genuinely generic failures (e.g. the network dropped) should auto-toast from inside
  the hook; ordinary business errors (validation, conflicts) should be handed to the caller
  (`onError` callback, or `query.error`) so each screen can decide how to display them (a
  toast, a banner, an inline field error, etc).

## 6. Per-feature `queries.ts` / `mutations.ts`: the public surface

Keep one thin file per concern that wires a feature's Server Actions into the generic
hooks, so components never call `useServerQuery`/`useServerMutation` directly:

```ts
// features/product/queries.ts
"use client";

export function useProductListQuery(params?: Record<string, string>) {
    const query = useServerQuery<MetaResponse<Product>>({
        queryKey: ["products", params],
        action: () => fetchProductListAction(params),
    });
    return { ...query, products: query.data?.data ?? [], meta: query.data?.meta ?? null };
}
```

```ts
// features/product/mutations.ts
"use client";

export function useProductDeleteMutation() {
    const queryClient = useQueryClient();
    return useServerMutation<null, string>({
        mutationFn: (productId) => deleteProductAction(productId),
        onSuccess: (_data, productId) => {
            // The Server Action already revalidated the SSR route; this only refreshes
            // whatever client-side cache this hook itself is using.
            queryClient.invalidateQueries({ queryKey: ["products"] });
            queryClient.invalidateQueries({ queryKey: ["product", productId] });
        },
    });
}
```

## 7. Server Components: skip the wrapper entirely, catch locally

When a Server Component fetches data for its own render (SSR, no client interactivity
needed to trigger the fetch), call the **provider directly** — there's no client/server
boundary to cross, so none of the Server-Action masking machinery is needed. Just catch
locally and reduce to a boolean flag:

```tsx
// app/products/page.tsx
export default async function ProductsPage({ searchParams }: Props) {
    const params = parseProductListSearchParams(await searchParams);

    let response: MetaResponse<Product> | null = null;
    let isError = false;
    try {
        response = await productProvider.fetchProducts(params);
    } catch (error) {
        isError = true;
        logger.error("error fetching products", { error }); // server-side only
    }

    return (
        <ListProductScreen
            products={response?.data ?? []}
            meta={response?.meta ?? DEFAULT_META}
            isError={isError}
        />
    );
}
```

The client component only ever receives `products`, `meta`, and a boolean `isError` — never
the caught error itself.

## 8. Don't forget server-side logs need their own masking too

This is a separate concern from client-facing masking, but easy to miss: if you log the
raw error object server-side for observability (`logger.error("...", { error })`), make sure
your logger redacts known-sensitive keys (`password`, `token`, `authorization`, `ssn`, etc.)
before writing them to whatever log sink you use. Client-facing masking (this doc) stops
secrets from reaching the browser; log-redaction stops them from reaching your log
aggregator. You need both, and they're independent — normalizing an error for the client
does not automatically make it safe to `console.log`/write to a log file verbatim.

## Checklist for implementing a new feature with this pattern

1. Provider method: call the HTTP client, unwrap `.data` on success, let failures propagate
   (don't catch inside the provider).
2. Reuse one shared `extractErrorMessage(error)` utility — don't write a new one per
   feature.
3. Reuse one shared `ServerActionResult<T>` / `ServerActionDeleteResult` type.
4. Server Action: `try { return { success: true, data } } catch (error) { return
   toErrorResult(error) }` — audit for any `throw` inside a Server Action; there should be
   none.
5. Call `revalidatePath(...)` for every affected route inside the `try`, before returning.
6. Client hook: unwrap the result once (generic `useServerQuery`/`useServerMutation`);
   never let a component branch on `result.success` directly.
7. Server Component pages that fetch their own data: call the provider directly, catch
   locally, pass down `data ?? []` / `meta ?? DEFAULT_META` / `isError` — never the raw
   error.
8. Confirm server-side logging of the raw error goes through a redaction step separate from
   what's returned to the client.

## Anti-patterns to avoid

- ❌ `throw error` (or `throw new Error(...)`) from inside a `"use server"` action — this
  hands control to Next's production digest-masking and you lose your real error message.
- ❌ Returning the raw axios/fetch error object (or spreading it) from a Server Action —
  even if it doesn't crash, it risks serializing request headers/tokens to the client.
- ❌ A component doing `if (result.success) {...} else {...}` itself instead of going
  through the shared hook — it duplicates error-shape knowledge in every screen and makes
  it easy to accidentally render `error.message` from a raw `Error` object somewhere.
- ❌ Skipping `revalidatePath` after a successful mutation — the client cache invalidation
  in `mutations.ts` only cleans up client-side query caches; the SSR route needs its own
  revalidation call inside the Server Action.
