import { create } from "zustand";

export interface NavigationGuardOptions {
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** true = single-button "OK" acknowledgment dialog (e.g. "a process is
   *  running"), false = two-button "Discard changes? / Keep editing" dialog. */
  hideCancelButton?: boolean;
  /** Runs once the user confirms leaving, before navigation executes. Use
   *  for cleanup: aborting an in-flight request, resetting form state. */
  onAbort?: () => void;
}

interface NavigationGuardState {
  isGuarded: boolean;
  options: NavigationGuardOptions | null;
  pendingNavigation: (() => void) | null;
  setGuard: (isGuarded: boolean, options?: NavigationGuardOptions) => void;
  requestNavigation: (navigate: () => void) => void;
  confirmLeave: () => void;
  cancelLeave: () => void;
}

export const useNavigationGuardStore = create<NavigationGuardState>()(
  (set, get) => ({
    isGuarded: false,
    options: null,
    pendingNavigation: null,

    setGuard: (isGuarded, options) =>
      set({
        isGuarded,
        options: isGuarded ? (options ?? null) : null,
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
      options?.onAbort?.();
      set({ isGuarded: false, options: null, pendingNavigation: null });
      pendingNavigation?.();
    },

    cancelLeave: () => set({ pendingNavigation: null }),
  }),
);
