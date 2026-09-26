# Migrating to Full SSR

_Written 2026-09-19 against the code as it stood on `epic/update_core_services`
before this migration. **Implemented 2026-09-19** — Phases 1-6 below are all
applied: every mutation and read goes through a `"use server"` action per
feature (`feature/*/actions.ts`), the session cookie is `httpOnly`, and
`lib/api/api-interceptor.ts`'s browser-only branches are gone. The plan below
is kept as-is (not rewritten to past tense) since it's still the accurate
description of what was built and why — read it as the design doc, not a
TODO list. Two deltas from the plan as written: error handling needed one
extra piece not covered here (see the callout after Phase 6), and the
timezone header's replacement (Phase 4) landed as `lib/timezone-sync.tsx` +
`lib/api/constants.ts`'s `TIMEZONE_COOKIE_NAME`, matching the "cookie set on
first client render" option this doc suggested._

## Who this is for

Someone who knows this app's current shape (read the root `AGENTS.md` first)
and wants to reduce or eliminate client-side calls to `../core-service`. It
assumes you're comfortable with Next.js Server Components vs. Client
Components and TanStack Query's hydration model — `docs/SETUP_REACT_QUERY.md`
and `docs/SETUP_API_PROVIDER.md` cover those as they exist today.

**Read this before starting**: "fully SSR" is not a single switch, and a
literal zero-client-JS version of this app is neither achievable nor
desirable — it has modals, multi-step wizards, and forms with client-side
validation. Section 1 defines what the goal actually should mean here before
Section 2 lays out how to get there.

---

## 1. What "fully SSR" should mean for this app

Today the app is already a **hybrid** — Server Components prefetch initial
page data and hand it to the client via `HydrationBoundary`
(`app/[locale]/(protected)/dashboard/page.tsx:26-36`,
`app/[locale]/(protected)/layout.tsx:30-45`). What's *not* server-driven is
everything downstream of that first paint:

- **Every mutation** (login, register, create/edit/delete account, deposit,
  transfer) is a `useMutation` in a `feature/*/hooks/query.ts` whose
  `mutationFn` calls a `feature/*/client.ts` method, which calls `axios`
  directly from the browser.
- **The session cookie is deliberately non-`httpOnly`**
  (`feature/auth/session.ts:4-6`, `feature/auth/session-client.ts:3-7`)
  specifically *because* the browser makes those calls itself and
  `ApiInterceptor` has to attach `Authorization: Bearer <token>` from
  `document.cookie` on the client (`lib/api/api-interceptor.ts:91-96`).
  `docs/IMPROVEMENT_OPPORTUNITIES.md` §1.1 already flags this as the thing
  worth reconsidering — this doc is the "how."
- Login/register write that cookie themselves, from the browser, after their
  mutation resolves (`components/auth/login-form-screen.tsx:32-33`, via
  `setClientSessionCookie` in `feature/auth/session-client.ts:8-13`).

So "fully SSR" here should mean:

> **The browser never talks to `../core-service` directly.** Every request
> that reaches the Go backend is made from the Next.js server — a Server
> Component render or a Server Action — never from `axios` running in a tab.

That's an achievable, well-defined target that also fixes §1.1's security
tradeoff as a side effect (once nothing in the browser needs to read the
token, the cookie can become `httpOnly`). It's a different goal from "no
client components" — `components/ui/*`, the modals, the Zustand wizard
stores, and anything using `useTranslation`/`react-hook-form` stay client
components, because they're interactive by nature. Trying to eliminate those
too would mean ripping out React Hook Form, TanStack Query, and the
multi-step modal pattern this app is built around — a rewrite, not a
migration, and not what "fully SSR" buys you here.

---

## 2. Current data flow vs. target

```
TODAY
  Client Component → useMutation/useQuery → feature/*/client.ts → axios
                                                                     │
                                                                     ▼
                                                          ../core-service
                                              (browser attaches its own
                                               Authorization header, read
                                               from document.cookie)

TARGET
  Client Component → Server Action / Server-Action-backed query
                                │
                                ▼
                     feature/*/client.ts → axios (server-side only)
                                │
                                ▼
                          ../core-service
              (Authorization header always read via next/headers'
               cookies(), never from document.cookie)
```

The one thing that doesn't change shape: `feature/*/client.ts` methods
themselves. They're already transport-agnostic — the migration moves *where
they're called from*, not what they do.

---

## 3. Phased plan

### Phase 1 — Auth: Server Actions + `httpOnly` cookie

This is the highest-leverage phase — it's also the one piece of this
migration that already has a working example to copy.
`feature/auth/actions.ts` already has a real Server Action:

```ts
// feature/auth/actions.ts — existing code, not proposed
"use server";
export async function logoutAction(locale: AppLocale): Promise<void> {
  await clearSessionCookie();
  return redirect({ href: "/login", locale });
}
```

Login and register don't yet follow this shape — `useLoginMutation`
(`feature/auth/hooks/query.ts:24-29`) calls `authClient.login` directly from
the client, and the form sets the cookie itself afterward
(`login-form-screen.tsx:32-33`). Steps:

1. Add `loginAction(body: LoginRequest)` / `registerAction(body: RegisterRequest)`
   to `feature/auth/actions.ts`, each `"use server"`, each calling
   `authClient.login`/`.register` (now running server-side, so the request
   goes out with no client-attached header at all — `addAuthorizationHeader`
   just won't find a token, which is correct for an unauthenticated call)
   and, on success, setting the cookie itself via `cookies().set()` with
   `httpOnly: true` (mirror `clearSessionCookie` in `feature/auth/session.ts`,
   but writing instead of deleting).
2. Update `login-form-screen.tsx`/`register-form-screen.tsx` to call the
   action instead of `useLoginMutation`/`setClientSessionCookie`. You can
   still wrap the Server Action in `useMutation({ mutationFn: loginAction })`
   — Server Actions are just async functions, so all of the existing
   `onSuccess`/`onError` → `form.setError(...)` wiring
   (`getApiFieldErrors`/`getApiErrorMessage`, per
   `docs/FORM_ERROR_TRANSLATION.md`) keeps working unchanged. This is the
   easiest way to do this migration without also rewriting the forms.
3. Delete `feature/auth/session-client.ts` once no call site sets or clears
   the cookie from the browser anymore.
4. Leave `proxy.ts` and `feature/auth/dal.ts`'s `verifySession()` alone —
   both only check *presence* of the cookie
   (`proxy.ts:35-37`, `dal.ts:9-14`), and `request.cookies.get()` in
   middleware reads `httpOnly` cookies exactly the same as non-`httpOnly`
   ones. Nothing here needs to change.

**Don't do this piece separately from Phase 4** below — until every other
client-driven call is gone, `ApiInterceptor` still needs the
`document.cookie` fallback for whatever hasn't migrated yet. Flipping the
cookie to `httpOnly` before then will silently break every remaining
client-driven request (no way to read the token → no `Authorization`
header → 401 → the existing `handleUnauthorized()` redirect to `/logout`,
which will look like "the app logs everyone out constantly").

### Phase 2 — Mutations: one feature at a time

Same pattern for each of `create-account`, `edit-account`, `delete-account`
(`feature/account-manage/`), `deposit` (`feature/account-transaction/`), and
`transfer` (`feature/transfer/`):

1. Add a `"use server"` action per mutation that calls the existing
   `feature/*/client.ts` method.
2. Point the feature's `useMutation`'s `mutationFn` at the new action instead
   of the client method directly.
3. Add `revalidatePath`/`revalidateTag` calls inside the action for whatever
   routes show the data that just changed, alongside (not instead of) the
   existing `queryClient.invalidateQueries` calls — TanStack Query's client
   cache and Next.js's server cache are two separate caches, and both are
   now in play.

Concretely, `useCreateTransfer` (`feature/transfer/hooks/query.ts:9-30`)
today does:

```ts
mutationFn: (body: CreateTransferBody) => transferClient.createTransfer(body),
onSuccess: (_data, variables) => {
  queryClient.invalidateQueries({ queryKey: accountQueryKeys.all });
  queryClient.invalidateQueries({ queryKey: accountTransactionQueryKeys.entries(...) });
  queryClient.invalidateQueries({ queryKey: accountTransactionQueryKeys.recentTransactions(...) });
},
```

becomes a `createTransferAction(body)` in a new `feature/transfer/actions.ts`
that calls `transferClient.createTransfer` and revalidates the dashboard and
`account/[id]` routes server-side; `mutationFn` in the hook points at the
action instead, and the `onSuccess` client-cache invalidation stays as-is
(it's what makes the modal's own UI update instantly without waiting on a
full server round-trip re-render).

Do this feature-by-feature, not as one big-bang change — each one is
isolated (its own client/hooks/modal-store triple), so there's no reason to
touch all five at once, and each is independently verifiable per the
"Form / schema change" row in `AGENTS.md`'s verification table.

### Phase 3 — Interactive reads

The reads that are already prefetched (dashboard's and the sidebar's account
list, account detail) don't need to change — that's the pattern to keep, not
replace (`docs/IMPROVEMENT_OPPORTUNITIES.md` §2.3 has an unrelated, smaller
cleanup for these — worth doing at the same time if you're already in this
code, but it's not required for this migration).

What *does* still call the backend from the browser is anything driven by
user interaction after first paint — paginating account entries, searching
an account by number (`AccountClient.searchAccountByNumber`,
`feature/account/client.ts`), changing the sidebar's page/limit. Two options,
in order of recommendation:

1. **Point the existing `queryFn` at a Server Action instead of the client
   method directly.** TanStack Query doesn't care whether its `queryFn`
   calls `axios` or a `"use server"` function — only that it returns a
   promise. This preserves every bit of existing caching/loading-state UX
   and requires the smallest diff.
2. **Drive the query entirely off URL search params** and let the Server
   Component re-run its `prefetchQuery` on navigation (`router.push` with a
   new `?page=`/`?q=`), removing the client `useQuery` for that view
   entirely. This is more "fully SSR" in spirit but is a bigger rewrite per
   view and loses TanStack Query's instant client-side pagination — only
   worth it for views where an extra round-trip per interaction is
   acceptable.

Default to option 1 unless a specific view's UX doesn't need client-side
caching at all.

### Phase 4 — Retire the client branch in `ApiInterceptor`

Once nothing in `feature/*/hooks/query.ts` calls a `client.ts` method
directly from a Client Component anymore (Phases 1–3 done), the
`document.cookie` branch in `addAuthorizationHeader`
(`lib/api/api-interceptor.ts:91-96`) and the browser-only branch in
`addClientTimezoneHeader` (`lib/api/api-interceptor.ts:103-107`) are dead —
every request now originates server-side, so `isServer()` is always `true`
at the point these run. Collapse `addAuthorizationHeader` to just the
`next/headers` path.

Timezone needs a replacement source once the client-only `X-Timezone` header
goes away — either read it once client-side and pass it as a Server Action
argument, or set it as a cookie on first client render and read that cookie
server-side alongside the session token. Pick this up as part of this phase,
not before — it's the same shape of problem as the auth header and the
solution should match it.

This is also the point where `feature/auth/session.ts`'s cookie can actually
become `httpOnly: true` — nothing left needs `document.cookie` to see it.
This closes `docs/IMPROVEMENT_OPPORTUNITIES.md` §1.1 completely, not just
its "shorten `expires_in`" fallback suggestion.

### Phase 5 — Zustand wizard stores: no change

`components/{transfer-modal,deposite-model,create-account-model,
edit-account-model,delete-account-model}/store.ts` already hold only
UI/wizard state (current step, in-progress field values across steps) —
never server data, per the existing convention in `AGENTS.md`. Nothing here
needs to move. The only thing that changes is what their final "submit" step
calls (Phase 2's action instead of the current mutation), which is a
one-line change per store's consuming component, not a store rewrite.

### Phase 6 — `proxy.ts`: no change

Middleware already only checks cookie *presence*
(`SESSION_COOKIE_NAME`, `proxy.ts:35-37`) for the edge-level redirect, and
that check works identically whether the cookie is `httpOnly` or not. Skip
this file entirely unless a later, separate decision is made to also
validate the token's *validity* at the edge (that would be a bigger change —
calling the backend from middleware — and is out of scope for this
migration).

### A gap this plan didn't cover: Server Action error redaction

Step 2 of Phase 1 says the existing `onError` → `getApiFieldErrors`/
`getApiErrorMessage` wiring "keeps working unchanged" once a mutation is a
Server Action. That's true for the *component* code, but only because of one
extra piece this plan didn't call out: `node_modules/next/dist/docs/01-app/
01-getting-started/10-error-handling.md` is explicit that Server Functions
should "avoid using try/catch blocks and throw errors" and "model expected
errors as return values" — in production, an error thrown out of a Server
Action arrives on the client redacted to a generic digest-only message, which
would silently break `getApiFieldErrors`' `axios.isAxiosError(error) &&
error.response?.data?.error?.details` check (the real `AxiosError` never
reaches the client).

Every `feature/*/actions.ts` action therefore wraps its backend call in
`runServerAction()` (`lib/api/action-result.ts`), which catches an
`AxiosError` with a `response` and returns it as plain, serializable data
(`ActionResult<T>`) instead of throwing it — redaction only applies to thrown
errors, not return values. The corresponding hook then calls
`unwrapActionResult()` on the client side, which reconstructs an
axios-error-shaped object (`isAxiosError: true`, `response.data.error...`)
and throws *that* — this throw happens in the browser's own JS engine, after
the RPC boundary, so it's never subject to Next's redaction. Everything
downstream (`getApiErrorMessage`, `getApiFieldErrors`, every form's
`onError`) is unaware anything changed. An unshaped error (network failure, a
`redirect()`/`notFound()` control-flow throw, `BuildPhaseSkippedError`) isn't
an `AxiosError` with a `response`, so `runServerAction` re-throws it as-is
and lets Next's normal handling (and, for `getApiErrorMessage`, its existing
fallback-message branch) take over — matching the pre-migration behavior for
those cases too.

---

## 4. What stays a Client Component, and why that's fine

| Area | Files | Why it's not going away |
|---|---|---|
| Forms | `components/auth/login-form-screen.tsx`, `register-form-screen.tsx`, every modal step component | React Hook Form + client-side Zod validation needs to run in the browser for instant field feedback |
| Modal wizards | `components/{transfer-modal,deposite-model,create-account-model,edit-account-model,delete-account-model}/*` | Multi-step UI state (Zustand), dialog open/close, step transitions |
| `components/ui/*` | shadcn/Base UI primitives | Dialogs, dropdowns, tabs, tooltips are inherently interactive |
| Navigation | `app-sidebar.tsx`, `nav-account-list.tsx`, `locale-switcher.tsx`, `theme-toggle.tsx` | User-triggered UI state, not server data |
| `components/common/navigation-guard/*` | unsaved-changes warning | Needs `beforeunload` + client router interception |
| `providers/*`, `components/translations-provider.tsx` | theme, React Query, i18n | Context providers by definition run client-side |

None of these hold server data or call `../core-service` themselves after
this migration — they call the query hooks / Server Actions from Phases 1–3.
That's the actual goal (Section 1), not zero `"use client"` directives.

---

## 5. Risks and tradeoffs

- **Cookie-writing only works from a Server Action or Route Handler**, never
  from a plain Server Component render (`cookies().set()` throws outside a
  request/action context). This is already solved once for `logoutAction` —
  Phase 1 is applying the same pattern to login/register, not inventing a
  new one.
- **Sequencing matters**: flipping the cookie to `httpOnly` before every
  client-driven call is migrated breaks whatever hasn't moved yet (Phase 1's
  note above). Do Phase 4's `httpOnly` flip last, not first.
- **No test suite exists for this app** (`AGENTS.md`'s "How to Write Tests"
  — zero `*.test.*` files, no CI for `apps/portal`). This migration touches
  auth end-to-end, which is exactly the kind of change where a regression is
  easy to miss by manual testing alone (e.g. a locale-specific redirect loop
  that only shows up in `id`, not `en`). Worth treating "add coverage for
  the login/logout/protected-route flow" as part of this migration rather
  than after it, even though introducing the test framework itself is a
  separate decision per `AGENTS.md`'s existing guidance not to invent one
  unilaterally for a single change — flag it explicitly when you get to
  Phase 1 rather than skipping it silently.
- **`revalidatePath`/`revalidateTag` and TanStack Query's client cache are
  two independent invalidation mechanisms** once Phase 2 is done for a given
  feature — forgetting one after adding the other produces a UI that's
  correct on the page that triggered the mutation but stale on a
  server-rendered page reached by direct navigation (or vice versa). Test
  both paths (in-app navigation and a hard reload) per mutation you migrate.
- **`docs/IMPROVEMENT_OPPORTUNITIES.md` §2.3** (SSR prefetch duplicating a
  hook's `queryFn` by hand) gets more valuable to fix once query functions
  start pointing at Server Actions instead of `client.ts` directly (Phase
  3) — the drift risk between the prefetch copy and the hook copy is the
  same, but now it's drift in *what talks to the backend*, not just cache
  keys. Consider doing §2.3's `queryOptions()` extraction alongside Phase 3
  rather than after it.

---

## 6. Suggested order of attack

1. **Phase 1** (auth actions) — highest leverage, has a working pattern to
   copy already (`logoutAction`), and unblocks nothing else being at risk of
   the `httpOnly` sequencing hazard above (don't flip the cookie yet).
2. **Phase 2**, one feature at a time, starting with whichever mutation ships
   next in normal roadmap work — no reason to batch all five before shipping
   anything.
3. **Phase 3** for the interactive reads still calling the backend directly
   from the browser (search-by-number, paginated entries).
4. **Phase 4** last — collapse `ApiInterceptor`'s client branch and flip the
   cookie to `httpOnly` only once Phases 1–3 have removed every browser→
   backend call.
5. **Phase 5 / 6** aren't separate work items — they fall out for free as
   Phase 2's consuming components change what they call.

Verify each phase using the existing gate in `AGENTS.md`'s "How to Run and
Verify Changes": `yarn lint && yarn tsc --noEmit && yarn build`, plus the
"Route / auth change" manual checklist there for anything touching Phase 1
or 4 specifically (signed-out hit on a protected route, signed-in hit on
`/login`, `/logout` still reachable).
