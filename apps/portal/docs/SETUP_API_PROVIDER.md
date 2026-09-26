# API Provider Setup

How this app talks to the backend: a single shared Axios instance, wrapped by
per-resource client classes, with cross-cutting concerns (auth, timezone,
build-safety) handled once in an interceptor.

Files:
- [lib/api/base-client.ts](../lib/api/base-client.ts) — the shared Axios
  instance and the `BaseClient` base class every API client extends.
- [lib/api/api-interceptor.ts](../lib/api/api-interceptor.ts) — request
  interceptor logic (auth header, timezone header, build-phase guard).
- [feature/auth/client.ts](../feature/auth/client.ts),
  [feature/account/client.ts](../feature/account/client.ts) — real
  `BaseClient` subclasses to copy the "Extending it" pattern from.

## Why this shape

Every request that reaches the backend now originates from the Next.js
server — a Server Action or a Server Component render
(`docs/MIGRATION_TO_FULL_SSR.md`) — but a build-time static-generation pass
is still a third context that needs its own guard (there's no backend to
call yet). If every API call site had to know which context it was in, that
logic would leak into every feature. So it's centralized once:

```
Feature code
   │  calls a typed method, e.g. userClient.getProfile()
   ▼
Resource client (extends BaseClient)
   │  knows the endpoint shape, not the transport concerns
   ▼
BaseClient
   │  thin wrapper over axios.get/post/put/patch/delete
   ▼
apiClient (shared axios.create() instance)
   │  one instance, one interceptor attached
   ▼
ApiInterceptor
   │  injects Authorization + X-Timezone, blocks build-time requests,
   │  logs request/response (docs/SETUP_LOGGING.md), 401 → /logout
   ▼
Backend
```

Feature code never touches axios directly, and never has to think about
"am I on the server or the client right now?" — that question is answered
in exactly one place.

## `BaseClient`

`BaseClient` is not meant to be used directly — it's a base class that gives
every resource-specific client (`UserClient`, `OrderClient`, etc.) typed
`get`/`post`/`put`/`patch`/`delete` helpers over a shared `AxiosInstance`.

```ts
export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api/v1",
  headers: { "Content-Type": "application/json" },
  timeout: 10_000,
});
```

The `/api/v1` prefix is baked into the fallback default (and into
`NEXT_PUBLIC_API_URL` in `.env.local`) rather than repeated in every
endpoint string — see the "Missing `/api/v1` prefix" gotcha in
`SETUP_REACT_QUERY.md`.

`apiClient` is a module-level singleton — created once, imported everywhere.
That matters for the interceptor (see below): there is exactly one Axios
instance in the app unless a caller explicitly passes a different one.

Each protected method takes a single options object (`{ endpoint, body,
params, config }`) instead of positional args, so call sites read as intent
rather than as an argument-order puzzle, and adding a new option later never
becomes a breaking change:

```ts
protected post<TResponse = unknown>(
  options: RequestOptions,
): Promise<AxiosResponse<TResponse>>
```

### Attaching the interceptor exactly once

The constructor attaches `ApiInterceptor` to whatever instance it's given:

```ts
const interceptedInstances = new WeakSet<AxiosInstance>();

export class BaseClient {
  protected readonly instance: AxiosInstance;

  constructor(instance: AxiosInstance = apiClient) {
    this.instance = instance;

    if (!interceptedInstances.has(instance)) {
      new ApiInterceptor(instance);
      interceptedInstances.add(instance);
    }
  }
}
```

The `WeakSet` guard exists because `BaseClient` is subclassed once per
resource, but `apiClient` is shared by all of them. Without the guard, every
`new UserClient()`, `new OrderClient()`, etc. would call
`instance.interceptors.request.use(...)` again on the *same* instance —
stacking up N identical interceptors that each redundantly re-check auth and
timezone on every request. The guard makes "attach interceptor" idempotent
per Axios instance, so it doesn't matter how many resource clients exist or
in what order they're constructed.

### Extending it

Resource clients live next to the feature they belong to —
`feature/<name>/client.ts` (e.g. [feature/auth/client.ts](../feature/auth/client.ts),
[feature/account/client.ts](../feature/account/client.ts)) — not under
`lib/api/`, which only holds the transport-level pieces (`BaseClient`,
`ApiInterceptor`) shared by all of them:

```ts
// feature/user/client.ts
import { BaseClient } from "@/lib/api/base-client";
import type { CommonSuccessResponse } from "@/feature/common/type";

export type UserProfile = {
  id: string;
  name: string;
};

export class UserClient extends BaseClient {
  getProfile(userId: string) {
    return this.get<CommonSuccessResponse<UserProfile>>({
      endpoint: `/users/${userId}`,
    });
  }

  updateProfile(userId: string, body: Partial<UserProfile>) {
    return this.patch<CommonSuccessResponse<UserProfile>>({
      endpoint: `/users/${userId}`,
      body,
    });
  }
}

export const userClient = new UserClient();
```

Export a singleton instance per resource (as above), the same way `apiClient`
itself is a singleton — that's what lets the `WeakSet` guard do its job, and
it avoids reconstructing the client (and its typed methods) on every import.

Every method returns the raw `Promise<AxiosResponse<TResponse>>` — callers
unwrap it with `.then((response) => response.data)` to get to `TResponse`
itself. Since the full-SSR migration (`docs/MIGRATION_TO_FULL_SSR.md`), that
caller is a feature's `actions.ts` (a `"use server"` function), not
`hooks/query.ts` directly — the hook calls the action instead of the client.
See "Mutations: the auth feature" in `SETUP_REACT_QUERY.md` for why skipping
that unwrap is a type error, not a runtime bug.

Only pass a custom instance to the constructor when you deliberately need
isolation from the shared instance — e.g. a client for a *different* backend
that shouldn't get the session-cookie auth header at all. Anything hitting
the same API should go through the default `apiClient`.

## `ApiInterceptor`

`ApiInterceptor` wraps one `AxiosInstance` and registers a single request
interceptor that runs three checks, in order, before every request leaves:

```ts
this.instance.interceptors.request.use(async (config) => {
  if (this.isBuildPhase()) {
    throw new BuildPhaseSkippedError(config.url);
  }

  await this.addAuthorizationHeader(config);
  await this.addTimezoneHeader(config);
  return config;
});
```

### 1. Build-phase guard

`next build` executes Server Components at build time to statically generate
pages. If a component fetches from your own backend during that phase, the
request either hits a backend that isn't running in the build environment or
bakes stale data into the static output. `isBuildPhase()` detects this via
`NEXT_PHASE === "phase-production-build"` and throws
`BuildPhaseSkippedError` before the request is even sent.

This is a signal, not a failure to swallow silently — callers (or a
higher-level fetch wrapper) can catch `BuildPhaseSkippedError` specifically
to render a fallback/loading state during static generation, while letting
any other error propagate normally.

### 2. Authorization header

Since the full-SSR migration (`docs/MIGRATION_TO_FULL_SSR.md`), every request
that reaches `apiClient` originates from a Server Action or a Server
Component — nothing in the browser calls a `feature/*/client.ts` method
directly anymore — so `addAuthorizationHeader()` only has one path:
`next/headers`' `cookies()`, which is async.

The `try/catch` around `cookies()` isn't for a real auth failure — it's
because Next.js signals "this route can't be statically rendered" by
*throwing* a special error (`digest === "DYNAMIC_SERVER_USAGE"`) the moment
`cookies()` is called during static generation. That specific error is
re-thrown so Next can correctly bail the route out of static rendering;
anything else calling into `cookies()` unexpectedly failing is treated as "no
token available" rather than crashing the request, since a logged-out
request is a perfectly valid state (the backend will reject it with 401, not
the interceptor).

The session cookie itself is `httpOnly` (`feature/auth/session.ts`) — closing
`docs/IMPROVEMENT_OPPORTUNITIES.md` §1.1 — precisely because nothing needs to
read it from `document.cookie` anymore.

### 3. Timezone header

`X-Timezone` can't be read with `Intl.DateTimeFormat()` at request time
anymore, since the request itself now runs on the server, where the
process' timezone isn't the *user's*. Instead, `lib/timezone-sync.tsx` — a
client component mounted once in `app/[locale]/layout.tsx` — writes the
visitor's IANA timezone into a (non-sensitive, non-httpOnly) cookie on first
render. `addTimezoneHeader()` reads that cookie server-side via
`next/headers`' `cookies()`, the same way it reads the session token, and
simply omits the header if the cookie hasn't been set yet (e.g. a request
made before the client component has mounted); the backend should treat a
missing `X-Timezone` as "unknown" rather than assuming UTC or erroring.

## Response interceptor

`setupResponseInterceptors()` is registered in the constructor alongside
`setupRequestInterceptors()` and handles two things on every response:

1. **401 → logout.** On a `401`, `handleUnauthorized()` runs
   `window.location.href = "/logout"` (client-side only — a no-op on the
   server, since there's nowhere to redirect a static/RSC render to). This
   closes the gap that used to exist here: a stale/expired session used to
   fail silently per-screen with no recovery path. `feature/auth/components/session-guard.tsx`
   pairs with this by calling `useProfileQuery()` on every protected page
   purely to *trigger* a 401 early if the session is already invalid, rather
   than waiting for the user's next real action to discover it.
2. **Structured logging.** Every request/success/failure is logged via
   `lib/logger.ts` (server-side only) with a `requestId` correlating the
   three log lines for one call, plus timing and device info. See
   `docs/SETUP_LOGGING.md` for the full shape and its PII-redaction rules.

`BuildPhaseSkippedError` is passed through unlogged and unhandled by the
401 check — it's a signal for build-time skips, not a real HTTP failure.

## Adding a new cross-cutting concern

To add another interceptor behavior (e.g. a retry-on-401-refresh flow, or a
new response-side check), add a private method to `ApiInterceptor` and call
it from `setupRequestInterceptors`/`setupResponseInterceptors`, in the same
style as `addAuthorizationHeader`/`addClientTimezoneHeader`/`handleUnauthorized`.
Keep it here rather than in a resource client — anything that should apply
to *every* request belongs in the interceptor, not duplicated per client.
