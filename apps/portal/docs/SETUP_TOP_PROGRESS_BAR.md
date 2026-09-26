# Top Progress Bar — As Implemented

## Who this doc is for

You should be comfortable with React hooks and this app's existing
TanStack Query setup (`SETUP_REACT_QUERY.md`). You don't need prior experience
with the App Router's client-navigation internals — [Section 0](#section-0--background-primer)
covers the part of it that isn't obvious from the hook API surface, and is
the reason this feature isn't built the "obvious" way.

This doc is verified against the source in this repo, not the intended
design — every real claim below cites a `file:line`. The first working
version of this feature had a real bug (a permanently-stuck bar), found by
driving the actual app in a headless browser rather than by reading the code.
That bug and the fix are documented as their own section, not smoothed over,
because the reasoning is the whole point of why the code looks the way it
does.

## Section 0 — Background Primer

| Approach | Fires... | Reliability in this Next.js version |
| --- | --- | --- |
| Patch `window.history.pushState`/`replaceState` | whenever the router changes the URL | **Unreliable here** — this app's Next.js version (16.3.3) updates its internal `usePathname()`/`useSearchParams()` state *before* it gets around to calling `history.pushState`, not after |
| Listen for `usePathname()`/`useSearchParams()` changes | once the router has committed the new route | Reliable, but only as an *end* signal — by the time it fires, the route has already changed, so it's too late to also be the *start* signal |
| Intercept `<a>` clicks (capture phase) | the instant the user clicks, before React or Next touch anything | Reliable **as a start signal** — nothing can process the click before a capture-phase `document` listener does |

**The gotcha that isn't obvious from the hook API surface:** the natural
design is "patch history for start, watch pathname for end" — that's how
libraries like nprogress traditionally hook into a router. It doesn't work
here because the two signals aren't ordered the way you'd assume. See
[Section 3](#section-3--the-bug-a-stuck-bar-and-why-clicks-not-history-are-the-start-signal)
for the concrete timeline that proves it and the fix that came out of it.

## Section 1 — Architecture at a Glance

The composition root is `app/[locale]/layout.tsx:63`, where `<TopProgressBar />`
is mounted once, inside `QueryProvider` and above `{children}`. The root
layout implements none of the bar's logic — it only wires the component into
the tree once, above every route, the same way `SETUP_REACT_QUERY.md`'s
`QueryProvider` is wired in immediately above it.

| Concern | Owner (file/hook) | Analogy |
| --- | --- | --- |
| Detecting "a navigation started" | `useIsNavigating` (`components/common/top-progress-bar.tsx:34-61`) | The doorbell — fires the instant someone's at the door, before anyone answers |
| Detecting "fetching/mutating is in flight" | `useIsFetching()` / `useIsMutating()` (`top-progress-bar.tsx:65-66`) | Checking whether the kitchen still has orders on the board |
| Combining both into one boolean | `active` (`top-progress-bar.tsx:67`) | The "occupied" sign — on if *either* signal is on |
| Animating the bar's width/opacity | the second `useEffect` in `ProgressBarInner` (`top-progress-bar.tsx:74-104`) | The actual dimmer switch, driven imperatively, not through React state |
| Rendering the fixed-position bar + `Suspense` wrapper | `ProgressBarInner` / `TopProgressBar` (`top-progress-bar.tsx:106-125`) | The light fixture itself |

It's split this way (navigation detection separate from fetch detection,
both separate from the animation) so each concern can be reasoned about and
fixed independently — which mattered directly: the bug in
[Section 3](#section-3--the-bug-a-stuck-bar-and-why-clicks-not-history-are-the-start-signal)
was entirely inside `useIsNavigating` and required no changes to the
animation code or the fetch detection at all.

## Section 2 — What actually turns the bar on

**The problem this solves:** the user asked for the bar to show for two
distinct things — "when navigation happens" and "when fetching happens" —
and those need two different detection mechanisms, since one is a route
change and the other is a data request already tracked by TanStack Query.

**How it's implemented.** `ProgressBarInner` (`top-progress-bar.tsx:63-67`)
computes one combined boolean:

```tsx
// components/common/top-progress-bar.tsx:64-67
const navigating = useIsNavigating();
const isFetching = useIsFetching();
const isMutating = useIsMutating();
const active = navigating || isFetching > 0 || isMutating > 0;
```

| Signal | Source | What counts |
| --- | --- | --- |
| `navigating` | `useIsNavigating()` — clicks + back/forward, see Section 3 | Any in-app link click or browser back/forward that targets a different URL |
| `isFetching` | `useIsFetching()`, no `queryKey` filter | **Every** active `useQuery` anywhere in the app, not just one feature's |
| `isMutating` | `useIsMutating()`, no `queryKey` filter | **Every** active `useMutation` anywhere in the app — e.g. the login/register calls in `feature/auth/hooks/query.ts` |

Because `useIsFetching`/`useIsMutating` are called with no filter argument,
this bar reacts to *any* query or mutation in the app, not just ones on the
current page — a deliberate choice, since the bar's whole purpose is a
single global "something is happening" signal, not a per-feature one.

## Section 3 — The bug: a stuck bar, and why clicks (not history) are the start signal

**The problem this solves:** the first version of `useIsNavigating` patched
`window.history.pushState`/`replaceState` to detect "a navigation just
started," dispatching a custom event from inside the patched function:

```ts
// the original (buggy) approach — not in the current source
for (const method of ["pushState", "replaceState"] as const) {
  const original = window.history[method];
  window.history[method] = function (...args) {
    window.dispatchEvent(new Event("nav-progress-start"));
    return original.apply(this, args);
  };
}
```

Paired with a render-time check that resets `navigating` to `false` once
`usePathname()`/`useSearchParams()` reflect the new route.

**How it actually failed.** Driving the real app in a headless browser
(Playwright against the dev server, clicking an in-app link from `/en` to
`/en/login`) and logging every render of `useIsNavigating` plus every
`history.pushState` call, with real timestamps, showed this order:

```
t=815653  render: currentKey="/en/login?"  settledKey="/en?"        -> resets navigating to false (key already changed!)
t=815657  render: currentKey="/en/login?"  settledKey="/en/login?"  -> no-op, already settled
t=815670  render: currentKey="/en/login?"  settledKey="/en/login?"  -> no-op, already settled
t=815679  event:  "nav-progress-start" fires from the patched pushState
t=815692  render: navigatingIn=true, currentKey === settledKey      -> nothing to reset it, stays true forever
```

**This is worth slowing down on.** The pathname/searchParams context had
already updated to the new route *before* `history.pushState` was even
called — three renders earlier. So the "start" event arrived after the
"end" condition had already been checked and resolved. Once that happens,
`navigating` gets set back to `true` with no future pathname change left to
reset it, and the bar sits at ~90% width forever — confirmed by polling the
DOM's inline `style` attribute every 500ms for 10 seconds straight and
watching it plateau rather than complete.

**The fix** replaces the history patch with a capture-phase `document` click
listener plus a `popstate` listener:

```tsx
// components/common/top-progress-bar.tsx:11-32, 46-58
function isNavigableClick(event: MouseEvent) {
  if (event.defaultPrevented || event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return false;
  }

  const anchor = (event.target as HTMLElement | null)?.closest("a");
  if (!anchor || !anchor.href) return false;
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.hasAttribute("download")) return false;

  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return false;
  if (
    url.pathname === window.location.pathname &&
    url.search === window.location.search
  ) {
    return false;
  }

  return true;
}

// ...

useEffect(() => {
  const start = () => setNavigating(true);
  const onClick = (event: MouseEvent) => {
    if (isNavigableClick(event)) start();
  };

  document.addEventListener("click", onClick, true);
  window.addEventListener("popstate", start);
  return () => {
    document.removeEventListener("click", onClick, true);
    window.removeEventListener("popstate", start);
  };
}, []);
```

A capture-phase `document` listener (the trailing `true` in
`addEventListener`) runs before Next's own `<Link>` click handler — a click
always precedes any router processing, so `setNavigating(true)` is
guaranteed to land in a render *before* the pathname context can possibly
update. That ordering guarantee is exactly what the history-patch approach
lacked.

`isNavigableClick` filters out anything that isn't a plain, same-origin,
same-tab, actually-different-URL left-click, so modifier-key clicks
(open-in-new-tab), external links, `download` links, and same-page anchor
clicks never light up the bar.

**The render-time settle check didn't need to change** — it was never the
buggy half:

```tsx
// components/common/top-progress-bar.tsx:37-44
const currentKey = `${pathname}?${searchParams}`;
const [navigating, setNavigating] = useState(false);
const [settledKey, setSettledKey] = useState(currentKey);

if (currentKey !== settledKey) {
  setSettledKey(currentKey);
  setNavigating(false);
}
```

This is React's documented "adjust state when a prop/derived value changes"
pattern — a conditional `setState` call directly in the render body, not
inside a `useEffect`. It's what let the fix be a pure swap of the *start*
signal without touching the *end* logic at all.

**Re-verified after the fix** the same way the bug was found: repeatedly
polling the bar's inline `style` attribute across three chained navigations
(`home → login → register → home`). Each hop now shows the bar jump to a
partial width immediately, then complete to `100%` before fading to
`opacity: 0` — no plateau, no stuck state, zero console errors across all
three hops.

## Section 4 — Animating the bar without re-render churn

**The problem this solves:** an animated progress bar needs frequent width
updates (every `200ms` while trickling). Driving that through React state
would re-render `ProgressBarInner` on every tick for no reason — the bar's
own `<div>` is the only thing that ever needs to change.

**How it's implemented.** The bar's width and opacity are written directly
to the DOM node via a `ref`, inside a single `useEffect` keyed on `active`:

```tsx
// components/common/top-progress-bar.tsx:74-104
useEffect(() => {
  const setBar = (width: number, opacity: number) => {
    widthRef.current = width;
    const el = barRef.current;
    if (!el) return;
    el.style.width = `${width}%`;
    el.style.opacity = `${opacity}`;
  };

  if (trickleRef.current) clearInterval(trickleRef.current);
  if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);

  if (active) {
    setBar(Math.max(widthRef.current, 8), 1);
    trickleRef.current = setInterval(() => {
      const remaining = TRICKLE_TARGET - widthRef.current;
      if (remaining <= 0) return;
      setBar(widthRef.current + Math.max(0.5, remaining / 12), 1);
    }, TRICKLE_INTERVAL_MS);
  } else if (widthRef.current > 0) {
    setBar(100, 1);
    hideTimeoutRef.current = setTimeout(() => {
      setBar(0, 0);
    }, COMPLETE_DELAY_MS);
  }

  return () => {
    if (trickleRef.current) clearInterval(trickleRef.current);
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
  };
}, [active]);
```

| Constant | Value (`top-progress-bar.tsx:7-9`) | What it controls |
| --- | --- | --- |
| `TRICKLE_INTERVAL_MS` | `200` | How often the bar advances while `active` is `true` |
| `TRICKLE_TARGET` | `90` | The ceiling the trickle approaches but never reaches on its own — the last `10%` only happens on completion |
| `COMPLETE_DELAY_MS` | `250` | How long the bar sits at `100%` before fading to `opacity: 0` |

The trickle's step size (`remaining / 12`, floored at `0.5`) is a classic
ease-out curve: large jumps early, smaller ones as it nears `90%`, so the
bar never visibly "arrives" while a request is genuinely still pending.

**Worth knowing:** `widthRef` (not React state) is the source of truth for
the current width — reading it back inside the `setInterval` closure avoids
stale-closure bugs without needing `width` in any dependency array. This is
also why `active` is the *only* effect dependency: the effect doesn't need
to re-run when the width itself changes, only when the underlying
navigating/fetching state flips.

## Component/presentational layer

`ProgressBarInner` (`top-progress-bar.tsx:63-117`) is the only piece with
logic. It renders a fixed, `aria-hidden`, `pointer-events-none` wrapper
`<div>` (`top-progress-bar.tsx:106-116`) so the bar can never intercept
clicks or be announced to screen readers, with the animated bar as its only
child. `TopProgressBar` (`top-progress-bar.tsx:119-125`) is a thin wrapper
that exists for exactly one reason — see the callout below.

**Why the `Suspense` wrapper exists:** `useSearchParams()` requires the
component calling it to sit inside a `<Suspense>` boundary, or a client
navigation opts the whole route into client-side rendering up to the nearest
one — the same requirement Next's own `NavigationEvents` docs example calls
out. `TopProgressBar` wraps `ProgressBarInner` in `<Suspense fallback={null}>`
purely to satisfy that, with a `null` fallback since there's nothing
meaningful to show before the bar's own state exists.

## Cross-feature coupling

- **Reacts to every feature's queries and mutations, not just one.** Because
  `useIsFetching()`/`useIsMutating()` are called with no key filter
  (Section 2), any new `useQuery`/`useMutation` added anywhere in the app —
  `feature/account`, `feature/account-manage`, `feature/account-transaction`,
  `feature/auth` — automatically lights up this bar. Nothing needs to be
  wired per-feature; that's also the risk to know about: a feature that adds
  a long-lived background poll (a `refetchInterval`) would keep this bar
  trickling for as long as that poll runs.
- **Mounted above `QueryProvider`'s children, inside its provider.**
  `app/[locale]/layout.tsx:62-65` places `<TopProgressBar />` *inside*
  `<QueryProvider>`, not above it — it must be, since `useIsFetching`/
  `useIsMutating` need the `QueryClientProvider` context `QueryProvider`
  supplies (`providers/query-provider.tsx`, per `SETUP_REACT_QUERY.md`).
  Moving the bar above `QueryProvider` in the tree would break it silently
  (the hooks would throw, since there'd be no `QueryClient` in context).

## Summary / data flow

```
User clicks an in-app <a> (or presses back/forward)
   │  capture-phase `document` click listener fires first — before Next's <Link> handler
   ▼
useIsNavigating() → setNavigating(true)
   │
   ▼
active = navigating || isFetching > 0 || isMutating > 0   → true
   │
   ▼
animation effect: bar jumps to 8%, then trickles toward 90% every 200ms
   │
   │  (meanwhile) usePathname()/useSearchParams() eventually reflect the new route
   ▼
render-time check: currentKey !== settledKey → setNavigating(false)
   │
   │  (independently) any in-flight useQuery/useMutation still pending keeps `active` true
   ▼
active → false once navigation has settled AND no query/mutation is pending
   │
   ▼
animation effect: bar snaps to 100%, waits 250ms, fades to opacity 0
```

## Verification performed

- `npx tsc --noEmit` — clean.
- `npx eslint components/common/top-progress-bar.tsx "app/[locale]/layout.tsx"` — clean
  (including `react-hooks/set-state-in-effect`, which the first draft of the
  animation effect tripped before moving the state directly onto the DOM via
  `ref` instead of `useState`).
- Drove the real dev server with a headless Chromium (via Playwright)
  against `/en`, `/en/login`, and `/en/register` — no backend/`core-service`
  required, since these are public routes:
  - Confirmed the original history-patch approach produced a bar stuck at a
    plateaued width forever, with timestamped render/event logs proving the
    ordering bug described in Section 3.
  - Confirmed the click/`popstate`-based fix completes and fades out
    correctly across three chained navigations, with **zero console
    errors**, by polling the bar's inline `style` attribute every 500ms.
