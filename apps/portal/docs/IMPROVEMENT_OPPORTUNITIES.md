# Portal — Improvement Opportunities

_As observed in the codebase on 2026-09-19 (previously 2026-09-18, 2026-09-11
— see "Resolved since last pass" for what changed). Every claim below is
cited to a file, so it's greppable and easy to re-verify as the code moves._

This is a young, well-structured app (clean `feature/<name>/{client,hooks,type,schema}.ts`
layering, one Axios instance, a documented `docs/SETUP_*` series). The issues
below are the gaps between that intended shape and what's actually shipped —
not a rewrite list.

---

## Resolved since last pass (2026-09-18 → 2026-09-19)

- **§1.1, session token security** — the full-SSR migration
  (`docs/MIGRATION_TO_FULL_SSR.md`) moved every mutation and read onto a
  `"use server"` action per feature (see each `feature/*/actions.ts`), so
  the browser no longer calls `../core-service` directly at all. The
  session cookie (`feature/auth/session.ts`) is now `httpOnly`, and
  `feature/auth/session-client.ts` (the client-side cookie writer) is
  deleted. See "1. Security" below for what's left.

## Resolved since last pass (2026-09-11 → 2026-09-18)

- **401 handling** — `lib/api/api-interceptor.ts` now has
  `setupResponseInterceptors()`; a 401 redirects to `/logout`
  (`handleUnauthorized()`), a real `/logout` page exists
  (`app/[locale]/(public)/logout/page.tsx`), and
  `feature/auth/components/session-guard.tsx` proactively surfaces an
  expired session on every protected page. See `docs/SETUP_API_PROVIDER.md`.
- **Dead/unfinished code** — `feature/transfer/*` is fully implemented
  (client, hooks, full modal UI in `components/transfer-modal/`);
  `feature/account-transaction/schema.ts` now has a real `depositSchema`;
  `useDeposit` has real call sites in `components/deposite-model/`; the
  stray TODO on `PaginationParams` (`feature/common/type.ts`) is gone.
- **i18n gaps** — `components/account/account-detail-view.tsx` and
  `feature/account-transaction/utils.ts`'s `getEntryLabel()` are fully
  translated now (`messages/{en,id}/account.json` exists). `deposit.json`
  and `transfer.json` namespaces were also added for the new features.
- **README** — replaced the create-next-app boilerplate with a real project
  summary and a `docs/` pointer (this pass).
- **Docs discoverability** — added `docs/README.md` as an index, and
  `docs/SETUP_LOGGING.md` documenting `lib/logger.ts` (previously
  undocumented despite being a substantial, deliberate piece of
  infrastructure — winston-based, PII-redacting, called from the
  interceptor for every server-side request).

---

## 1. Security

### 1.1 Session token is readable/writable by any JS on the page — resolved

**Resolved by the full-SSR migration** (`docs/MIGRATION_TO_FULL_SSR.md`,
2026-09-19). Login/register now run as `"use server"` actions
(`feature/auth/actions.ts`'s `loginAction`/`registerAction`) that call
`setSessionCookie()` (`feature/auth/session.ts`) with `httpOnly: true` —
the exact "Better" fix this section used to suggest (minus the separate
Route Handler; a Server Action does the same job). `feature/auth/session-client.ts`
(the `document.cookie` writer) is deleted, and
[lib/api/api-interceptor.ts](../lib/api/api-interceptor.ts)'s
`addAuthorizationHeader()` only reads the token via `next/headers`'
`cookies()` now — there's no browser code path left that needs to see the
raw token, so an XSS on this app can no longer read it out of
`document.cookie`.

`proxy.ts:35-37` still only checks that the session cookie *exists*, not
that the backend considers it valid — this remains a secondary concern
since the response interceptor handles invalid/expired tokens reactively,
and it works identically whether the cookie is `httpOnly` or not.

---

## 2. Duplication that will drift

### 2.1 Two competing "API error shape" types — still true

- [lib/api/types.ts](../lib/api/types.ts): `ApiErrorResponse` / `ApiErrorBody` / `ApiFieldError` — this is the one actually used, by [lib/api/error.ts](../lib/api/error.ts).
- [feature/common/type.ts:14-25](../feature/common/type.ts#L14-L25): `ErrorResponse` / `ErrorDetail` — same shape, different names, **still unused** (no import of either name found outside this file).

Pick one, delete the other.

### 2.2 Non-namespaced `queryKeys` export, repeated per feature — still true

`feature/account/hooks/query.ts:17`,
`feature/account-manage/hooks/query.ts:5`, and
`feature/account-transaction/hooks/query.ts:7` **all** export a binding
literally named `queryKeys`. Only `feature/auth` breaks the pattern with
`authQueryKeys` ([auth/hooks/query.ts:14](../feature/auth/hooks/query.ts#L14)).

The consequence keeps showing up at every call site that needs more than
one of them — they're forced to alias-import to avoid a collision, e.g.:

```ts
// app/[locale]/(protected)/account/[id]/page.tsx:9,11
import { queryKeys as accountQueryKeys } from "@/feature/account-manage/hooks/query";
import { queryKeys as accountTransactionQueryKeys } from "@/feature/account-transaction/hooks/query";

// feature/transfer/hooks/query.ts:3-4 — same pattern, a newer feature
// copying the same workaround rather than a namespaced export
import { queryKeys as accountQueryKeys } from "@/feature/account/hooks/query";
import { queryKeys as accountTransactionQueryKeys } from "@/feature/account-transaction/hooks/query";
```

Renaming each export to `accountQueryKeys`, `accountManageQueryKeys`,
`accountTransactionQueryKeys` at the source removes the aliasing burden from
every future call site, not just this one. Worth doing now — every new
feature (`transfer`) is still copying the workaround instead of the fix.

### 2.3 SSR prefetch duplicates the hook's `queryFn` by hand — still true

[app/[locale]/(protected)/layout.tsx:32-35](../app/%5Blocale%5D/(protected)/layout.tsx#L32-L35)
duplicates `useAccounts`'s queryFn
([feature/account/hooks/query.ts:28-31](../feature/account/hooks/query.ts#L28-L31)),
and
[app/[locale]/(protected)/account/[id]/page.tsx:45-63](<../app/[locale]/(protected)/account/[id]/page.tsx#L45-L63>)
duplicates both `useAccountEntries`
([feature/account-transaction/hooks/query.ts:18-27](../feature/account-transaction/hooks/query.ts#L18-L27))
and `useAccountDetail`
([feature/account-manage/hooks/query.ts:8-16](../feature/account-manage/hooks/query.ts#L8-L16)).
TanStack Query's `queryOptions()` helper exists for exactly this — export
`accountsQueryOptions(params)` once per hook, use it in both the hook and
the server-side `prefetchQuery` call, and a future change to the query key
or fetch shape can't silently drift between the two copies.

### 2.4 Naming typos (cosmetic, but load-bearing once public) — still true, more entrenched

- `AccountTranscationClient` — [feature/account-transaction/client.ts:12](../feature/account-transaction/client.ts#L12)
- `RequestAccountbody` — [feature/account/type.ts:29](../feature/account/type.ts#L29)

Both are now exported and imported across more call sites than last pass
(`feature/account-manage/client.ts`, `feature/account-manage/hooks/query.ts`,
`feature/account/hooks/query.ts`) — fixing now is cheaper than fixing later.

---

## 3. No automated verification

- **Zero test files** in `apps/portal` (no `*.test.*`/`*.spec.*`, no
  Vitest/Jest config). Pure functions still begging for unit tests with no
  rendering/mocking needed: `formatAccountAmount`, `isIncomingEntry`,
  `getEntryLabel` ([feature/account-transaction/utils.ts](../feature/account-transaction/utils.ts)),
  `parseIntParam`/`parseArrayParam` ([feature/common/params.ts](../feature/common/params.ts)),
  `maskSensitiveData` ([lib/logger.ts](../lib/logger.ts)), and the Zod schemas.
- **CI exists at the repo level but not for this app**:
  `.github/workflows/core-service-ci.yml` builds/vets/tests
  `apps/core-service` only (path-filtered); `.github/workflows/pr-branch-rules.yml`
  enforces branch naming, not code correctness. Nothing runs `yarn lint` /
  `yarn tsc --noEmit` / `yarn build` for `apps/portal` before merge, so the
  `strict: true` in [tsconfig.json](../tsconfig.json) can be silently
  defeated by a PR that doesn't type-check.

A `docs/SETUP_TESTING.md` in the same style as the other `SETUP_*` docs,
plus a portal-scoped GitHub Actions workflow mirroring
`core-service-ci.yml`'s path-filter pattern (`lint` → `typecheck` → `build`,
filtered to `apps/portal/**`), would close this gap without inventing a new
CI convention for the repo.

---

## Suggested order of attack

1. **2.2** (`queryKeys` renames) — cheap, and every new feature is still
   copying the workaround instead of the fix.
2. **2.1 / 2.4** — cheap renames/dedup, best done before more code imports
   the wrong name.
3. **2.3** — mechanical `queryOptions()` extraction, isolated per feature.
4. **3** — larger or process-level changes; worth a deliberate discussion
   rather than a drive-by fix.
