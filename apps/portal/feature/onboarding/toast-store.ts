import { create } from "zustand";

export interface OnboardingToast {
  id: number;
  title: string;
  description?: string;
  variant: "success" | "error";
}

interface ToastState {
  toasts: OnboardingToast[];
  push: (toast: Omit<OnboardingToast, "id">) => void;
  dismiss: (id: number) => void;
}

let toastId = 0;
const TOAST_DURATION_MS = 4000;

export const useOnboardingToastStore = create<ToastState>((set) => ({
  toasts: [],
  push(toast) {
    const id = ++toastId;
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, TOAST_DURATION_MS);
  },
  dismiss(id) {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },
}));
