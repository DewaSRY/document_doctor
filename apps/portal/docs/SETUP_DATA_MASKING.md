# Server Action Result Masking — As Implemented

## Who this doc is for

You're comfortable with React Server Components, Server Actions (`"use server"`)
and TanStack Query, and you've read (or at least skimmed)
[`MIGRATION_TO_FULL_SSR.md`](MIGRATION_TO_FULL_SSR.md), since this feature sits
directly on top of the `runServerAction`/`unwrapActionResult` pair that
migration introduced. You don't need to know MessagePack or zlib; Section 0
covers them, and you can skip it if you already do.

This doc describes what the code does, checked line by line against the source
at commit `e2eacad` ("update portal securty by masking data"). It is not a
description of what the feature was meant to do. The name "masking" suggests
more protection than the code gives, so read Sections 0 and 2 before you
depend on it for anything security-related.

---

## Section 0 — Background Primer

### What "masking" means in this codebase

Here, "masking" means **encoding a Server Action's return value as a
compressed binary blob** before it leaves the server. The client decodes it
straight back. No field is redacted, no value is replaced with `****`, and
nothing is encrypted. The full payload reaches the browser. It's just harder
to read in the Network tab.

| Approach                                      | What leaves the server                 | Reversible by the browser?                      | Typical use                                         |
| --------------------------------------------- | -------------------------------------- | ----------------------------------------------- | --------------------------------------------------- |
| Plain Server Action return (before `e2eacad`) | React Flight-serialized JSON-like text | Yes, readable as-is                             | Default Next.js behavior                            |
| **Encode + compress (this codebase)**         | `Uint8Array` of zlib(msgpack(value))   | **Yes**: the decoder ships in the client bundle | Obfuscation, smaller payloads                       |
| Field-level redaction (e.g. `**** 1234`)      | A reduced/altered value                | No, the original never leaves the server        | Hiding PII the UI doesn't need                      |
| Encryption with a server-held key             | Ciphertext                             | No, not without the key                         | Only useful if the client never needs the plaintext |

### The two libraries

- **`@msgpack/msgpack` (3.1.3)**: MessagePack is a binary serialization format
  that works like "JSON, but bytes". `encode(value)` turns a JS value into a
  `Uint8Array`, and `decode(bytes)` turns it back.
- **`fflate` (0.8.3)**: a small, synchronous zlib/deflate implementation.
  `zlibSync(bytes)` compresses and `unzlibSync(bytes)` decompresses.

Stacked together, `zlibSync(encode(value))` gives an opaque-looking byte array.
React's Flight serializer can carry typed arrays across the Server Action
boundary, so a `Uint8Array` works as a return value.

### Gotchas that surprise newcomers

1. **This is not a confidentiality boundary.** Anyone with DevTools can call
   the same `unpack` the app ships, or paste the bytes into any msgpack/zlib
   decoder. Section 2's callout covers this.
2. **Only the Server Action wire response is masked.** The first-render data
   that a Server Component prefetches is unpacked _on the server_ and then
   dehydrated into the HTML/RSC payload in plain form. Section 5 explains
   why. Many readers assume the opposite.
3. **The decoded value ends up in the React Query cache in plain form.**
   React Query Devtools, or anything else that reads the cache, sees the
   same data it saw before this commit.

---

## Section 1 — Architecture at a Glance

The feature has no single composition root. It's a pair of wrapper functions
that sit on each side of every Server Action:

- `runMaskingServerAction` (`lib/api/pack-server-action.ts:6-10`) wraps the
  **body** of each `"use server"` action.
- `unpackActionResult` (`lib/api/unpac-server-resul.ts:6-8`) is applied to
  the **result** at each call site, via `.then(unpackActionResult)`.

Neither wrapper implements masking itself. Each one composes the existing
error-as-value helpers from `lib/api/action-result.ts` with the codec in
`lib/masking-data/masking.ts`.

| Concern                                         | Owner                                                                           | Analogy                                        |
| ----------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------- |
| Codec (encode + compress / decompress + decode) | `lib/masking-data/masking.ts`                                                   | The zip utility                                |
| Server-only entry point to the encoder          | `lib/masking-data/masking-server.ts`                                            | The "outbound mail" slot                       |
| Expected-error → return-value conversion        | `lib/api/action-result.ts` `runServerAction`                                    | Turning a bounced letter into a reply slip     |
| Server side: run action, then pack              | `lib/api/pack-server-action.ts` `runMaskingServerAction`                        | Seal the envelope                              |
| Client side: unpack, then rethrow or return     | `lib/api/unpac-server-resul.ts` `unpackActionResult`                            | Open the envelope and read the slip            |
| Wire type                                       | `lib/api/types.ts:39` `MaskingActionResult<T>`                                  | The envelope's label, which says what's inside |
| Call sites                                      | every `feature/*/actions.ts` + `feature/*/hooks/query.ts` + 3 Server Components | The mail senders/recipients                    |

**Why it's layered this way.** Masking was bolted onto the existing
`ActionResult` flow rather than replacing it. `runMaskingServerAction` is
literally `runServerAction(fn).then(packResult)`, and `unpackActionResult` is
literally `unwrapActionResult(unpack(result))`. The error-handling contract
from the SSR migration is therefore unchanged: errors are still values, and
the client still rethrows an axios-shaped error. There is one consequence to
remember for Section 5. A Server Component _also_ calls these actions, but
as a direct in-process function call, not over the wire. The pack/unpack
round-trip still happens there, but it protects nothing.

---

## Section 2 — The Codec (`lib/masking-data/masking.ts`)

**Problem it solves.** It turns any serializable value into a `Uint8Array`
and back, with type information preserved at compile time.

**How it's implemented.**

```ts
// lib/masking-data/masking.ts:4
export type Packed<T> = Uint8Array & { readonly __payload?: T };

// :11-13
export function pack<T>(value: T): Packed<T> {
  return zlibSync(encode(value, ENCODE_OPTIONS)) as Packed<T>;
}

// :15-21
export function unpack<T>(payload: Packed<T>): T {
  if (process.env.NODE_ENV === "test" && !(payload instanceof Uint8Array)) {
    return payload as T;
  }
  return decode(unzlibSync(payload)) as T;
}
```

> **If you're new to phantom types:** `__payload?: T` never exists at runtime.
> It's an optional, never-assigned property that exists only so TypeScript
> can carry `T` through a value that is really just bytes. That's how
> `unpack(result)` knows to return `ActionResult<T>` without an explicit type
> argument. The `as Packed<T>` in `pack` and the `as T` in `unpack` are
> unchecked casts. `decode` returns `unknown`, so nothing validates that the
> bytes actually match `T`.

| Option / branch                                 | What actually happens                                                                                                                                                                                              |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ENCODE_OPTIONS.ignoreUndefined: true` (`:6-9`) | Object keys whose value is `undefined` are **omitted**, the same way `JSON.stringify` behaves. Without it, msgpack would encode them as `nil`, and they'd come back as `null`.                                     |
| `NODE_ENV === "test"` passthrough (`:16-18`)    | If the payload isn't a `Uint8Array` under test, it's returned as-is so tests can stub actions with plain objects. **No test framework exists in this app** (see `AGENTS.md`), so this branch is unreachable today. |

> **A sharp edge to know about: "masking" is reversible by design.**
> `masking.ts` has no `"server-only"` marker, and it has to stay that way,
> because every client hook imports `unpack` from it through
> `unpac-server-resul.ts:4`. So the decoder, `@msgpack/msgpack` and `fflate`
> all ship in the client bundle. What you get today:
>
> - The Network tab shows binary instead of readable account names,
>   balances and ledger entries. That deters casual shoulder-surfing and
>   copy-paste.
> - It does **not** stop a user, an extension, or an XSS payload running in
>   the page from reading the data. It also doesn't hide anything the UI
>   renders anyway.
> - If the goal is to keep a field from reaching the browser at all (e.g. a
>   full account number, an email), strip or redact it inside the action
>   **before** `packResult`. Packing it won't hide it.

**Rough edges**

- The comment on `ENCODE_OPTIONS` (`:7`) reads "`null` instead of being
  absent, which JSON.stringify would have dropped". That's backwards: the
  option causes keys to be absent rather than become `null`. The table above
  describes the actual behavior.
- The file exports `pack` too (`:11`), so client code _can_ import the
  encoder. It's harmless, but the server-only wrapper in Section 3 is only a
  convention, not something the build enforces.

---

## Section 3 — The Server-Only Encoder (`lib/masking-data/masking-server.ts`)

**Problem it solves.** It gives server code an import path that cannot be
pulled into a client bundle by accident.

```ts
// lib/masking-data/masking-server.ts:1-7
import "server-only";
import { pack, Packed } from "./masking";

// use it on server
export function packResult<T>(result: T): Packed<T> {
  return pack(result);
}
```

`import "server-only"` makes the build fail if a Client Component's import
graph reaches this file. The same pattern is used in `feature/auth/dal.ts:1`.
`packResult` is a straight pass-through to `pack`, and the file exists only
for that guard.

### Dead duplicate: `lib/mask-result.ts`

> **Worth flagging before you import the wrong one.** `lib/mask-result.ts:1-28`
> is an earlier, all-in-one version of `masking.ts` plus `masking-server.ts`.
> It has the same `Packed<T>`, the same `ENCODE_OPTIONS`, and the same
> `pack`/`unpack`/`packResult`. **Nothing imports it** (grep for
> `mask-result`). It's also self-contradictory: it marks the whole file
> `"server-only"` (`:1`) while labelling `unpack` "use it on client" (`:16`).
> Any client import of it would break the build. It's safe to delete. If you
> keep it, don't wire anything new to it.

---

## Section 4 — The Action Wrappers (`lib/api/pack-server-action.ts`, `lib/api/unpac-server-resul.ts`)

**Problem they solve.** Every action and every call site should get masking
and the error-as-value contract from a single import, without composing the
two helpers by hand each time.

### Server side: `runMaskingServerAction`

```ts
// lib/api/pack-server-action.ts:6-10
export async function runMaskingServerAction<T>(
  fn: () => Promise<T>,
): Promise<MaskingActionResult<T>> {
  return runServerAction(fn).then(packResult);
}
```

The call runs in this order:

1. `runServerAction(fn)` (`lib/api/action-result.ts:13-27`) awaits `fn()`.
   - On success it returns `{ ok: true, data }`.
   - On an `AxiosError` **with a response** it returns
     `{ ok: false, error: { status, data } }` (`:19-24`).
   - On anything else (network failure, `redirect()`/`notFound()`,
     `BuildPhaseSkippedError`, a real bug) it **rethrows** (`:25`).
2. `.then(packResult)` packs the `ActionResult`, which is **either** branch.
   API errors (validation `details`, messages) therefore go over the wire
   packed too.

> **Divergence from what you'd expect: unshaped errors are never packed.**
> The rethrow at `action-result.ts:25` happens before `.then(packResult)`, so
> a network failure or a control-flow throw leaves the action as a normal
> thrown error. Next.js redacts it in production (the reason `runServerAction`
> exists; see `MIGRATION_TO_FULL_SSR.md`). That's correct behavior. Just
> don't expect every action response to be binary: redirects and failures
> still use Next's normal channel.

### Client side: `unpackActionResult`

```ts
// lib/api/unpack-server-result.ts:6-8
export function unpackActionResult<T>(result: MaskingActionResult<T>): T {
  return unwrapActionResult(unpack(result));
}
```

1. `unpack(result)` → `ActionResult<T>`.
2. `unwrapActionResult` (`lib/api/action-result.ts:29-43`) returns `data` on
   `ok: true`. On `ok: false` it throws an `Error` decorated with
   `isAxiosError: true` and `response: { status, data }`. That keeps
   `getApiErrorMessage`/`getApiFieldErrors` (`lib/api/error.ts`) working
   unchanged.

### The wire type (`lib/api/types.ts:39`)

```ts
export type MaskingActionResult<T> = Packed<ActionResult<T>>;
```

Every masked action is annotated
`Promise<MaskingActionResult<CommonSuccessResponse<X>>>`. Change one without
the other and `unpackActionResult` infers the wrong `T`. You get a compile
error, not a runtime bug.

**Rough edges**

- **Duplicate types.** `ActionErrorPayload` and `ActionResult<T>` are now
  declared twice, in `lib/api/types.ts:30-37` and `lib/api/action-result.ts:4-11`.
  They're structurally identical, so nothing breaks today. The
  `MaskingActionResult` in `types.ts` is built from the `types.ts` copy,
  while `runServerAction`/`unwrapActionResult` use the `action-result.ts`
  copy. If one is edited and the other isn't, they'll drift silently. Pick
  one (preferably `types.ts`) and re-export it.
- **Unused import:** `ActionErrorPayload` at `unpac-server-resul.ts:1` is
  never used.
- `lib/api/types.ts:1` imports `Packed` as a value import (`import { Packed }`)
  even though it's type-only. It works because TypeScript elides it, but
  `import type` would state the intent.
- This commit deleted the explanatory comment blocks from
  `lib/api/action-result.ts` (the "why errors are returned, not thrown"
  rationale) and from `feature/auth/actions.ts`/`hooks/query.ts`. That
  rationale now lives only in `MIGRATION_TO_FULL_SSR.md` and in this doc.

---

## Section 5 — Server Component Prefetch (the Unmasked Path)

**Problem this piece solves.** It gets data into the first paint with no
loading flash (see `SETUP_REACT_QUERY.md`). This doc covers it because it
uses the masking wrappers without being protected by them.

Three Server Components call the masked actions directly during render:

| File                                             | Prefetched query                                                                          | Line     |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------- | -------- |
| `app/[locale]/(protected)/layout.tsx`            | `queryKeys.list({ page: 1, limit: 10, name: "" })` via `listMeAccountsAction`             | `:43-46` |
| `app/[locale]/(protected)/dashboard/page.tsx`    | `queryKeys.list({ page: 1, limit: 10 })` via `listMeAccountsAction`                       | `:32-35` |
| `app/[locale]/(protected)/account/[id]/page.tsx` | account entries + `manageAccount(id)` via `getAccountEntriesAction`/`detailAccountAction` | `:51-66` |

Each of them does this:

```ts
// app/[locale]/(protected)/dashboard/page.tsx:32-35
await queryClient.query({
  queryKey: queryKeys.list(query),
  queryFn: () => listMeAccountsAction(query).then(unpackActionResult),
});
// ...
<HydrationBoundary state={dehydrate(queryClient)}>   // :52
```

> **This trips people up: first-render data is not masked.** When a Server
> Component calls a `"use server"` function, it's an ordinary in-process
> call with no RPC. So the sequence is:
>
> 1. the action packs the result,
> 2. `unpackActionResult` immediately unpacks it **on the server**,
> 3. the plain `CommonSuccessResponse` is stored in the server `QueryClient`,
> 4. `dehydrate(queryClient)` serializes that plain data into the page's
>    RSC/HTML payload.
>
> The account list, account detail and ledger entries for the initial page
> load are therefore readable in the HTML/RSC response, just as they were
> before `e2eacad`. Only **subsequent** client-side fetches (refetch,
> pagination, mutations) go through the binary wire format. The round-trip
> in steps 1–2 costs CPU and protects nothing.
>
> To mask this path you'd need to dehydrate the packed bytes and unpack
> during client hydration, for example through a custom
> `serializeData`/`deserializeData` on the QueryClient's
> `dehydrate`/`hydrate` options. That is not implemented.

---

## Section 6 — Per-Feature Call Sites

Every `feature/*/actions.ts` swapped `runServerAction` →
`runMaskingServerAction` and `ActionResult` → `MaskingActionResult`. Every
`feature/*/hooks/query.ts` swapped `unwrapActionResult` → `unpackActionResult`.
No action or hook calls the older unmasked pair directly any more.

| Feature               | Masked actions (`actions.ts`)                                                                  | Hook call sites (`hooks/query.ts`) |
| --------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------- |
| `account`             | `listMeAccountsAction` `:21`, `searchAccountByNumberAction` `:30`, `createAccountAction` `:39` | `:33`, `:63`, `:48`                |
| `account-manage`      | `detailAccountAction` `:20`, `updateAccountAction` `:30`, `deleteAccountAction` `:40`          | `:21`, `:29`, `:42`                |
| `account-transaction` | `getAccountEntriesAction` `:22`, `getRecentTransactionsAction` `:37`, `depositAction` `:50`    | `:46`, `:61`, `:69`                |
| `auth`                | `loginAction` `:22`, `registerAction` `:35`, `getProfileAction` `:48`                          | `:26`, `:32`, `:39`                |
| `transfer`            | `createTransferAction` `:15`                                                                   | `:17`                              |

**Divergences worth knowing**

- **`logoutAction` is not wrapped** (`feature/auth/actions.ts:14-17`). It
  returns `void` via `redirect()`, which is a control-flow throw, so there's
  nothing to pack. Its hook (`feature/auth/hooks/query.ts:45`) correctly
  doesn't call `unpackActionResult`. Keep it that way. Unpacking `undefined`
  would throw inside `unzlibSync`.
- **`loginAction`/`registerAction` pack `null`** (`:28`, `:41`). The access
  token is written to an `httpOnly` cookie server-side
  (`feature/auth/session.ts:9-18`) and never returned, so on success the
  masking wraps an empty payload. The part that matters is the
  failure branch: validation `details` for the login/register forms are
  packed.
- **Unrelated change in the same commit:** `useAccounts`
  (`feature/account/hooks/query.ts:35-37`) gained `staleTime: 5 min`,
  `refetchOnWindowFocus: false` and `refetchOnReconnect: false`. That isn't
  masking, but it changes how often the sidebar/dashboard account list
  refetches after this commit.

---

## Section 7 — Cross-Feature Coupling

- **Error UX depends on the `ok: false` branch surviving the round-trip.**
  `getApiErrorMessage`/`getApiFieldErrors` (`lib/api/error.ts`) and every
  form's `onError` → `form.setError(...)` rely on
  `unwrapActionResult` reconstructing `error.response.data.error.details`.
  If you ever change `pack` to drop or transform fields (e.g. to add real
  redaction), exempt the error payload, or field-level validation messages
  will silently disappear from forms.
- **The session cookie change is a prerequisite, not part of this feature.**
  `feature/auth/session.ts:15` now sets `httpOnly: true`, because every
  backend call happens server-side. `AGENTS.md` still describes the cookie
  as deliberately non-`httpOnly` and describes client-side axios calls. That
  section predates the SSR migration and is stale.
- **Bundle size:** `@msgpack/msgpack` and `fflate` are now client
  dependencies of every page that uses a feature hook, because
  `unpac-server-resul.ts` imports `masking.ts`. Keep that in mind before
  swapping in a heavier codec.
- **Changes outside this app.** The same commit also edits the repo-root
  `docker-compose.yaml`. That file isn't covered here.

---

## Section 8 — Presentational Layer

No UI component knows masking exists. Components call the `use*` hooks and
receive plain, already-unpacked data, and they don't import anything from
`lib/masking-data/` or `lib/api/pack-server-action.ts`. The only component
touched by this commit, `components/auth/login-form-screen.tsx`, got a
blank line and no behavior change.

Not part of this flow, despite similar names:

- **`lib/logger.ts`'s `maskSensitiveData`** does the _real_ redaction
  (replacing values of `SENSITIVE_KEYS`) for **server logs**. It has nothing
  to do with the Server Action wire format. See `SETUP_LOGGING.md`.
- **`lib/mask-result.ts`**: dead code, see Section 3.

---

## Section 9 — Data Flow Summary

### Client-initiated read or mutation (masked)

```
Client Component
  └─ useAccounts(params)                      feature/account/hooks/query.ts:30
       └─ queryFn: listMeAccountsAction(params)   ── Server Action RPC ──►
                                                  Next.js server
                                                   └─ runMaskingServerAction(fn)   pack-server-action.ts:6
                                                        ├─ runServerAction(fn)      action-result.ts:13
                                                        │    └─ accountClient → ApiInterceptor → core-service
                                                        │       → { ok: true, data } | { ok: false, error }
                                                        └─ packResult → zlib(msgpack(result))  masking-server.ts:5
       ◄── Uint8Array over the wire (binary in the Network tab) ──
       └─ .then(unpackActionResult)            unpac-server-resul.ts:6
            ├─ unpack → ActionResult<T>          masking.ts:15
            └─ unwrapActionResult               action-result.ts:29
                 ├─ ok: true  → data → React Query cache (plain)
                 └─ ok: false → throw axios-shaped Error → onError / getApiFieldErrors
```

### Server Component first render (not masked)

```
layout.tsx / dashboard/page.tsx / account/[id]/page.tsx
  └─ prefetchQuery → action(...)          (in-process call, no RPC)
       └─ pack → unpack immediately on the server
  └─ dehydrate(queryClient)                → plain JSON-like data in HTML/RSC payload
  └─ <HydrationBoundary> → client cache seeded with plain data
```

### Unshaped failure (not masked)

```
action → runServerAction → non-Axios / no-response error → rethrow (action-result.ts:25)
  → packResult never runs → Next.js redacts the thrown error in production
  → client queryFn rejects → getApiErrorMessage falls back to its default message
```

---

## Section 10 — API Surface Reference

This feature adds no backend endpoints. Its surface is the set of helper
functions and types below.

| Symbol                                   | Location                                                         | Side                   | Purpose                          | Status                                     |
| ---------------------------------------- | ---------------------------------------------------------------- | ---------------------- | -------------------------------- | ------------------------------------------ |
| `Packed<T>`                              | `lib/masking-data/masking.ts:4`                                  | both                   | Phantom-typed `Uint8Array`       | Used                                       |
| `pack`                                   | `lib/masking-data/masking.ts:11`                                 | both (intended server) | msgpack encode + zlib compress   | Used via `packResult`                      |
| `unpack`                                 | `lib/masking-data/masking.ts:15`                                 | client + server        | zlib decompress + msgpack decode | Used                                       |
| `packResult`                             | `lib/masking-data/masking-server.ts:5`                           | server-only            | Guarded entry to `pack`          | Used                                       |
| `runMaskingServerAction`                 | `lib/api/pack-server-action.ts:6`                                | server                 | `runServerAction` + pack         | Used by all 13 wrapped actions             |
| `unpackActionResult`                     | `lib/api/unpac-server-resul.ts:6`                                | client + server        | unpack + `unwrapActionResult`    | Used by all hooks + 3 Server Components    |
| `MaskingActionResult<T>`                 | `lib/api/types.ts:39`                                            | type                   | `Packed<ActionResult<T>>`        | Used                                       |
| `ActionResult<T>` / `ActionErrorPayload` | `lib/api/types.ts:30-37` **and** `lib/api/action-result.ts:4-11` | type                   | Error-as-value envelope          | Duplicated                                 |
| `runServerAction` / `unwrapActionResult` | `lib/api/action-result.ts:13`, `:29`                             | server / client        | Error-as-value helpers           | Used only through the masking wrappers now |
| `pack` / `unpack` / `packResult` (copy)  | `lib/mask-result.ts`                                             | server-only            | Earlier all-in-one version       | **Unused, dead code**                      |
