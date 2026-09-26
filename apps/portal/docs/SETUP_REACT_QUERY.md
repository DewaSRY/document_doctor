# TanStack Query — As Implemented

## Who this doc is for

You should be comfortable with React hooks, Next.js Server/Client Components,
and this app's existing Axios layer (`SETUP_API_PROVIDER.md`). You don't need
prior experience with TanStack Query — [Section 0](#section-0--background-primer)
covers the parts of it that aren't obvious from the API surface.

This doc is verified against the source in this repo, not the intended
design — every real claim below cites a `file:line`. Where the code diverges
from what you'd expect (a TODO left in, an unused branch, a shape that isn't
followed everywhere), that's called out explicitly rather than smoothed over.
Read the callouts before copying a pattern.

## Section 0 — Background Primer

| Approach                | Direction                  | Transport                                              | Typical use in this app                                                       |
| ----------------------- | -------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Server Component fetch  | server → client (one-shot) | direct call, no browser round-trip                     | Initial page render — still how every page gets its first data                |
| TanStack Query          | client ⇄ server, cached    | the existing Axios instance (`lib/api/base-client.ts`) | Refetch, cache-sharing, and mutations _after_ the page has loaded             |
| Plain `useEffect` fetch | client → server, uncached  | Axios/fetch                                            | Not used anywhere in this app — TanStack Query replaces this pattern entirely |

TanStack Query isn't a transport (it doesn't talk to the network itself) —
it's a cache and subscription layer _in front of_ whatever fetch function you
give it. In this app that fetch function is always an existing `accountClient`
/ `authClient` method (`feature/account/client.ts:52`, `feature/auth/client.ts:29`),
unchanged by adopting the library.

**Gotchas that aren't obvious from the API surface:**

1. **`staleTime` defaults to `0`.** Left unset, TanStack Query treats every
   query as stale the instant it mounts and fires a background refetch
   immediately — including a query hydrated from a Server Component prefetch.
   This is why `lib/query/query-client.ts:23` sets `staleTime: 30_000`
   explicitly; see [Section 2](#section-2--the-query-client-libqueryquery-clientts).
2. **A `useQuery` cache entry is identified by its `queryKey`, not by which
   component called it.** Two components calling `useQuery` with the same key
   array share one in-flight request and one cached result; a key built even
   slightly differently (different param order, an extra field) is a
   _different_ cache entry. This is why the key is a shared factory function
   (`accountKeys.list`) instead of an inline array at each call site — see
   [Section 4](#section-4--query-keys--hooks-per-feature).
3. **`useMutation` has no cache entry of its own** — it's fire-and-forget
   from the cache's perspective. Nothing here calls `queryClient.invalidateQueries`
   after login/register; see the [rough edge](#rough-edges) in Section 4.

## Section 1 — Architecture at a Glance

The composition root is `app/[locale]/layout.tsx:62`, where `QueryProvider`
wraps `children` inside `NextIntlClientProvider`. The root layout itself
implements none of the query logic — it only wires the provider into the
tree once, above every route.

| Concern                                          | Owner (file)                                           | Analogy                                                  |
| ------------------------------------------------ | ------------------------------------------------------ | -------------------------------------------------------- |
| `QueryClient` defaults (staleTime, retry policy) | `lib/query/query-client.ts`                            | The oven's factory-set temperature/timer defaults        |
| Mounting the client + devtools in the React tree | `providers/query-provider.tsx`                         | Plugging the oven in                                     |
| Query keys + fetch/hook per feature              | `feature/<name>/hooks/query.ts`                        | The recipe card — what to fetch and how to name the dish |
| Server-side prefetch + hydration handoff         | the owning `page.tsx`                                  | Preheating before the guest (the client) arrives         |
| Rendering loading/error/data states              | the Client Component (e.g. `account-list.tsx`)         | Plating the dish                                         |
| The actual HTTP call                             | `accountClient` / `authClient` (`feature/*/client.ts`) | The grocery run — untouched by any of the above          |

It's split this way so the fetch function and its cache key can be reused
identically on the server (`prefetchQuery`) and the client (`useQuery`)
without duplicating either — see [Section 4](#section-4--query-keys--hooks-per-feature)
for the consequence of getting the key factory wrong.

## Section 2 — The query client (`lib/query/query-client.ts`)

**Problem it solves:** without shared defaults, every `useQuery` call across
the app would need its own `staleTime`/`retry` config, and server renders vs.
browser renders would need separate `QueryClient` construction logic hand-rolled
per call site.

**How it's implemented.** `createQueryClient` (`lib/query/query-client.ts:19`)
returns a fresh `QueryClient` with:

```ts
// lib/query/query-client.ts:19-35
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: shouldRetryQuery,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
```

`shouldRetryQuery` (`lib/query/query-client.ts:10-17`) is a function, not a
boolean, because failures aren't uniform:

| Field                      | What actually happens                                                                                                                                                                                 |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `staleTime: 30_000`        | Hydrated/fetched data gets a 30s grace period before a mount/refocus triggers a silent background refetch                                                                                             |
| `gcTime: 5 * 60_000`       | Library default, made explicit — how long an _unused_ query stays cached before eviction                                                                                                              |
| `retry` (queries)          | Retries network errors and 5xx up to `MAX_QUERY_RETRIES` (2) times; never retries 4xx — a 401/404/422 won't succeed on a second attempt, it'll just delay the error reaching the component            |
| `retry: false` (mutations) | Never auto-retries. A login/register/create is a user-triggered write; silently resubmitting on a transient failure risks a duplicate side effect (e.g. two accounts created) the user didn't ask for |

This file is intentionally free of `"use client"`/React imports (unlike its
sibling provider) so `createQueryClient`'s defaults can be asserted on
directly in a unit test without mounting a component.

## Section 3 — The provider (`providers/query-provider.tsx`)

**Problem it solves:** a `QueryClient` is stateful (it holds the cache) —
sharing one instance across every render in the browser is correct, but
sharing one instance across _requests_ on the server would leak one user's
cached data into another user's response.

**How it's implemented:**

```tsx
// providers/query-provider.tsx:8-14
let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (typeof window === "undefined") return createQueryClient();
  browserQueryClient ??= createQueryClient();
  return browserQueryClient;
}
```

`typeof window === "undefined"` is the server branch: it returns a brand-new
`createQueryClient()` on every call, so concurrent server renders for
different users never share a cache. In the browser, the module-level
`browserQueryClient` singleton is created once and reused across re-renders
— this is the same server-vs-browser split `BaseClient`/`ApiInterceptor`
already do for the Axios instance (`SETUP_API_PROVIDER.md`).

`QueryProvider` (`providers/query-provider.tsx:16-25`) then mounts
`QueryClientProvider` with that client and renders `ReactQueryDevtools`
unconditionally — no `NODE_ENV` check needed, since `ReactQueryDevtools`
already no-ops itself out of production bundles internally.

**Mounted once**, above `NextIntlClientProvider`'s children:

```tsx
// app/[locale]/layout.tsx:60-64
<ThemeProvider>
  <NextIntlClientProvider messages={messages}>
    <QueryProvider>{children}</QueryProvider>
  </NextIntlClientProvider>
</ThemeProvider>
```

## Section 4 — Query keys + hooks, per feature

**Problem it solves:** the Server Component (prefetch) and the Client
Component (`useQuery`) need to agree on the _exact_ same cache key for
hydration to hand data off without a loading flash — and every feature needs
this key/fetch/hook trio, so it's a pattern, not a one-off.

### `feature/account/hooks/query.ts` — the read + prefetch pattern

```ts
// feature/account/hooks/query.ts:8-27
export const accountKeys = {
  all: ["accounts"] as const,
  list: (params: listMeAccountsParams) =>
    [...accountKeys.all, "list", params] as const,
};

export function fetchAccounts(
  params: listMeAccountsParams = {},
): Promise<AccountWithUserName[]> {
  return accountClient
    .listMeAccounts(params)
    .then((response) => response.data.data);
}

export function useAccounts(params: listMeAccountsParams = {}) {
  return useQuery({
    queryKey: accountKeys.list(params),
    queryFn: () => fetchAccounts(params),
  });
}
```

`fetchAccounts` is exported standalone (not only wrapped in the hook) because
the Server Component needs the identical function for `prefetchQuery` — see
[Section 6](#section-6--server-side-prefetch-applocaleprotecteddashboardpagetsx). `accountKeys` is kept separate
from the hook for the same reason: both the server prefetch and the client
hook import it, so the key shape can't drift between the two call sites.

**Rough edge:** `feature/common/params.ts:1` — the file `AccountList`'s
pagination params (`{ page: 1, limit: 10 }`) are hardcoded against, right
next to the type this file exports — carries a literal
`// TODO: finishes this patter` (typo preserved) at the top. The parsing
helpers it exports (`parseIntParam`, `parseStringParam`, `parseArrayParam`)
aren't called from either `dashboard/page.tsx` or `account-list.tsx` today —
the dashboard's page/limit are still literal numbers in the page component,
not derived from URL search params via this file yet.

## Section 5 — Mutations: the auth feature (`feature/auth/hooks/query.ts`)

> **Updated by the full-SSR migration** (`docs/MIGRATION_TO_FULL_SSR.md`):
> `mutationFn`/`queryFn` below now call a `"use server"` action
> (`feature/auth/actions.ts`'s `loginAction`/`registerAction`/`getProfileAction`)
> instead of `authClient` directly, and unwrap via
> `unwrapActionResult` (`lib/api/action-result.ts`) instead of a plain
> `.then((response) => response.data)`. The shape and the "Rough edges" below
> are otherwise unchanged — the browser still never sees a cache-invalidation
> call after login/register, it just also never touches `../core-service`
> directly anymore.

**Problem it solves:** login/register aren't cacheable reads — they're
one-shot writes a form submits. `useMutation` covers this shape, distinct
from the read+prefetch shape in Section 3.

```ts
// feature/auth/hooks/query.ts:14-53
export const authQueryKeys = {
  all: ["auth"] as const,
  profile: () => [...authQueryKeys.all, "profile"] as const,
};

export const useLoginMutation = () => {
  return useMutation<CommonSuccessResponse<AuthResponse>, Error, LoginRequest>({
    mutationFn: (body) =>
      authClient.login(body).then((response) => response.data),
  });
};

export const useRegisterMutation = () => {
  /* same shape, RegisterRequest */
};

export const useProfileQuery = () => {
  return useQuery<CommonSuccessResponse<ProfileResponse>, Error>({
    queryKey: authQueryKeys.profile(),
    queryFn: () => authClient.getProfile().then((response) => response.data),
  });
};
```

| Hook                  | Shape         | Cached under a key?                 |
| --------------------- | ------------- | ----------------------------------- |
| `useLoginMutation`    | `useMutation` | No — mutations aren't cache entries |
| `useRegisterMutation` | `useMutation` | No                                  |
| `useProfileQuery`     | `useQuery`    | Yes, `authQueryKeys.profile()`      |

`authQueryKeys` only has a `profile()` entry — login and register aren't
cached, so there's nothing for a key to identify.

**Every `authClient` method needs `.then((response) => response.data)`.**
`AuthClient` (like every `BaseClient` subclass, `lib/api/base-client.ts:45-98`)
returns the raw `Promise<AxiosResponse<TResponse>>`. A `mutationFn`/`queryFn`
must resolve to `TResponse` itself, so every call site here unwraps the
Axios envelope. Forgetting this is a type error, not a runtime one:
`mutationFn: (body) => authClient.login(body)` fails to typecheck against
`MutationFunction<CommonSuccessResponse<AuthResponse>, LoginRequest>` because
the resolved value still carries the extra `AxiosResponse` wrapper.

`feature/account/hooks/query.ts:17-19`'s `fetchAccounts` does the same
unwrap one level deeper (`.data.data`) — it also drops the
`CommonSuccessResponse` envelope down to a plain array, a call-site choice,
not a requirement. `feature/auth` keeps the envelope intact all the way to
the component instead: `login-form.tsx:31`'s `onSuccess: ({ data }) => ...`
destructures the envelope's `.data` once to reach `data.access_token`, not
`data.data.access_token`.

**Deliberately no server prefetch here.** Login/register/profile are all
interaction-or-session driven, not part of a page's initial render the way
the dashboard's account list is — there's no `page.tsx` awaiting
`queryClient.query` for any of these three.

### Rough edges

- **No cache invalidation after login/register.** Neither
  `login-form.tsx:30-48` nor `register-form.tsx:42-55` calls
  `queryClient.invalidateQueries` in `onSuccess` — they redirect straight to
  `/dashboard` via `router.push`. This happens to work today only because
  the dashboard's `accountKeys` cache is unrelated to `authQueryKeys`, and
  because navigation triggers a fresh Server Component render (a new
  `prefetchQuery` per Section 5) rather than reusing a stale client cache.
  If `useProfileQuery` is ever rendered on a page reached without a full
  navigation, its cache won't reflect the just-completed login until
  `staleTime` (30s) elapses or something else invalidates it.
- **`register-form.tsx:40-69` mixes `mutateAsync` with a manual `try`/`catch`**
  instead of the `mutate(...).onError` callback style `login-form.tsx:30-47`
  uses for the equivalent login flow — both reach the same field-error
  behavior (`getApiFieldErrors`), just via two different TanStack Query
  idioms in the same feature.

## Section 6 — Server-side prefetch (`app/[locale]/(protected)/dashboard/page.tsx`)

**Problem it solves:** the dashboard's account list used to be fetched
entirely inside the Server Component with a bare `try`/`catch`. That's
simple, but the data could never be refetched or invalidated without a full
page reload. Prefetching into a TanStack Query cache and hydrating it lets
the Server Component keep doing the _first_ fetch while handing off ongoing
cache ownership to the client.

```tsx
// app/[locale]/(protected)/dashboard/page.tsx:29-34, 48-50
const accountParams = { page: 1, limit: 10 };
const queryClient = new QueryClient();
await queryClient.query({
  queryKey: accountKeys.list(accountParams),
  queryFn: () => fetchAccounts(accountParams),
});

// ...

<HydrationBoundary state={dehydrate(queryClient)}>
  <AccountList />
</HydrationBoundary>;
```

`prefetchQuery` is **awaited**, not fire-and-forget behind a Suspense
fallback, so the first paint already has data — the same blocking behavior
the old inline `try`/`catch` had. If `accountClient.listMeAccounts` throws
(e.g. a 401), `prefetchQuery` catches it internally and stores the error in
the query cache; `dehydrate` ships that error state down too, so
`AccountList`'s own `error` branch handles it (`components/dashboard/account-list.tsx:25-31`)
— no `try`/`catch` needed in the page component anymore.

**Rough edge worth flagging:** the key (`accountKeys.list(accountParams)`)
must be built the _exact_ same way on both the server and the client. That's
why it's a shared function rather than an inline array literal at each call
site — a mismatched key (different param order, an extra field) silently
mounts a _different_ cache entry than the one hydrated, producing a loading
flash instead of instant data, with no error or warning.

```
Server Component (dashboard/page.tsx)
   │  queryClient.query(...) — same accountClient call as before
   ▼
dehydrate(queryClient) → <HydrationBoundary state={...}>
   │  ships the already-fetched data down in the initial HTML/RSC payload
   ▼
Client Component (AccountList)
   │  useAccounts() reads the hydrated cache — no loading flash on first paint
   ▼
TanStack Query
   │  now owns the browser copy: refetch on focus, manual invalidation, etc.
   ▼
accountClient.listMeAccounts() (unchanged)
```

## Component/presentational layer

`components/dashboard/account-list.tsx` is the only Client Component in this
flow with actual query logic (`useAccounts`, loading/error/empty branching,
`account-list.tsx:13-47`). It delegates presentation to three
presentational-only siblings — `AccountListItem` (`account-card.tsx`),
`AccountCardSkeleton`, and `AccountListMessage` — none of which import
TanStack Query; they just render whatever `AccountList` hands them.

`components/navigation/nav-account-list.tsx` (despite the name) is **not**
part of this flow — it exports `NavMain`, a sidebar nav-items renderer with
no data fetching, and should not be confused with `AccountList` above.

## Cross-feature coupling

- **The session cookie, not TanStack Query, gates every request.**
  `ApiInterceptor.addAuthorizationHeader` (`lib/api/api-interceptor.ts:39-65`)
  reads the session cookie on every request — server-side via `next/headers`
  `cookies()`, client-side via `document.cookie` — and attaches
  `Authorization: Bearer <token>`. A logout that clears the cookie doesn't
  itself touch the TanStack Query cache; a still-mounted `useAccounts()` will
  keep serving its cached (now-stale-relative-to-auth) data until its next
  refetch fails with a 401. Worth knowing before refactoring logout: nothing
  here calls `queryClient.clear()` on sign-out today.
- **Build-time requests are short-circuited app-wide.** `isBuildPhase()`
  (`lib/api/api-interceptor.ts:21-25`) throws `BuildPhaseSkippedError` for
  _any_ request instance during `next build`'s static generation phase —
  this applies to every `queryFn`/`mutationFn` in this doc, not just the
  dashboard's prefetch, since they all route through the same intercepted
  Axios instance (`lib/api/base-client.ts:39-42`).

## Final reference table

| Method | Endpoint                     | Client method                                                          | Wired to TanStack Query?                          |
| ------ | ---------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------- |
| GET    | `/accounts`                  | `accountClient.listMeAccounts` (`feature/account/client.ts:52`)        | Yes — `useAccounts` / server prefetch             |
| GET    | `/accounts/search-by-number` | `accountClient.searchAccountByNumber` (`feature/account/client.ts:66`) | No — called directly, no query hook exists for it |
| POST   | `/accounts`                  | `accountClient.createAccount` (`feature/account/client.ts:59`)         | No — no mutation hook exists for it               |
| POST   | `/accounts/{id}`             | `accountClient.updateAccount` (`feature/account/client.ts:77`)         | No — no mutation hook exists for it               |
| —      | `/accounts/{id}/deposit`     | _(commented-out placeholder only, `feature/account/client.ts:84`)_     | No — endpoint not implemented client-side yet     |
| POST   | `/auth/login`                | `authClient.login` (`feature/auth/client.ts:30`)                       | Yes — `useLoginMutation`                          |
| POST   | `/auth/register`             | `authClient.register` (`feature/auth/client.ts:37`)                    | Yes — `useRegisterMutation`                       |
| GET    | `/auth/profile`              | `authClient.getProfile` (`feature/auth/client.ts:44`)                  | Yes — `useProfileQuery`                           |

## Verification performed

- `yarn tsc --noEmit` — clean.
- `yarn lint` — clean.
- `yarn build` — succeeds.
- Registered a real user and created a real account against the running
  `core-service` + Postgres containers, then loaded `/en/dashboard` with a
  valid session cookie in a headless browser: the account rendered correctly
  from the server-hydrated cache, the client-side background refetch
  completed with **zero console errors**, and the React Query Devtools
  toggle rendered in the corner — confirming the full
  prefetch → hydrate → client-refetch loop works end-to-end, not just the
  initial server render.
