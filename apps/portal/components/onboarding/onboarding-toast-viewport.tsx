"use client";

import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, X, XCircle } from "lucide-react";
import { useOnboardingToastStore } from "@/feature/onboarding";
import { cn } from "@/lib/utils";

export function OnboardingToastViewport() {
  const toasts = useOnboardingToastStore((s) => s.toasts);
  const dismiss = useOnboardingToastStore((s) => s.dismiss);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-60 flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-4 sm:items-end">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            layout
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-sm bg-popover p-3.5 pr-2.5 text-popover-foreground shadow-lg ring-1 ring-foreground/10",
            )}
          >
            {toast.variant === "success" ? (
              <CheckCircle2
                className="mt-0.5 size-5 shrink-0 text-success"
                aria-hidden
              />
            ) : (
              <XCircle
                className="mt-0.5 size-5 shrink-0 text-destructive"
                aria-hidden
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{toast.title}</p>
              {toast.description ? (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {toast.description}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="shrink-0 rounded-xs p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-3.5" aria-hidden />
              <span className="sr-only">Dismiss</span>
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
