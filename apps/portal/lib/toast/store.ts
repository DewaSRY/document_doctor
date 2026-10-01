import { create } from "zustand";

/**
 * Either already-resolved text (e.g. a backend error message) or an i18n key
 * the viewport resolves at render time. Keys are namespaced ("account:toast.created")
 * because toasts are pushed from outside React (the QueryClient's caches),
 * where no `t` function is available.
 */
export type ToastText =
  | string
  | { key: string; values?: Record<string, unknown> };

export type ToastVariant = "success" | "error";

export interface Toast {
  id: number;
  title: ToastText;
  description?: ToastText;
  variant: ToastVariant;
}

interface ToastState {
  toasts: Toast[];
  push: (toast: Omit<Toast, "id">) => void;
  dismiss: (id: number) => void;
}

let toastId = 0;
const TOAST_DURATION_MS = 4000;
const MAX_VISIBLE_TOASTS = 4;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push(toast) {
    const id = ++toastId;
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }].slice(-MAX_VISIBLE_TOASTS),
    }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, TOAST_DURATION_MS);
  },
  dismiss(id) {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },
}));

/** Imperative entry point for non-React callers (e.g. the QueryClient caches). */
export function pushToast(toast: Omit<Toast, "id">) {
  // The store is module-level; pushing on the server would leak toasts
  // across requests, and there's nothing to render them there anyway.
  if (typeof window === "undefined") return;
  useToastStore.getState().push(toast);
}
