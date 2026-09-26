# Auth Route Groups

How the portal separates paths that require a signed-in session from paths
that don't: two [route groups](../app/[locale]) organize the folders, one
shared list decides which paths belong to which, and two independent checks
enforce it.

Files:
- [feature/auth/route-config.ts](../feature/auth/route-config.ts) — the
  single source of truth for which paths are protected vs. auth-only.
- [proxy.ts](../proxy.ts) — edge-level redirect, runs before every matched
  request.
- [feature/auth/dal.ts](../feature/auth/dal.ts) — `verifySession()`, the
  render-time check.
- [app/[locale]/(protected)/layout.tsx](../app/[locale]/(protected)/layout.tsx)
  — wires `verifySession()` into every page under `(protected)`.
- [app/[locale]/(public)/](../app/[locale]/(public)/),
  [app/[locale]/(protected)/](../app/[locale]/(protected)/) — where pages
  actually live: home/login/register vs. dashboard.

## Why this shape

A route group — a folder wrapped in parens, e.g. `(protected)` — is purely
organizational: Next.js strips it from the URL, so
`app/[locale]/(protected)/dashboard/page.tsx` still serves `/en/dashboard`,
not `/en/(protected)/dashboard`. That means the groups can't enforce anything
by themselves; they only give the auth boundary a place to live in the file
tree, and let `(protected)` carry a shared `layout.tsx` that `(public)`
doesn't.

Enforcement is what actually keeps someone out, and it happens in two places
on purpose:

```
Request for /en/dashboard
   │
   ▼
proxy.ts                    (edge, every request, cookie presence only)
   │  no session cookie → redirect to /login
   │  session cookie present → continue
   ▼
(protected)/layout.tsx → verifySession()   (render time, per page)
   │  no session cookie → redirect to /login
   │  session cookie present → render children
   ▼
Dashboard page renders, fetches accounts
   │  token invalid/expired → backend returns 401
   ▼
Backend is the actual source of truth on whether the token is valid
```

`proxy.ts` is fast and centralized but only ever does an *optimistic* check —
it reads the cookie off the request, it never calls the backend. Next.js's
own guidance is not to rely on that alone: prefetches, direct RSC renders,
and Server Actions all have paths that can reach a page without necessarily
re-running the proxy's redirect logic the way a full navigation does. So
`(protected)/layout.tsx` repeats the same check next to the actual render,
independent of the proxy. Neither check calls the backend to validate the
token itself — that's intentionally left to the API request the page makes
next; a stale or forged token still gets rejected there with a 401. Adding a
real "is this token still valid" check to the DAL (e.g. calling
`authClient.getProfile()`) is a reasonable next step if a page ever needs
that stronger guarantee, at the cost of an extra network round-trip on every
protected render.

## `feature/auth/route-config.ts`

```ts
export const PROTECTED_PATH_PREFIXES = ["/dashboard"];
export const AUTH_ONLY_PATHS = ["/login", "/register"];
```

Both `proxy.ts` and any future server-side check import these instead of
declaring their own copies. Paths here are locale-stripped (`/dashboard`, not
`/en/dashboard`) because `proxy.ts` strips the locale prefix before matching
— see `splitLocale()` below.

- `PROTECTED_PATH_PREFIXES` — signed-out users get redirected to `/login`.
  Matched with `startsWith`, so it covers nested routes under the prefix too.
- `AUTH_ONLY_PATHS` — signed-in users get redirected to `/dashboard` instead
  (no reason to show a login/register form to someone already logged in).
  Matched exactly, since these are single pages, not prefixes.

## `proxy.ts`

```ts
function splitLocale(pathname: string): { locale: AppLocale | null; path: string } {
  // strips the /en or /id prefix, e.g. "/en/dashboard" -> "/dashboard"
}

export default function proxy(request: NextRequest) {
  const { locale, path } = splitLocale(request.nextUrl.pathname);
  const isAuthenticated = Boolean(request.cookies.get(SESSION_COOKIE_NAME)?.value);

  if (!isAuthenticated && PROTECTED_PATH_PREFIXES.some((p) => path.startsWith(p))) {
    // redirect to /{locale}/login
  }

  if (isAuthenticated && AUTH_ONLY_PATHS.includes(path)) {
    // redirect to /{locale}/dashboard
  }

  return intlMiddleware(request); // next-intl's locale routing runs last
}
```

Locale has to be split out *before* matching against
`route-config.ts`, because the proxy sees the full `/en/dashboard` path but
the config only knows about the locale-agnostic `/dashboard`. `intlMiddleware`
(from `next-intl`) runs after the auth checks — it only handles locale
detection/rewriting, not authentication, so it has nothing to do with which
paths are protected.

The `config.matcher` at the bottom (`/((?!api|_next|_vercel|.*\\..*).*)`)
excludes API routes, Next internals, and static files with extensions —
without it, the proxy would also run (and redirect) on every asset request.

## `feature/auth/dal.ts` + `(protected)/layout.tsx`

```ts
// feature/auth/dal.ts
export const verifySession = cache(async (locale: AppLocale) => {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) redirect({ href: "/login", locale }); // next-intl's redirect, throws
  return { token };
});
```

`cache()` (from `react`) memoizes per render pass, so if multiple components
under the same protected page call `verifySession()`, the cookie is only read
once. `redirect()` (from `@/i18n/navigation`, not `next/navigation`) is used
so the redirect target is locale-prefixed the same way the rest of the app's
navigation is — it throws (return type `never`), so `verifySession()` can
still be typed as returning `{ token }` for the authenticated path.

```tsx
// app/[locale]/(protected)/layout.tsx
export default async function ProtectedLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  await verifySession(locale); // redirects before children ever render
  return children;
}
```

`LayoutProps<"/[locale]">`, not `LayoutProps<"/[locale]/dashboard">` — a
layout's type parameter is keyed by the layout file's *own* segment (route
groups don't count), not by the pages nested under it. The root layout at
`app/[locale]/layout.tsx` uses the same `"/[locale]"` key; Next.js dedupes
them because a route group doesn't introduce a new URL segment.

Because this is a layout, it runs for every page placed under
`(protected)/`, without each page having to remember to call
`verifySession()` itself — the dashboard page does its own separate
`hasLocale`/`notFound`/`setRequestLocale` calls (matching the pattern every
page in this app already follows), but the auth check itself lives once, in
the layout.

## Adding a new route

**Protected** (needs a session): add the page under
`app/[locale]/(protected)/`. It automatically inherits the layout's
`verifySession()` guard — nothing else to wire up. If it should also block
direct/prefetched access before React even starts rendering, add its
locale-stripped prefix to `PROTECTED_PATH_PREFIXES` in `route-config.ts` too.

**Public** (no session required): add the page under
`app/[locale]/(public)/`. If it's specifically a signed-out-only page like
login/register — one that a logged-in user shouldn't see — add its exact
locale-stripped path to `AUTH_ONLY_PATHS` so the proxy bounces authenticated
users to `/dashboard` instead of showing it. Anything else public (e.g. a
marketing page) needs no entry in either list.
