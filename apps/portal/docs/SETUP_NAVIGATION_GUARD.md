# Navigation Guard — As Implemented

## Who this doc is for

You should be comfortable with React hooks, Zustand, and this app's routing
setup (`@/i18n/navigation`'s `Link`/`useRouter`, see
`SETUP_AUTH_ROUTE_GROUPS.md` for the broader routing picture). You don't need
prior experience fighting the browser's History API — [Section
0](#section-0--background-primer) covers the two ways a user can "leave" a
page and why one of them needs `popstate`, not just a click handler.

This doc is verified against the source in this repo, not the intended
design — every real claim below cites a `file:line`. The first working
version of the browser back/forward interception had a real bug (a silent
address-bar/rendered-page desync), found by driving the actual app in a
headless browser rather than by reading the code. That bug and the fix are
documented as their own section, not smoothed over, because the reasoning is
the whole point of why the code looks the way it does.

## Section 0 — Background Primer

There are two independent ways a user can leave a page with unsaved work:

| Way to leave | Who can intercept it | Mechanism used here |
| --- | --- | --- |
| Tab close, refresh, typing a new URL, closing the browser | Only the browser itself, via a native prompt | `beforeunload` |
| Clicking an in-app link, or pressing the browser's back/forward buttons while staying in the SPA | The app itself, since it owns client-side routing | A shared Zustand store + intercepting clicks/`popstate` |

Next.js App Router (unlike React Router) has **no built-in "block this route
change" API** — every link click and every `router.push` call has to
voluntarily check a shared flag before navigating, and back/forward has to
be caught via the low-level `popstate` event.

**The gotcha that isn't obvious from the `popstate` API surface:** the
naive approach is "listen for `popstate`, and if guarded, immediately push
the URL back with `history.pushState`." That's exactly what a framework-
agnostic implementation of this pattern does, and it's also what this app's
first draft did — but Next.js App Router has its **own** internal `popstate`
listener that renders whatever route the browser just navigated to,
independently of the raw History API. By the time this app's own listener
pushes the URL back, Next has already swapped the rendered page underneath,
so the address bar says one route while the screen shows another. [Section
4](#section-4--the-provider-shared-dialog--browserback-forward-interception)
has the concrete before/after screenshots that proved it and the fix that
came out of it.

## Section 1 — Architecture at a Glance

The composition root is `app/[locale]/layout.tsx:62`, where
`<NavigationGuardProvider />` is mounted once, inside `QueryProvider` and
alongside `<TopProgressBar />` (`SETUP_TOP_PROGRESS_BAR.md`). The root layout
implements none of the guard's logic — it only wires the provider into the
tree once, above every route, the same way every other app-wide provider is
wired in.

| Concern | Owner (file) | Analogy |
| --- | --- | --- |
| Single source of truth for "is navigation currently blocked," dialog copy, and the deferred navigate callback | `useNavigationGuardStore` (`components/common/navigation-guard/store.ts`) | The building's front-desk sign-in sheet — one shared record of who's allowed through right now |
| The native "are you sure?" prompt for tab close/refresh | `useUnsavedChangesWarning` (`components/common/navigation-guard/use-unsaved-changes-warning.ts`) | The fire alarm — a blunt, browser-owned signal the app can arm but not customize |
| Rendering the one shared confirm dialog, arming `beforeunload`, and defeating back/forward | `NavigationGuardProvider` (`components/common/navigation-guard/provider.tsx`) | The front desk itself — the only place that actually turns visitors away or lets them through |
| Intercepting clicks on a specific link | `GuardedLink` (`components/common/navigation-guard/guarded-link.tsx`) | A single guarded door — checks the sign-in sheet before opening |
| Arming/disarming the guard for one screen | `RegisterFormScreen`'s effect (`components/auth/register-form-screen.tsx:49-52`) | A tenant notifying the front desk "I'm mid-delivery, don't let anyone through yet" |

It's split this way — global state, native-prompt hook, provider, and
link-wrapper as four separate pieces — so a screen only ever needs to touch
the store (`setGuard`) and, if it renders its own links, `GuardedLink`. It
never needs to know how `popstate`/`beforeunload` actually work, which
mattered directly: the bug in
[Section 4](#section-4--the-provider-shared-dialog--browserback-forward-interception)
was entirely inside the provider and required no changes to the store, the
hook, `GuardedLink`, or any consuming screen.

## Section 2 — The store: single source of truth

**The problem this solves:** any number of unrelated things can try to
navigate away — a `GuardedLink` click, a browser back press, a future
sidebar link, a future "cancel upload" button — and all of them need to ask
the same question ("is something guarded right now?") and defer to the same
confirm dialog if so. A single global store is the only way to make that
consistent without wiring every navigation call site to every screen.

**How it's implemented.** `useNavigationGuardStore` (`store.ts:26-55`) holds
three pieces of state and four actions:

```ts
// components/common/navigation-guard/store.ts:16-24
interface NavigationGuardState {
  isGuarded: boolean;
  options: NavigationGuardOptions | null;
  pendingNavigation: (() => void) | null;
  setGuard: (isGuarded: boolean, options?: NavigationGuardOptions) => void;
  requestNavigation: (navigate: () => void) => void;
  confirmLeave: () => void;
  cancelLeave: () => void;
}
```

| Field/action | What it actually does |
| --- | --- |
| `isGuarded` | Whether *something* currently wants to block navigation. Set by a screen via `setGuard`. |
| `options` | Dialog copy (`title`/`description`/`confirmLabel`/`cancelLabel`/`hideCancelButton`) plus an `onAbort` cleanup callback (`store.ts:3-14`) — `null` whenever `isGuarded` is `false` (`store.ts:32-36`). |
| `pendingNavigation` | The deferred "actually navigate" callback. **This, not `isGuarded`, is what drives the dialog's `open` state** (`provider.tsx:84`) — being guarded shouldn't show a dialog until the user actually tries to leave. |
| `requestNavigation(navigate)` | The single interception point (`store.ts:38-44`): if guarded, stashes `navigate` as `pendingNavigation` instead of running it; otherwise runs it immediately. |
| `confirmLeave()` | Runs `options.onAbort` (if any), fully resets the guard, then calls `pendingNavigation` (`store.ts:46-51`). |
| `cancelLeave()` | Only clears `pendingNavigation` — leaves `isGuarded`/`options` untouched, since the user chose to stay, not to stop being guarded (`store.ts:53`). |

**Worth knowing:** `setGuard(false)` is called both by a screen's own effect
cleanup (unmount) and, in `RegisterFormScreen`, explicitly right before a
successful-registration redirect (`register-form-screen.tsx:74`) — see the
cross-feature coupling section for why that explicit call is necessary and
not redundant.

## Section 3 — `useUnsavedChangesWarning`: the native prompt

**The problem this solves:** tab close, refresh, and address-bar navigation
happen entirely outside any SPA router's control — the only hook available
is the browser's own `beforeunload` event.

**How it's implemented** — the entire hook (`use-unsaved-changes-warning.ts:11-24`):

```ts
// components/common/navigation-guard/use-unsaved-changes-warning.ts:11-24
export function useUnsavedChangesWarning(hasUnsavedChanges: boolean) {
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () =>
      window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);
}
```

**If you're new to `beforeunload`:** setting `returnValue` and calling
`preventDefault()` is a legacy dance — modern browsers ignore whatever
string you put in `returnValue` and show their own fixed, unlocalizable
"Leave site? Changes you made may not be saved" text. There is no way to
show this app's own dialog copy here; that's why the shared dialog
(Section 4) only covers in-app navigation, and `beforeunload` is a separate,
cruder fallback layered on top.

This hook is intentionally standalone and doesn't know about the store — the
provider calls it with `isGuarded` (Section 4), so browser-close protection
is automatic whenever anything arms the guard, with no extra wiring per
screen.

## Section 4 — The provider: shared dialog + browser back/forward interception

**The problem this solves:** two things need exactly one implementation
each, no matter how many screens use the guard — the confirm dialog itself,
and catching the browser's back/forward buttons.

**How the dialog is implemented.** `pendingNavigation !== null` drives
`open` (`provider.tsx:82-88`); the two buttons read their labels from
`options`, falling back to the `common` i18n namespace:

```tsx
// components/common/navigation-guard/provider.tsx:97-110
<DialogFooter>
  {!hideCancelButton && (
    <Button type="button" variant="outline" onClick={cancelLeave}>
      {options?.cancelLabel ?? t("cancel")}
    </Button>
  )}
  <Button
    type="button"
    variant="destructive"
    onClick={hideCancelButton ? cancelLeave : confirmLeave}
  >
    {options?.confirmLabel ?? t("leave")}
  </Button>
</DialogFooter>
```

**Worth knowing — the single-button dialog style.** When `hideCancelButton`
is `true` (for a future "a process is running" case, not currently used by
any screen), the *only* button calls `cancelLeave()`, not `confirmLeave()`
(`provider.tsx:106`) — it's an acknowledgment that keeps the user on the
page, not a way to leave. Getting this backwards would let a single "OK"
button silently discard whatever the guard was protecting.

### The bug: `popstate` interception silently desynced the rendered page

**The first version** (matching the naive, framework-agnostic pattern)
reacted to `popstate` after the fact:

```ts
// the original (buggy) approach — not in the current source
const handlePopState = () => {
  const state = useNavigationGuardStore.getState();
  if (!state.isGuarded || !state.guardedUrl) return;

  window.history.pushState(null, "", state.guardedUrl);
  state.requestNavigation(() => window.history.back());
};
```

**How it actually failed.** Driving the real dev server in a headless
Chromium (Playwright): loaded `/en/login`, clicked the in-app link to
`/en/register` (an SPA transition, not a full reload), typed into the
username field to dirty the form, then pressed the browser back button.
`page.url()` correctly reported `/en/register` afterward — the `pushState`
call had done its job on the address bar — but a screenshot of the actual
page showed the **login form**, not the register form, with the typed
username gone:

> Screenshot showed: URL bar-equivalent state = `/en/register`, rendered
> page = the Login card (email/password fields, "Login" button) — a real
> address-bar/DOM desync, not a screenshot artifact.

**This is worth slowing down on.** Next.js App Router has its own `popstate`
listener (part of its client-side router) that reacts to the *same* browser
back press and renders whatever route the URL pointed to at that moment —
in this case, `/en/login`. That listener doesn't know or care that this
app's own `handlePopState` above ran too and quietly changed
`window.location` back to `/en/register` via a raw `pushState` call
immediately after. Next's router had already committed to rendering the
login route by then, and a raw History API mutation from outside Next's own
router doesn't make Next re-render — it only changes what the address bar
*says*. The result: `pendingNavigation` gets set and the dialog *does* open,
but underneath it the wrong page (and its state) is already gone.

**The fix** replaces "react after the pop, then push the URL back" with
"push a duplicate entry the moment the guard arms, before any back press
happens at all":

```tsx
// components/common/navigation-guard/provider.tsx:35-78
useEffect(() => {
  if (!isGuarded) return;
  window.history.pushState(null, "", window.location.href);
}, [isGuarded]);

useEffect(() => {
  const handlePopState = () => {
    if (allowNextPopRef.current) {
      allowNextPopRef.current = false;
      return;
    }
    if (restoringSentinelRef.current) {
      restoringSentinelRef.current = false;
      return;
    }

    const state = useNavigationGuardStore.getState();
    if (!state.isGuarded) return;

    restoringSentinelRef.current = true;
    window.history.forward();

    state.requestNavigation(() => {
      allowNextPopRef.current = true;
      window.history.go(-2);
    });
  };

  window.addEventListener("popstate", handlePopState);
  return () => window.removeEventListener("popstate", handlePopState);
}, []);
```

Because the duplicate entry is pushed *before* any back press, the first
back press only ever moves between two entries with the **identical URL**
(`/en/register` → `/en/register`) — harmless even if Next's router reacts to
it, since it would just re-render the same route. Only once the user
actually confirms leaving does `window.history.go(-2)` (past the duplicate,
past the real entry it duplicated) let the browser genuinely navigate to the
different route, at which point the guard has already disarmed and nothing
fights Next's router.

| Ref | Purpose |
| --- | --- |
| `restoringSentinelRef` | Set right before calling `history.forward()` to undo a pop; the resulting `popstate` from that `forward()` call is swallowed by this flag instead of being treated as another real back press. |
| `allowNextPopRef` | Set right before the confirmed `history.go(-2)`; lets that navigation's `popstate` through as an intentional leave instead of re-arming the block. |

**Why `forward()` and not another `pushState`, on every cancelled attempt:**
an earlier fix attempt pushed a *new* duplicate entry on every cancel
instead of reusing the one already there. That accumulates one extra
history entry per cancellation, so after several cancels, a single
`history.back()` on confirm no longer reaches the real previous page — it
only unwinds one of the piled-up duplicates. `history.forward()` instead
moves onto the *existing* sentinel (no new entry created), so no matter how
many times a user cancels, there is always exactly one duplicate to unwind,
and `go(-2)` on confirm reliably lands on the real previous page every time.

**Re-verified after the fix**, same way the bug was found: repeated the
click → dirty → back → cancel sequence three times in a row in a headless
browser, confirming the register form (with its typed value) was still
correctly rendered after every cancel, then confirmed that clicking "Leave"
on the final attempt landed on `/en/login` — see [Verification
performed](#verification-performed) for the full matrix.

## Section 5 — `GuardedLink`: the in-app interception point

**The problem this solves:** `Link`s render real anchor tags; without
interception, clicking one navigates immediately regardless of guard state.

**How it's implemented** — the entire component (`guarded-link.tsx:15-32`):

```tsx
// components/common/navigation-guard/guarded-link.tsx:15-31
export function GuardedLink({ href, onClick, ...rest }: GuardedLinkProps) {
  const router = useRouter();
  const isGuarded = useNavigationGuardStore((s) => s.isGuarded);
  const requestNavigation = useNavigationGuardStore((s) => s.requestNavigation);

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || !isGuarded) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (event.button !== 0) return;

    event.preventDefault();
    requestNavigation(() => router.push(href));
  };

  return <Link href={href} onClick={handleClick} {...rest} />;
}
```

**Worth knowing — it wraps this app's own `Link`, not `next/link`
directly.** `GuardedLink` is built on `@/i18n/navigation`'s `Link`/`useRouter`
(`guarded-link.tsx:4`), not the framework's raw components, so locale
prefixing (`SETUP_INTERNATIONALIZATION.md`) keeps working transparently —
`href` stays the unresolved, locale-less path (e.g. `"/login"`), and both
the underlying `Link` and the deferred `router.push(href)` call resolve it
identically.

| Guard condition | What happens |
| --- | --- |
| `event.defaultPrevented` (an `onClick` prop already handled it) | Click proceeds untouched — `GuardedLink` never overrides an already-handled click. |
| Modifier key held (`Cmd`/`Ctrl`/`Shift`/`Alt`) or non-primary button | Click proceeds untouched — opening in a new tab, etc. should never be blocked. |
| Guard armed, plain left-click | `event.preventDefault()`, then `requestNavigation` defers the actual `router.push` until confirmed. |
| Guard not armed | Falls through to the underlying `Link`'s normal client-side navigation. |

## Section 6 — Wiring a screen: `RegisterFormScreen`

**The problem this solves:** a screen needs to arm the guard exactly while
it has unsaved work, and disarm it the moment that's no longer true —
including the "successfully saved, about to redirect" case, which is easy to
get backwards.

**How it's implemented.** One effect, keyed off `react-hook-form`'s
`isDirty`:

```tsx
// components/auth/register-form-screen.tsx:46-52
const setGuard = useNavigationGuardStore((s) => s.setGuard);
const isDirty = form.formState.isDirty;

useEffect(() => {
  setGuard(isDirty, { onAbort: () => form.reset() });
  return () => setGuard(false);
}, [isDirty, setGuard, form]);
```

`onAbort: () => form.reset()` resets the form back to its defaults the
moment the user actually confirms leaving — harmless since the component is
about to unmount anyway, but it keeps the store's `onAbort` contract
exercised by a real caller (Section 2) rather than dead code.

**Worth knowing — the explicit `setGuard(false)` on success.** The effect's
cleanup alone is *not* enough to disarm the guard before the
post-registration redirect:

```tsx
// components/auth/register-form-screen.tsx:71-76
onSuccess: ({ data }) => {
  setClientSessionCookie(data.access_token, data.expires_in);
  setGuard(false);
  router.push("/auth-success");
},
```

`router.push` here is a **raw** call, not routed through
`requestNavigation` — intentionally, since this redirect should never be
interrupted by the guard it itself is about to leave armed. But `setGuard`
disarming reactively (via the effect re-running because `isDirty` changed)
would depend on React committing a re-render before this synchronous
`router.push` executes, which isn't guaranteed. Calling `setGuard(false)`
directly, synchronously, in the same event handler removes that race
entirely: the guard is provably off before the redirect fires, so it can
never fire a spurious `beforeunload` prompt or block a future back press on
the destination page.

The "Log in instead" link uses `GuardedLink` exactly like any other link —
no per-link wiring beyond swapping the component:

```tsx
// components/auth/register-form-screen.tsx:165-170
<GuardedLink
  href="/login"
  className="font-medium text-foreground hover:underline"
>
  {t("loginHere")}
</GuardedLink>
```

## Cross-feature coupling

- **The provider is mounted once, app-wide — any screen can arm it.**
  `app/[locale]/layout.tsx:62` mounts `<NavigationGuardProvider />` above
  every route in every locale. `RegisterFormScreen` was the first caller of
  `setGuard`; `CreateAccountDialog` (`components/create-account-model/create-account-dialog.tsx`,
  see `CREATE_ACCOUNT_MODAL.md`) is now a second, wiring the same
  `isDirty`-effect recipe from Section 6 to a modal instead of a full-page
  form. The store still has no per-feature scoping — a second screen arming
  the guard while the first is still mounted would silently overwrite the
  first's `options` (last `setGuard` call wins). This isn't a live bug today
  (a logged-out register-form navigation and this dialog being open+dirty at
  the same time isn't a realistic user path), but it's a sharp edge worth
  knowing before wiring a third caller: two simultaneously-dirty guarded
  screens aren't supported by this store shape.
- **Mounted inside `QueryProvider`, alongside `TopProgressBar`.**
  `app/[locale]/layout.tsx:59-63` places both inside `<QueryProvider>`. The
  guard provider doesn't itself need TanStack Query context — it could sit
  outside — but it's colocated with `TopProgressBar` since both are
  app-wide, always-mounted, non-visual-by-default providers.
- **`GuardedLink` depends on `@/i18n/navigation`, not `next/link`.** Any
  future guarded link must go through this app's locale-aware `Link`
  wrapper (`guarded-link.tsx:4`) — reaching for `next/link` directly here
  would silently drop locale prefixing.

## Component/presentational layer

The dialog itself (`provider.tsx:82-113`) has no logic of its own beyond
reading `options`/`pendingNavigation` from the store — it's built entirely
from this app's existing `components/ui/dialog.tsx` primitives
(`Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`/`DialogDescription`/
`DialogFooter`), the same primitives `DeleteAccountDialog`
(`components/delete-account-model/delete-account-dialog.tsx`) uses for its
own confirm flow. There is no separate generic `ConfirmationModal`
component in this app — the navigation guard's dialog is its own small,
purpose-built JSX inside `provider.tsx`, not a shared abstraction reused
elsewhere (yet).

## Summary / data flow

**In-app link click:**

```
User clicks a GuardedLink while a screen has armed the guard
   │
   ▼
GuardedLink.handleClick: event.preventDefault()
   │
   ▼
requestNavigation(() => router.push(href))
   │  isGuarded === true → stashed as pendingNavigation, not run yet
   ▼
pendingNavigation !== null → NavigationGuardProvider's dialog opens
   │
   ├─ Cancel  → cancelLeave(): pendingNavigation cleared, guard stays armed
   │
   └─ Leave   → confirmLeave(): onAbort() runs, guard fully disarmed,
                pendingNavigation() finally runs → router.push(href)
```

**Browser back button:**

```
Guard arms (setGuard(true, ...))
   │
   ▼
Provider's arm-effect pushes a duplicate history entry (sentinel)
   │
   ▼
User presses Back → popstate fires (URL unchanged: duplicate → real entry,
                     same route — harmless even if Next's router re-renders it)
   │
   ▼
handlePopState: history.forward() restores the sentinel,
                requestNavigation(() => history.go(-2)) stashes the real "leave"
   │
   ▼
pendingNavigation !== null → same shared dialog opens
   │
   ├─ Cancel  → cleared; user stays on the sentinel entry, guard still armed
   │
   └─ Leave   → confirmLeave(): guard disarmed, then history.go(-2) actually
                navigates — now nothing is left to fight Next's router
```

## Final reference: store & component API

| Export | File | Signature | Notes |
| --- | --- | --- | --- |
| `useNavigationGuardStore` | `components/common/navigation-guard/store.ts` | Zustand hook | `setGuard`/`requestNavigation`/`confirmLeave`/`cancelLeave` (Section 2) |
| `NavigationGuardOptions` | `components/common/navigation-guard/store.ts` | `{ title?, description?, confirmLabel?, cancelLabel?, hideCancelButton?, onAbort? }` | All fields optional; unset copy falls back to the `common` i18n namespace (`unsavedChangesTitle`/`unsavedChangesDescription`/`leave`/`cancel`) |
| `useUnsavedChangesWarning` | `components/common/navigation-guard/use-unsaved-changes-warning.ts` | `(hasUnsavedChanges: boolean) => void` | Standalone; also usable directly by a future screen that wants browser-close protection without the shared dialog |
| `NavigationGuardProvider` | `components/common/navigation-guard/provider.tsx` | `() => JSX.Element` | Mount exactly once, near the app root (`app/[locale]/layout.tsx:62`) |
| `GuardedLink` | `components/common/navigation-guard/guarded-link.tsx` | Same props as `@/i18n/navigation`'s `Link` | Drop-in replacement; only intercepts plain, unmodified left-clicks while guarded |

**To wire a new form:**

1. `const setGuard = useNavigationGuardStore((s) => s.setGuard);`
2. One effect: `setGuard(isDirty, { onAbort: () => form.reset() })`,
   returning `() => setGuard(false)` on cleanup.
3. Swap any in-page navigation `Link`s for `GuardedLink`.
4. If a success path redirects programmatically, call `setGuard(false)`
   explicitly right before the `router.push` — don't rely on the effect
   cleanup alone (Section 6).

## Verification performed

- `yarn tsc --noEmit` — clean.
- `yarn lint` — clean (no new warnings/errors in any `navigation-guard/*`
  file, `register-form-screen.tsx`, or `app/[locale]/layout.tsx`).
- `yarn build` — clean production build, including static generation.
- Drove the real dev server with a headless Chromium (via Playwright)
  against `/en/login` and `/en/register` (public routes, no backend
  required):
  - Confirmed the original reactive-`pushState` approach produced the
    address-bar/rendered-page desync described in Section 4, via a
    screenshot showing the Login form rendered while `page.url()` still
    reported `/en/register`.
  - Confirmed the sentinel-based fix: link-click block → cancel (form state
    retained) → leave (lands on `/en/login`); browser back-button block →
    three repeated cancels in a row (form state retained every time, no
    history entries piling up) → leave (lands on `/en/login`).
  - Re-ran the same back-button sequence starting from a single continuous
    SPA session (real in-app link click into `/register`, not a fresh page
    load) to match how a user actually encounters this — same result.
  - Confirmed both `en`/`id` locales and light/dark themes render the
    dialog's translated copy correctly.
