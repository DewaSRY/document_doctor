# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

# Portal — Project Guide

## What This Project Is

Next.js 16 (App Router) frontend for **Simple Bank**, a ledger-based core
banking demo. It's a customer-facing portal for account management,
deposits, and account-to-account transfers. It talks to the Go backend in
`../core-service` over HTTP — it has no database access, no server-side
business logic beyond auth/locale routing, and no API implementation of its
own beyond the Next.js middleware in `proxy.ts`. See the
[root README](../../README.md) for the monorepo shape.

Start with `docs/README.md` for a docs index, and
`docs/IMPROVEMENT_OPPORTUNITIES.md` for known gaps/tech debt (each cited to
file:line) before "fixing" something that looks wrong in passing — it may
already be a tracked, deliberate tradeoff.

## What the Architecture Looks Like

```
Page / Client Component
   │  renders a form or list, calls a feature hook
   ▼
feature/<name>/hooks/query.ts     (useQuery/useMutation + a queryKeys factory)
   │  calls a typed method on the feature's client
   ▼
feature/<name>/client.ts          (a BaseClient subclass — e.g. AccountClient)
   │  thin wrapper over axios.get/post/put/patch/delete
   ▼
lib/api/base-client.ts's apiClient (one shared axios.create() instance)
   │
   ▼
lib/api/api-interceptor.ts's ApiInterceptor
   │  injects Authorization + X-Timezone, blocks build-time requests,
   │  logs every request/response (lib/logger.ts), 401 → /logout
   ▼
Go backend (../core-service)
```

Feature code never touches axios directly and never branches on
server-vs-client — that question is answered once, in `ApiInterceptor`. Full
detail: `docs/SETUP_API_PROVIDER.md`.

A second, parallel data path exists for the _first_ render of a page: a
Server Component (`page.tsx`/`layout.tsx`) calls `queryClient.query`
with the **same** `queryKey`/fetch function a feature's hook uses, then hands
the cache to the client via `<HydrationBoundary state={dehydrate(queryClient)}>`
so the first paint already has data with no loading flash. See
`docs/SETUP_REACT_QUERY.md`.

## What the Major Directories Are

```
app/[locale]/
├── (public)/            # logged-out routes: landing, login, register, logout
├── (protected)/         # logged-in routes: dashboard, account/[id] — shared
│                         # layout.tsx enforces verifySession() + prefetches
│                         # the sidebar's account list
└── auth-success/        # OAuth-style landing route
feature/<name>/          # one folder per domain: account, account-manage,
│                         # account-transaction, auth, transfer, common
├── client.ts             # Axios resource client extending lib/api/base-client.ts
├── hooks/query.ts         # TanStack Query hooks + a queryKeys object
├── type.ts                # request/response types
└── schema.ts / utils.ts   # Zod schemas / pure helpers (not every feature has these)
components/<domain>/     # UI organized by feature/domain, not by component type
components/ui/           # shadcn/ui primitives — owned source, not a vendored dep
components/form/         # shared InputField/TextareaField wrapping RHF Controller
lib/api/                 # transport only: apiClient singleton + ApiInterceptor
lib/logger.ts            # winston logger with PII redaction
lib/query/               # TanStack QueryClient factory (staleTime/retry defaults)
i18n/                    # react-i18next config, server/client translation loaders,
│                         # locale-aware navigation/redirect helpers
messages/<locale>/       # one JSON file per namespace per locale (en, id)
providers/               # app-wide client providers (theme, React Query)
proxy.ts                 # this project's middleware — edge-level locale +
│                         # auth redirect, runs before every matched request
docs/                     # deep-dive "as implemented" subsystem docs — read
│                         # before re-deriving a pattern from scratch
```

## What the Major Modules Are

- **`lib/api/base-client.ts` + `lib/api/api-interceptor.ts`** — the entire
  HTTP transport layer. `BaseClient` gives every resource client typed
  `get`/`post`/`put`/`patch`/`delete` helpers and attaches `ApiInterceptor`
  to the shared `apiClient` instance exactly once (a `WeakSet` guard prevents
  duplicate interceptors when multiple resource clients are constructed).
  Everything in `feature/*/client.ts` depends on this; nothing outside
  `lib/api/` should touch axios directly.
- **`feature/<name>/client.ts`** — one `BaseClient` subclass per domain
  (`AccountClient`, `AuthClient`, `TransferClient`, ...), each exported as a
  singleton (`export const accountClient = new AccountClient()`). Depended on
  by that feature's `hooks/query.ts` and occasionally called directly from a
  component for a one-off call with no query hook (e.g.
  `accountClient.searchAccountByNumber`).
- **`feature/<name>/hooks/query.ts`** — the TanStack Query layer: a
  `queryKeys` (or `authQueryKeys`) factory object, a standalone fetch
  function (needed so a Server Component's `prefetchQuery` and the client's
  `useQuery` can share the exact same function/key), and the exported
  `use*Query`/`use*Mutation` hooks. Depends on the feature's `client.ts`;
  depended on by pages (for prefetch) and Client Components (for the hook).
- **`lib/query/query-client.ts` + `providers/query-provider.tsx`** — the
  `QueryClient` factory (30s `staleTime`, no retry on mutations, no retry on
  4xx) and the provider that gives the server a fresh client per render vs.
  the browser a module-level singleton. Depended on by every page that
  prefetches and every Client Component that calls a query hook.
- **`i18n/settings.ts`** — the single source of truth for `locales`
  (`en`/`id`), `namespaces`, and `isAppLocale()`. Nearly everything else in
  `i18n/`, plus `proxy.ts` and every page/layout, imports from here.
- **`i18n/server.ts`** vs **`components/translations-provider.tsx`** — two
  separate translation runtimes because `react-i18next`'s hook API can't run
  in a Server Component (see the i18n section below). Server Components call
  `getTranslation(locale, ns)`; Client Components use `useTranslation(ns)`
  inside the tree `TranslationsProvider` mounts.
- **`feature/auth/dal.ts`'s `verifySession()`** + **`proxy.ts`** — the two
  independent auth checks (see the Auth section below). `dal.ts` depends on
  `i18n/redirect.ts`; `proxy.ts` depends on `feature/auth/constants.ts`'s
  `SESSION_COOKIE_NAME`. `(protected)/layout.tsx` depends on `verifySession()`.
- **`components/ui/*`** — shadcn/ui + Base UI primitives, generated once by
  the shadcn CLI and now owned source. Every feature-domain component
  (`components/<domain>/`) and every modal wizard is built on top of these.
- **Multi-step modal Zustand stores** (`components/{transfer-modal,
deposite-model, create-account-model, edit-account-model,
delete-account-model}/store.ts`) — local wizard-step state only (current
  step, in-progress form values across steps). They never hold server data;
  server data always stays in a TanStack Query hook. See
  `components/transfer-modal/store.ts` for the reference shape (`step`,
  per-step data fields, one setter each, a `reset()`).

## What the Important Abstractions Are

| Abstraction             | Example                                                                                                                | Role                                                                                                                   |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Resource client         | `AccountClient` (`feature/account/client.ts`)                                                                          | Typed methods for one backend resource; owns endpoint shape, not transport                                             |
| Query key factory       | `accountKeys`/`queryKeys` (`feature/*/hooks/query.ts`)                                                                 | Shared cache-key builder used identically by server prefetch and client hooks                                          |
| Query/mutation hook     | `useAccounts`, `useLoginMutation`                                                                                      | The actual TanStack Query wiring a component calls                                                                     |
| Zod schema              | `feature/*/schema.ts`, `feature/auth/schemas.ts`                                                                       | Client-side form validation; two different translation strategies exist — see the forms section                        |
| DTO / response envelope | `CommonSuccessResponse<T>` (`feature/common/type.ts`), `ApiSuccessResponse<T>`/`ApiErrorResponse` (`lib/api/types.ts`) | Shape of every backend JSON response/error                                                                             |
| Shared UI primitive     | `components/ui/button.tsx`, `dropdown-menu.tsx`                                                                        | Owned shadcn/Base UI source, extended in place (not overridden from call sites)                                        |
| Shared form field       | `components/form/input-field.tsx`                                                                                      | Wraps RHF `Controller` + `Field`/`Input`, wires error state automatically                                              |
| Middleware              | `proxy.ts`                                                                                                             | Edge-level locale detection + optimistic auth redirect                                                                 |
| DAL check               | `feature/auth/dal.ts`'s `verifySession()`                                                                              | Render-time, per-page auth re-check (cookie presence only)                                                             |
| Client-side store       | `components/*-modal/store.ts` (Zustand)                                                                                | Local multi-step UI state, never server state                                                                          |
| Interceptor             | `ApiInterceptor` (`lib/api/api-interceptor.ts`)                                                                        | Cross-cutting concern applied to every request: auth header, timezone header, build-phase guard, logging, 401 handling |
| Logger                  | `lib/logger.ts` (winston)                                                                                              | Structured, PII-redacting server-side logging                                                                          |

## What Technologies Are Used

- **Language**: TypeScript (`strict: true`, see `tsconfig.json`)
- **Framework**: Next.js 16 (App Router), React 19
- **Server state**: TanStack Query v5 (`@tanstack/react-query`)
- **Local UI state**: Zustand (multi-step modal/wizard state only)
- **HTTP client**: Axios, single instance + one interceptor
- **Forms**: React Hook Form + Zod (`@hookform/resolvers`)
- **UI kit**: shadcn/ui on Base UI primitives (`@base-ui/react`, not Radix) +
  Tailwind v4 + `next-themes` (light/dark/system)
- **i18n**: `react-i18next`/`i18next` — **not** `next-intl` (fully migrated
  away; see the callout in "Important Constraints")
- **Logging**: winston, server-side only, with built-in field redaction
- **Package manager**: yarn (`yarn@1.22.22`, classic, not Berry)
- **Backend**: Go service in `../core-service`, reached only via
  `NEXT_PUBLIC_API_URL` — no ORM/DB access from this app
- **No test framework configured** (no Vitest/Jest, no `*.test.*` files) and
  **no CI** for this app (see "How to Run and Verify Changes")

## How the Code Is Organized

New feature-specific code goes in `feature/<name>/`, following the existing
four-file shape (`client.ts`, `hooks/query.ts`, `type.ts`, optionally
`schema.ts`/`utils.ts`). UI goes in `components/<domain>/`, organized by
what it's for, not by component type (there is no `components/molecules/`
or similar). Anything that is transport-level and applies to _every_
feature (not just one) belongs in `lib/api/`, not duplicated per client —
see "Adding a new cross-cutting concern" in `docs/SETUP_API_PROVIDER.md`.

Business/domain logic (what to fetch, how to validate, how to shape a
request body) lives in `feature/`. Presentation lives in `components/`.
Pages (`app/[locale]/**/page.tsx`) are thin: locale validation
(`isAppLocale`/`notFound`), the initial `prefetchQuery`, and composing
Client Components — they don't contain business logic themselves.

## How to Implement a New Feature

1. Create `feature/<name>/type.ts` — request/response types for the new
   resource.
2. Create `feature/<name>/client.ts` — a class extending `BaseClient`
   (`lib/api/base-client.ts`), one typed method per endpoint, each returning
   `this.get/post/put/patch/delete<CommonSuccessResponse<T>>({ endpoint, body?, params? })`.
   Export a singleton instance at the bottom (copy the pattern in
   `feature/account/client.ts`).
3. Create `feature/<name>/hooks/query.ts` — a `queryKeys`-shaped factory
   (name it `<name>QueryKeys` for new features, not the bare `queryKeys`
   every existing feature uses — see the naming-collision constraint below),
   a standalone exported fetch function per read endpoint (needed for
   server-side prefetch), and `use*Query`/`use*Mutation` hooks built on top.
   Every `client.ts` method returns a raw `AxiosResponse`, so every
   `queryFn`/`mutationFn` here must end in `.then((response) => response.data)`
   — forgetting it is a type error, not a runtime bug.
4. If the feature has forms, add `feature/<name>/schema.ts` with **static**
   Zod schemas using raw i18n keys as messages (e.g. `.min(1, "nameRequired")`)
   — not schema-factory functions parameterized on `t`. Resolve with
   `zodResolverTranslate` (`feature/account/form.ts`, despite its
   feature-scoped location it's schema/domain-agnostic) instead of the
   plain `zodResolver`. See `docs/FORM_ERROR_TRANSLATION.md`. (The older
   `feature/auth/schemas.ts` pattern — a schema _factory_ taking `t` and
   rebuilt via `useMemo` — still exists and works, but new forms should
   prefer the static-schema + `zodResolverTranslate` approach.)
5. Add any new translation keys to `messages/en/<namespace>.json` and
   `messages/id/<namespace>.json`. If it's a brand-new namespace, register it
   in the `namespaces` tuple in `i18n/settings.ts` — **and confirm it's
   actually wired into both `i18n/server.ts` and
   `components/translations-provider.tsx`'s loops**, since a form that calls
   `useTranslation("newnamespace")` before that registration silently
   renders raw keys instead of translated text (this exact gap currently
   exists for `"account"` — see `docs/FORM_ERROR_TRANSLATION.md` Section 4).
6. Build the UI in `components/<domain>/`, using `components/form/InputField`
   /`TextareaField` for form fields (they auto-wire RHF error state and set
   `id={name}` for `scrollToFirstError` to work) and `components/ui/*` for
   primitives. If it's a multi-step flow, add a local Zustand `store.ts`
   next to the components (UI/wizard state only — never server data).
7. If the page needs data on first render, prefetch in the Server Component
   with the exact same `queryKey`/fetch function the hook uses, and wrap
   children in `<HydrationBoundary state={dehydrate(queryClient)}>` (see
   `app/[locale]/(protected)/dashboard/page.tsx` or
   `(protected)/layout.tsx`'s sidebar prefetch for the pattern). A mismatched
   key shape here silently produces a loading flash instead of an error.
8. Place the route under `app/[locale]/(protected)/` or `app/[locale]/(public)/`
   depending on whether it needs a session (see the Auth section). Update
   `PROTECTED_PATH_PREFIXES`/`AUTH_ONLY_PATHS` in `proxy.ts` if the new route
   needs edge-level blocking/redirect beyond the render-time check.
9. Verify with `yarn lint`, `yarn tsc --noEmit`, `yarn build` (no automated
   tests exist to run — see "How to Run and Verify Changes").

## How to Modify Existing Code

- Business/validation logic → `feature/<name>/`. Transport-level concerns
  that apply to _every_ request → `lib/api/api-interceptor.ts`, not a single
  client. Presentation-only concerns → `components/`.
- Reuse `lib/api/error.ts`'s `getApiErrorMessage`/`getApiFieldErrors` to turn
  a caught Axios error into UI-facing messages — don't hand-parse
  `error.response.data` at a new call site.
- Reuse `components/form/input-field.tsx`/`textarea-field.tsx` for any new
  form field rather than wiring `Controller` by hand.
- Dependencies are constructed via module-level singletons (`accountClient`,
  `apiClient`, `browserQueryClient`), not injected — a new resource client
  follows the same "class + exported singleton instance" shape, it isn't
  passed in through props/context.
- Before renaming or "fixing" something that looks like an inconsistency,
  check `docs/IMPROVEMENT_OPPORTUNITIES.md` — it may be a tracked, deliberate
  tradeoff (e.g. the non-httpOnly session cookie) rather than an oversight.

## How to Implement APIs (Consuming the Backend)

This app has no server-side API routes of its own beyond `proxy.ts` (a
Next.js middleware, not an API handler) — "implementing an API" here means
adding a typed method to a `feature/*/client.ts` resource client.

- **Routing convention**: one method per endpoint on the resource's
  `BaseClient` subclass; the `/api/v1` prefix is baked into `apiClient`'s
  `baseURL` (`lib/api/base-client.ts`), so endpoint strings in `client.ts`
  start with `/accounts`, `/auth/login`, etc. — never repeat `/api/v1`.
- **Request shape**: `this.get/post/put/patch/delete<TResponse>({ endpoint, body?, params?, config? })`
  — a single options object, never positional args.
- **Response envelope**: the backend wraps successful responses as
  `{ data, message?, meta? }` — typed as `CommonSuccessResponse<T>`
  (`feature/common/type.ts`) or `ApiSuccessResponse<T>` (`lib/api/types.ts`;
  the two are structurally identical, see the constraint below). `meta`
  carries `{ page, limit, total }` for paginated list endpoints.
- **Error shape**: `{ error: { code?, message, details?: [{ field, message }] } }`
  — typed as `ApiErrorResponse` (`lib/api/types.ts`). Use
  `getApiErrorMessage`/`getApiFieldErrors` (`lib/api/error.ts`) to extract
  from it; **never** import `feature/common/type.ts`'s `ErrorResponse` — it's
  an unused duplicate of the same shape.
- **Pagination/filtering**: plain query params (`page`, `limit`, and a
  resource-specific filter like `name`/`number`), passed via the `params`
  option — see `AccountClient.listMeAccounts`/`searchAccountByNumber`
  (`feature/account/client.ts`).
- **Authentication**: never attach an `Authorization` header manually —
  `ApiInterceptor` does it for every request on the shared `apiClient`
  instance, reading the session cookie via `next/headers` (server) or
  `document.cookie` (browser). A 401 response is handled globally
  (`ApiInterceptor`'s response interceptor redirects to `/logout`); don't add
  a per-call 401 handler.
- **Authorization** (route-level): see the Auth section below — it's a
  cookie-presence check, not a role/permission system; there's no
  role-based access control in this app today.

## How to Work With the Database

Not applicable — this app has no database access. All persistent state
lives behind `../core-service`'s API. If a task seems to need a schema
change or a query, it belongs in `apps/core-service`, not here.

## How to Handle Errors

```
Axios request fails (network error, 4xx, 5xx)
      │
      ▼
ApiInterceptor's response interceptor (lib/api/api-interceptor.ts)
      │  401 → redirect to /logout (client-side only)
      │  every failure logged via lib/logger.ts (server-side only)
      ▼
Error propagates to the calling queryFn/mutationFn as a rejected promise
      │
      ▼
Component: getApiErrorMessage(error, fallback) / getApiFieldErrors(error)
      │  (lib/api/error.ts — parses the ApiErrorResponse shape)
      ▼
Form: form.setError(fieldName, { message })     for each field error
      form.setError("root", { message })         for a general error
      ▼
UI: InputField renders the field error; a root-level error renders wherever
    the form template puts formState.errors.root
```

`BuildPhaseSkippedError` (`lib/api/api-interceptor.ts`) is a distinct signal,
not a real HTTP failure — it's thrown for any request made during
`next build`'s static generation phase. Catch it specifically if a component
needs a build-time fallback state; don't let a generic error handler treat
it like a failed API call.

There is no centralized error boundary/toast system today — errors are
handled per-form (React Hook Form's `formState.errors`) or per-query
(TanStack Query's `error`/`isError`), following whichever pattern the
nearest existing feature uses.

## How to Handle Logging

Server-side only, via `lib/logger.ts` (winston). `import logger from "@/lib/logger"`
and call `logger.info(message, meta)` / `logger.error(message, meta)` —
pass the real object (a raw Axios config, a request body); redaction of
sensitive fields (`password`, `authorization`, `cookie`, `card_number`,
email/phone variants, etc. — see `SENSITIVE_KEYS` in `lib/logger.ts`) happens
automatically. **Never `console.log` anything that might carry user data** —
it bypasses redaction entirely.

Currently the only caller is `ApiInterceptor`, which logs request start,
response success, and response failure for every server-side API call, each
tagged with a correlating `requestId`. There's no client-side log sink and
no external shipping (Datadog/CloudWatch) — logs go to stdout/stderr only.
See `docs/SETUP_LOGGING.md` for the full redaction/format details before
adding a new sensitive field or a new log call site.

## How to Write Tests

**There is no test suite in this app today** — zero `*.test.*`/`*.spec.*`
files, no Vitest/Jest config, and no CI workflow for `apps/portal` (only
`apps/core-service` has CI, via `.github/workflows/core-service-ci.yml`).
`docs/IMPROVEMENT_OPPORTUNITIES.md` §3 has a concrete list of pure functions
that are low-effort test candidates if this is ever set up
(`formatAccountAmount`, `isIncomingEntry`, `getEntryLabel` in
`feature/account-transaction/utils.ts`; `parseIntParam`/`parseArrayParam` in
`feature/common/params.ts`; `maskSensitiveData` in `lib/logger.ts`; the Zod
schemas). Don't invent a testing convention unilaterally for a single change
— if a task requires adding real test coverage, treat introducing the
framework/config itself as part of the task and flag it explicitly, since
there's no existing pattern to follow.

## How Configuration Works

- **`.env.local`** (not committed) — the only environment file. Must set
  `NEXT_PUBLIC_API_URL` (falls back to `http://localhost:8080/api/v1` if
  unset), pointing at the locally running `apps/core-service`.
- **`NEXT_PUBLIC_SITE_URL`** (optional env var, falls back to
  `http://localhost:3000`) — the portal's own canonical origin, used by
  `lib/seo/metadata.ts` for `metadataBase`, canonical URLs, and
  `alternates.languages`. Not the same thing as `NEXT_PUBLIC_API_URL` (the
  backend). Set it to the real deployed origin in non-local environments.
- **`LOG_LEVEL`** (optional env var) — winston log level, defaults to
  `"info"` (`lib/logger.ts`).
- **`NODE_ENV`** — used directly in two places worth knowing about: the
  logger's format profile (JSON in production, colorized text in dev) and
  the session cookie's `Secure` attribute (`feature/auth/session.ts`/
  `session-client.ts` — only set in production).
- No secrets are stored in this app beyond the session token itself, which
  is intentionally a readable cookie (see the constraint below) rather than
  a server-held secret.
- `components.json`, `tsconfig.json`, `eslint.config.mjs`, `next.config.ts`
  are standard tool configs — don't hand-edit generated sections of them
  without checking what regenerates them (e.g. `shadcn init --force`
  rewrites parts of `app/globals.css`, per `docs/SETUP_SHADCN_THEME.md`).

## How to Run and Verify Changes

```bash
yarn install
yarn dev            # local dev server, requires apps/core-service running
                     # (see the monorepo README for docker compose up)

yarn lint           # eslint (eslint-config-next core-web-vitals + typescript)
yarn tsc --noEmit   # strict TypeScript check
yarn build          # production build — also exercises static generation,
                     # which is what BuildPhaseSkippedError guards against
```

These three commands are the entire verification gate for this app today —
there is no test suite and no CI workflow scoped to `apps/portal` (see "How
to Write Tests"). Run all three before considering a change done, regardless
of how small it looks; `strict: true` in `tsconfig.json` and the lint config
can otherwise be silently defeated by an unmerged PR.

Match the verification depth to the change:

```
API client / query hook change  → yarn tsc --noEmit (catches unwrapped
                                   AxiosResponse types), manual check against
                                   a running core-service if the endpoint
                                   shape changed
Form / schema change            → yarn tsc --noEmit, manual submit in the
                                   browser (valid + invalid input), check
                                   both locales render translated messages
Route / auth change             → manual check: signed-out hit on a
                                   protected route redirects to /login,
                                   signed-in hit on /login redirects to
                                   /dashboard, /logout still reachable
                                   while signed in
i18n / new namespace            → confirm the namespace is registered in
                                   i18n/settings.ts AND actually loaded in
                                   both i18n/server.ts and
                                   translations-provider.tsx — a form can
                                   compile and lint clean while silently
                                   rendering raw i18n keys (see the "account"
                                   namespace gap example)
Any change                      → yarn lint && yarn tsc --noEmit && yarn build
```

For UI changes, run `yarn dev` and exercise the actual flow in a browser
(both `en` and `id`, both light and dark) — type-checking and lint verify
correctness, not that the feature works end-to-end.

## Important Constraints

- **The session cookie is deliberately non-`httpOnly`.**
  `feature/auth/session.ts` and `session-client.ts` both comment on why:
  `ApiInterceptor` needs to read it via `document.cookie` for client-side
  requests, and the login/register forms write it directly from the browser
  after a client-driven mutation. This is an accepted tradeoff (any XSS
  becomes full session-token theft), not a bug — read
  `docs/IMPROVEMENT_OPPORTUNITIES.md` §1.1 before touching auth cookies, and
  don't "fix" it to `httpOnly` without addressing how the client would then
  attach the auth header (a BFF/proxy pattern is the suggested direction
  there, not a drive-by change).
- **`components/ui/*` are owned source, not a vendored dependency.** They
  were generated once by the shadcn CLI and are meant to be edited directly
  (e.g. extend `buttonVariants` for a new variant) rather than wrapped or
  overridden from call sites.
- **Known typos that are already public API** — grep before renaming, and
  prefer fixing over duplicating: `AccountTranscationClient`
  (`feature/account-transaction/client.ts`), `RequestAccountbody`
  (`feature/account/type.ts`). Both are imported from multiple call sites
  already; a careless rename breaks all of them.
- **Two API-error-shape types exist** — `lib/api/types.ts`'s
  `ApiErrorResponse` (the one actually used, by `lib/api/error.ts`) and
  `feature/common/type.ts`'s `ErrorResponse` (unused). Use `ApiErrorResponse`;
  don't add a third, and don't wire anything new to `ErrorResponse`.
- **`queryKeys` name collision across features.** `feature/account`,
  `feature/account-manage`, and `feature/account-transaction` each export a
  plain `queryKeys` binding, so any call site needing more than one aliases
  the import (`import { queryKeys as accountQueryKeys } from ...`). Only
  `feature/auth` uses a namespaced `authQueryKeys`. Follow the alias-import
  pattern at existing call sites; for a **new** feature, prefer a namespaced
  export (`<name>QueryKeys`) from the start rather than perpetuating the
  collision — see `docs/IMPROVEMENT_OPPORTUNITIES.md` §2.2.
- **Generated/managed files — don't hand-edit their generated parts**:
  `.next/`, `tsconfig.tsbuildinfo` (build artifacts, gitignored); the top
  "This is NOT the Next.js you know" block at the head of this very file
  (regenerated by `next dev` — see `node_modules/next/dist/server/lib/generate-agent-files.js`);
  `app/globals.css`'s shadcn-managed CSS variable blocks (re-running
  `shadcn init --force` can clobber hand-fixed parts, e.g. the
  `--font-sans` mapping — diff after any such re-init).
- **The build-phase guard is load-bearing.** `isBuildPhase()`
  (`lib/api/api-interceptor.ts`) throws `BuildPhaseSkippedError` for _every_
  request made during `next build`'s static generation, app-wide. Don't
  bypass or remove this to "fix" a build-time fetch failure — the actual
  problem is almost always that a page shouldn't be statically generating a
  request to a backend that isn't running in the build environment.

## Legacy / Special Cases — Stale Docs (Verified)

`docs/` is written "as implemented", but individual `SETUP_*.md` files can
still fall out of sync with a later change elsewhere. Two confirmed
discrepancies, verified directly against source while writing this file —
**trust the code over the doc** when they disagree:

1. **i18n library**: `docs/SETUP_AUTH_ROUTE_GROUPS.md`,
   `docs/SETUP_REACT_QUERY.md`, and `docs/SETUP_SHADCN_THEME.md` still show
   `next-intl` (`NextIntlClientProvider`, `useTranslations`, `@/i18n/navigation`'s
   old redirect). The app fully migrated to `react-i18next`/`i18next` — there
   is no `next-intl` in `package.json` and no import of it anywhere in the
   source. `docs/SETUP_INTERNATIONALIZATION.md` is the accurate, current doc
   and says so explicitly in its own intro. Follow that one for anything
   i18n-related.
2. **Route config location**: `docs/SETUP_AUTH_ROUTE_GROUPS.md` describes
   `feature/auth/route-config.ts` as the single source of truth for
   `PROTECTED_PATH_PREFIXES`/`AUTH_ONLY_PATHS`. That file no longer exists —
   both constants are now defined and exported directly from `proxy.ts`
   (which also now includes `/logout` in `AUTH_ONLY_PATHS`, with an explicit
   carve-out so an authenticated user can still reach it). Read `proxy.ts`
   itself for the current source of truth, not the doc's file reference.

If you touch either subsystem, consider updating the stale doc in the same
change (per this project's own convention of keeping `docs/` current with
the code) rather than leaving the drift for the next person to rediscover.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
