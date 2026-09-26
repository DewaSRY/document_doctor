# Navigation Guard System — Implementation Prompt

This document is a self-contained prompt you can hand to an AI coding agent to
implement an "unsaved changes" navigation guard in a **new** React / Next.js
(App Router) project. It is derived from a working implementation and
describes the mechanism, the files to create, and how to wire it into forms.

Paste the "Prompt to give the AI" section (or the whole file) into a new
project's agent session to bootstrap the same system there.

---

## 1. Problem statement

When a user is filling out a form (or a background process they started is
still running), navigating away should not silently lose their work. There
are two distinct ways a user can "leave":

1. **Browser-level navigation** — closing the tab, refreshing, or typing a
   new URL in the address bar. The SPA router has no control over this; only
   the browser's native `beforeunload` confirmation can intercept it.
2. **In-app navigation** — clicking a sidebar link, a breadcrumb, a back
   button, or using the browser's back/forward buttons while staying inside
   the SPA. Next.js App Router (unlike React Router) has **no built-in API**
   to block a route change, so every point that can trigger navigation must
   voluntarily check a shared "guarded" flag before navigating, and browser
   back/forward must be intercepted via `popstate`.

The goal is a single, reusable system that:

- Lets any screen "arm" the guard (e.g. when `form.formState.isDirty` is
  true, or while an async process is running) and "disarm" it when done.
- Shows **one shared confirmation dialog** for in-app navigation, with
  customizable title/description/button labels per screen.
- Also arms the native browser `beforeunload` prompt automatically whenever
  the in-app guard is armed.
- Still allows individual screens to opt out of the shared dialog and run
  their own local confirm-modal flow when they need finer control (e.g.
  multi-step wizards where "dirty" only applies to the current step).

---

## 2. Architecture

Two mechanisms, combined:

```
┌─────────────────────────────────────────────────────────────┐
│                     useNavigationGuardStore                  │
│  (global state: isGuarded, options, pendingNavigation)       │
└───────────────┬───────────────────────────────┬──────────────┘
                 │                               │
   armed/disarmed by screens          read by everything that navigates
   via setGuard(isDirty, opts)                   │
                 │                               │
                 ▼                               ▼
   ┌─────────────────────────┐     ┌───────────────────────────────┐
   │ NavigationGuardProvider │     │ GuardedLink / back button /    │
   │ - renders shared modal  │     │ breadcrumbs / router.push calls│
   │ - arms beforeunload     │     │ → call requestNavigation(fn)   │
   │ - intercepts popstate   │     │   instead of navigating directly│
   └─────────────────────────┘     └───────────────────────────────┘
```

- A **Zustand store** (or any global state container) is the single source
  of truth for "is navigation currently guarded" plus the dialog copy and a
  pending navigation callback.
- A **provider component**, mounted once near the app root, renders the
  shared confirmation dialog, wires the native `beforeunload` listener to
  the same `isGuarded` flag, and listens for `popstate` to catch
  browser back/forward.
- A **`GuardedLink`** component wraps your router's `<Link>` and intercepts
  clicks when guarded, deferring the actual navigation until the user
  confirms.
- Any other place that programmatically navigates (buttons, redirects) must
  call `requestNavigation(() => router.push(url))` instead of navigating
  directly.
- A separate, standalone hook handles the native `beforeunload` prompt so it
  can also be used directly by screens that want browser-close protection
  without going through the global store (e.g. a step in a wizard that is
  dirty but shouldn't block in-app navigation to other steps).

---

## 3. Files to create

### 3.1 `useUnsavedChangesWarning` — native `beforeunload` hook

Purpose: shows the browser's native "Leave site?" prompt on tab close,
refresh, or address-bar navigation.

```ts
// hooks/use-unsaved-changes-warning.ts
"use client";
import { useEffect } from "react";

export function useUnsavedChangesWarning(hasUnsavedChanges: boolean) {
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);
}
```

Notes:
- Browsers ignore custom messages in `returnValue` and show their own
  generic text — the values here just need to be non-empty / call
  `preventDefault()`.
- This hook is intentionally dumb and standalone: it doesn't know about the
  global store. It's reused both inside the provider (§3.3) and directly by
  screens that want browser-close protection without the in-app dialog.

### 3.2 `useNavigationGuardStore` — global guard state

Purpose: single source of truth for whether navigation is currently
guarded, the dialog copy to show, and the deferred navigation callback.

```ts
// stores/use-navigation-guard-store.ts
import { create } from "zustand";

export type NavigationGuardOptions = {
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** true = single-button "OK" style dialog (e.g. "a process is running"),
   *  false = two-button "Discard changes? / Keep editing" dialog. */
  hideCancelButton?: boolean;
  /** Runs once the user confirms leaving, before navigation executes.
   *  Use for cleanup: aborting an in-flight request, resetting form state. */
  onAbort?: () => void;
};

interface NavigationGuardState {
  isGuarded: boolean;
  options: NavigationGuardOptions | null;
  guardedUrl: string | null;
  pendingNavigation: (() => void) | null;
  setGuard: (isGuarded: boolean, options?: NavigationGuardOptions) => void;
  requestNavigation: (navigate: () => void) => void;
  confirmLeave: () => void;
  cancelLeave: () => void;
  getIsGuarded: () => boolean;
}

export const useNavigationGuardStore = create<NavigationGuardState>()((set, get) => ({
  isGuarded: false,
  options: null,
  guardedUrl: null,
  pendingNavigation: null,

  setGuard: (isGuarded, options) =>
    set({
      isGuarded,
      options: isGuarded ? (options ?? null) : null,
      guardedUrl: isGuarded && typeof window !== "undefined" ? window.location.href : null,
    }),

  requestNavigation: (navigate) => {
    if (get().isGuarded) {
      set({ pendingNavigation: navigate });
      return;
    }
    navigate();
  },

  confirmLeave: () => {
    const { pendingNavigation, options } = get();
    try {
      options?.onAbort?.();
    } catch (error) {
      console.error("navigation guard onAbort failed", error);
    }
    set({ isGuarded: false, options: null, guardedUrl: null, pendingNavigation: null });
    pendingNavigation?.();
  },

  cancelLeave: () => set({ pendingNavigation: null }),
  getIsGuarded: () => get().isGuarded,
}));
```

Key design points:
- `setGuard(isGuarded, options)` — screens call this in a `useEffect` keyed
  off their dirty/busy state. Always disarm on unmount (`return () =>
  setGuard(false)`).
- `requestNavigation(navigate)` — the single interception point. Anything
  that wants to navigate calls this instead of navigating directly. If
  guarded, it stashes `navigate` as `pendingNavigation` (which makes the
  dialog open) instead of running it; otherwise it runs immediately.
- `pendingNavigation !== null` is what drives the dialog's `open` state —
  not `isGuarded` itself, since being guarded shouldn't show a dialog until
  the user actually *tries* to leave.
- `guardedUrl` captures the URL at the moment the guard was armed, used to
  restore history state when defeating a back/forward navigation (§3.3).

### 3.3 `NavigationGuardProvider` — mounts the dialog, wires everything together

Purpose: mounted once near the app root. Renders the one shared
confirmation dialog, arms `beforeunload` whenever the store is guarded, and
intercepts browser back/forward via `popstate`.

```tsx
// components/navigation-guard-provider.tsx
"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ConfirmationModal } from "@/components/ui/confirmation-modal"; // your Dialog-based confirm component
import { useUnsavedChangesWarning } from "@/hooks/use-unsaved-changes-warning";
import { useNavigationGuardStore } from "@/stores/use-navigation-guard-store";

export function NavigationGuardProvider() {
  const isGuarded = useNavigationGuardStore((s) => s.isGuarded);
  const options = useNavigationGuardStore((s) => s.options);
  const pendingNavigation = useNavigationGuardStore((s) => s.pendingNavigation);
  const confirmLeave = useNavigationGuardStore((s) => s.confirmLeave);
  const cancelLeave = useNavigationGuardStore((s) => s.cancelLeave);

  // Arms the native browser prompt automatically whenever the in-app guard is armed.
  useUnsavedChangesWarning(isGuarded);

  useEffect(() => {
    // Browsers give SPAs no way to cancel a back/forward navigation — by the
    // time `popstate` fires, history has already popped. So: push the
    // guarded URL back on immediately, then route the "actually leave"
    // decision through the normal confirm flow.
    const handlePopState = () => {
      const state = useNavigationGuardStore.getState();
      if (!state.isGuarded || !state.guardedUrl) return;

      window.history.pushState(null, "", state.guardedUrl);
      state.requestNavigation(() => window.history.back());
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  return (
    <ConfirmationModal
      open={pendingNavigation !== null}
      onOpenChange={(open) => { if (!open) cancelLeave(); }}
      title={options?.title ?? "Leave this page?"}
      description={options?.description ?? "You have unsaved changes. Leaving now will discard them."}
      confirmButtonText={options?.confirmLabel ?? "Leave"}
      cancelButtonText={options?.cancelLabel ?? "Stay"}
      hideCancelButton={options?.hideCancelButton ?? false}
      onConfirm={() => (options?.hideCancelButton ? cancelLeave() : confirmLeave())}
      onCancel={cancelLeave}
    />
  );
}
```

Important subtlety on `onConfirm`: when a screen sets `hideCancelButton:
true` (a single-button "OK" dialog used for "a process is running, please
wait" cases), the single button should act as an **acknowledgment that
keeps the user on the page** — so it calls `cancelLeave()`, not
`confirmLeave()`. Only two-button dialogs (discard-changes style) call
`confirmLeave()` to actually proceed with navigation.

Mount it once, near the root layout, alongside your router:

```tsx
// app/layout.tsx or a root client-layout component
<NavigationGuardProvider />
```

### 3.4 `GuardedLink` — drop-in replacement for your router's `<Link>`

Purpose: intercepts clicks on navigation links when the guard is armed,
deferring the navigation until confirmed.

```tsx
// components/ui/guarded-link.tsx
"use client";
import { forwardRef, type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from "react";
import Link, { type LinkProps } from "next/link";
import { useRouter } from "next/navigation";
import { useNavigationGuardStore } from "@/stores/use-navigation-guard-store";

type GuardedLinkProps = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> & { children?: ReactNode };

export const GuardedLink = forwardRef<HTMLAnchorElement, GuardedLinkProps>(
  ({ href, onClick, children, ...rest }, ref) => {
    const router = useRouter();
    const isGuarded = useNavigationGuardStore((s) => s.isGuarded);
    const requestNavigation = useNavigationGuardStore((s) => s.requestNavigation);

    const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
      onClick?.(event);
      if (event.defaultPrevented || !isGuarded) return;
      // let modifier-key clicks (open in new tab, etc.) behave normally
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (event.button !== 0) return;

      event.preventDefault();
      requestNavigation(() => router.push(href.toString()));
    };

    return (
      <Link ref={ref} href={href} onClick={handleClick} {...rest}>
        {children}
      </Link>
    );
  },
);
GuardedLink.displayName = "GuardedLink";
```

Use `GuardedLink` anywhere a navigation link should respect the guard:
sidebar/nav items, logout buttons, etc. Any other imperative navigation
(`router.push(...)` inside a click handler) should likewise be wrapped:
`requestNavigation(() => router.push(url))`.

### 3.5 Guard-aware back button / breadcrumbs component (optional but recommended)

If you have a shared page-header component with a back button and
breadcrumbs, make it support **both** guard styles so screens can pick
whichever fits:

```tsx
interface BackDetailProps {
  title: string;
  breadcrumbs: { name: string; href?: string }[];
  /** Local guard style: screen owns its own dirty flag + confirm modal. */
  hasUnsavedChanges?: boolean;
  onRequestLeave?: (proceed: () => void) => void;
  disabled?: boolean;
}

function navigateOrGuard(
  navigate: () => void,
  { hasUnsavedChanges, onRequestLeave, isGuarded, requestNavigation, disabled }: {
    hasUnsavedChanges?: boolean;
    onRequestLeave?: (proceed: () => void) => void;
    isGuarded: boolean;
    requestNavigation: (fn: () => void) => void;
    disabled?: boolean;
  },
) {
  if (disabled) return;

  if (hasUnsavedChanges && onRequestLeave) {
    onRequestLeave(navigate); // local, component-owned confirm flow
    return;
  }
  if (isGuarded) {
    requestNavigation(navigate); // fall back to the global store/modal
    return;
  }
  navigate();
}
```

This lets a simple form screen just arm the global store (§4.1) while a
complex multi-step wizard owns its own local dirty flag and confirm modal
per step (§4.3), without needing two different back-button components.

---

## 4. Wiring patterns (how screens use the guard)

### 4.1 Simple form: global store + `react-hook-form`'s `isDirty`

```tsx
const setGuard = useNavigationGuardStore((s) => s.setGuard);
const form = useMyForm();

useEffect(() => {
  setGuard(form.formState.isDirty, {
    title: "Discard changes?",
    description: "You have unsaved changes. Are you sure you want to leave?",
    confirmLabel: "Discard",
    cancelLabel: "Keep editing",
    hideCancelButton: false,
    onAbort: () => form.reset(), // reset to last saved state if user leaves
  });
  return () => setGuard(false);
}, [form.formState.isDirty, setGuard]);
```

This single effect is enough to guard: sidebar `GuardedLink` clicks, the
shared back button/breadcrumbs, browser back/forward, **and** tab
close/refresh (via the provider's internal `useUnsavedChangesWarning`).

### 4.2 Non-form case: guard while an async process is running

The guard isn't limited to form dirtiness — arm it for any "don't let the
user leave right now" state, e.g. a file upload/analysis in progress:

```tsx
const setGuard = useNavigationGuardStore((s) => s.setGuard);
const cancelLeave = useNavigationGuardStore((s) => s.cancelLeave);

useEffect(() => {
  setGuard(isProcessing, {
    title: "Process running",
    description: "Leaving now will cancel this process.",
    confirmLabel: "OK",
    cancelLabel: "OK",
    hideCancelButton: true, // single-button acknowledgment dialog
  });
  return () => {
    cancelLeave();
    setGuard(false);
  };
}, [isProcessing, setGuard]);
```

### 4.3 Multi-step wizard: local dirty state + local confirm modal per step

When "dirty" is step-scoped (leaving step 2 for step 3 shouldn't trigger the
same dialog as leaving the whole wizard), bypass the global store and use
the back-button component's local guard style instead:

```tsx
const [isStepDirty, setIsStepDirty] = useState(false);
const [pendingLeaveAction, setPendingLeaveAction] = useState<(() => void) | null>(null);

<BackDetail
  title="Import data"
  hasUnsavedChanges={isStepDirty}
  onRequestLeave={(proceed) => setPendingLeaveAction(() => proceed)}
/>

<ConfirmationModal
  open={pendingLeaveAction !== null}
  onOpenChange={(open) => { if (!open) setPendingLeaveAction(null); }}
  title="Discard changes?"
  confirmButtonText="Discard"
  cancelButtonText="Keep editing"
  onConfirm={() => { pendingLeaveAction?.(); setPendingLeaveAction(null); }}
  onCancel={() => setPendingLeaveAction(null)}
/>
```

Inside the step itself, arm the browser-close prompt directly (bypassing
the global store, since it shouldn't block in-app step navigation):

```tsx
const isDirty = form.formState.isDirty;
useUnsavedChangesWarning(isDirty);
useEffect(() => { onDirtyChange?.(isDirty); }, [isDirty]);
```

### 4.4 Combining multiple dirty sources

When dirtiness isn't fully owned by `react-hook-form` (e.g. nested draft
state, unsaved image uploads), OR them together before arming the guard:

```tsx
const hasChanges =
  form.formState.isDirty ||
  nestedDraft.isMaterialsDirty ||
  nestedDraft.isRoutingsDirty ||
  isImagesDirty;

useEffect(() => {
  setGuard(hasChanges, { ...dialogCopy });
  return () => setGuard(false);
}, [hasChanges, setGuard]);
```

---

## 5. Implementation checklist

1. [ ] Add a Zustand (or equivalent) store: `useNavigationGuardStore` with
       `isGuarded`, `options`, `pendingNavigation`, `guardedUrl`,
       `setGuard`, `requestNavigation`, `confirmLeave`, `cancelLeave`.
2. [ ] Add `useUnsavedChangesWarning(hasUnsavedChanges)` wrapping native
       `beforeunload`.
3. [ ] Add `NavigationGuardProvider`: renders the shared confirm dialog,
       calls `useUnsavedChangesWarning(isGuarded)`, listens for `popstate`
       to defeat browser back/forward and reroute it through
       `requestNavigation`.
4. [ ] Mount `<NavigationGuardProvider />` once near the app root/layout.
5. [ ] Add `GuardedLink` wrapping your router's `<Link>`; swap it in for
       any nav link that should respect the guard (sidebar, logout, etc.).
6. [ ] Wrap any other imperative navigation call sites
       (`router.push(...)` in click handlers, redirects) with
       `requestNavigation(() => router.push(url))`.
7. [ ] (Optional) Make your shared back-button/breadcrumb component support
       both the local (`hasUnsavedChanges` + `onRequestLeave`) and global
       (`isGuarded` + `requestNavigation`) guard styles.
8. [ ] In each form screen, add a `useEffect` that calls
       `setGuard(isDirty, options)` keyed off `form.formState.isDirty` (or
       a combined dirty expression), and disarm on unmount.
9. [ ] For non-form "don't leave mid-process" cases, arm the same store
       with `hideCancelButton: true` for a single acknowledgment button.
10. [ ] For step-scoped wizards, use the local dirty-state + local modal
        pattern instead of the global store, and arm
        `useUnsavedChangesWarning` directly per step.

---

## 6. Prompt to give the AI (copy-paste)

> Implement a navigation guard system for this [Next.js App Router /
> React Router / <your framework>] app that prevents users from
> accidentally navigating away from a form with unsaved changes (or while a
> background process is running) without confirming first.
>
> Requirements:
> - A global state store (`useNavigationGuardStore`) holding `isGuarded`,
>   dialog `options` (title/description/button labels/`onAbort` callback),
>   and a `pendingNavigation` callback, exposing `setGuard`,
>   `requestNavigation`, `confirmLeave`, `cancelLeave`.
> - A `useUnsavedChangesWarning(hasUnsavedChanges)` hook using the native
>   `beforeunload` event, for tab-close/refresh/address-bar navigation.
> - A `NavigationGuardProvider`, mounted once near the app root, that
>   renders one shared confirmation dialog driven by the store, calls
>   `useUnsavedChangesWarning(isGuarded)` so browser-close protection is
>   automatic whenever the in-app guard is armed, and intercepts
>   browser back/forward via the `popstate` event (push the guarded URL
>   back onto history immediately, then route the decision through
>   `requestNavigation`).
> - A `GuardedLink` component wrapping the framework's link/navigation
>   component, intercepting left-clicks (ignoring modifier-key clicks) and
>   calling `requestNavigation` instead of navigating directly when guarded.
> - Support two dialog styles: a two-button "Discard changes? /
>   Keep editing" style that calls `confirmLeave()` on confirm, and a
>   single-button "OK" acknowledgment style (for "a process is running")
>   that calls `cancelLeave()` on its only button — controlled by a
>   `hideCancelButton` option.
> - Any screen should be able to arm the guard with one `useEffect`:
>   `setGuard(isDirty, { title, description, confirmLabel, cancelLabel,
>   hideCancelButton, onAbort })`, disarming on unmount.
> - Support combining multiple dirty-state sources (react-hook-form's
>   `formState.isDirty` plus any manually tracked draft state) before
>   arming the guard.
> - Also support a "local" guard style for multi-step wizards where a
>   step-scoped dirty flag and a screen-owned confirm modal are used
>   instead of the global dialog, while still calling
>   `useUnsavedChangesWarning` directly for browser-close protection on
>   that step.
>
> Reference implementation and detailed code for every piece above is in
> `GUARD_NAVIGATION.md` — follow that structure exactly, adapting import
> paths, the Dialog/ConfirmationModal component, and the router APIs to
> this project's conventions.

---

## 7. Reference implementation (source project)

This system already exists in this codebase; use it as a working reference
if you need to see it in a real app instead of the generalized snippets
above:

| File | Role |
|---|---|
| `src/features/common/hooks/use-unsaved-changes-warning.ts` | `beforeunload` native prompt hook |
| `src/features/common/hooks/use-navigation-guard-store.ts` | Zustand store |
| `src/components/navigation-guard-provider.tsx` | Root-mounted provider: shared modal, `beforeunload` wiring, `popstate` interception |
| `src/components/ui/guarded-link.tsx` | `GuardedLink` — `next/link` wrapper |
| `src/components/ui/back-detail.tsx` | `PreviousBackDetail` — guard-aware back button/breadcrumbs (local + global styles) |
| `src/components/client-layout.tsx` | Mounts `<NavigationGuardProvider />` once at app root |
| `src/components/navbar.tsx` | Uses `GuardedLink` for sidebar nav + logout |
| `src/components/notification-settings/NotificationSettingsScreen.tsx` | Example: `setGuard(isDirty, {...})` wired to RHF's `isDirty` |
| `src/components/app/bulk-upload/BulkUploadStepUpload.tsx` | Example: guard for "process running" |
| `src/components/app/bulk-upload/BulkUploadScreen.tsx` + `BulkUploadStepMapping.tsx` | Example: local dirty state + local modal per wizard step |
| `src/components/app/cpr/CPRFillScreen.tsx` | Example: combining RHF `isDirty` with multiple manual dirty flags |
| `src/components/ui/new-confirmation-modal.tsx` | Shared Dialog-based confirm component |
