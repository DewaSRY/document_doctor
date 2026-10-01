"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { TriangleAlert } from "lucide-react";
import { create } from "zustand";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** A stronger warning variant: leaving now will delete server-side work (e.g. an undownloaded document). */
type LeaveGuardVariant = "deleteDocument";

interface BlockOptions {
  variant?: LeaveGuardVariant;
  /** Runs once the user confirms leaving, before navigation continues. */
  onConfirmLeave?: () => void;
}

interface PendingLeave {
  leave: () => void;
  variant?: LeaveGuardVariant;
}

interface LeaveGuardState {
  blockers: Map<symbol, BlockOptions>;
  leaving: boolean;
  pending: PendingLeave | null;
  block: (options?: BlockOptions) => () => void;
  holdLeave: (leave: () => void) => boolean;
  cancelLeave: () => void;
  confirmLeave: () => void;
  resetLeaving: () => void;
}

export const useLeaveGuardStore = create<LeaveGuardState>((set, get) => ({
  blockers: new Map(),
  leaving: false,
  pending: null,

  block(options) {
    const id = Symbol();
    set((state) => ({
      blockers: new Map(state.blockers).set(id, options ?? {}),
    }));

    return () => {
      set((state) => {
        const blockers = new Map(state.blockers);
        blockers.delete(id);
        return { blockers };
      });
    };
  },

  holdLeave(leave) {
    const { blockers, leaving } = get();
    if (blockers.size === 0 || leaving) return false;

    const active = [...blockers.values()];
    set({
      pending: {
        leave: () => {
          for (const blocker of active) blocker.onConfirmLeave?.();
          leave();
        },
        variant: active.find((blocker) => blocker.variant)?.variant,
      },
    });
    return true;
  },

  cancelLeave() {
    set({ pending: null });
  },

  confirmLeave() {
    const pending = get().pending;
    if (!pending) return;

    set({ leaving: true, pending: null });
    pending.leave();
  },

  resetLeaving() {
    set({ leaving: false });
  },
}));

export function useLeaveGuard(active: boolean, options?: BlockOptions) {
  const block = useLeaveGuardStore((state) => state.block);
  const optionsRef = useRef(options);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(
    () =>
      active
        ? block({
            variant: optionsRef.current?.variant,
            onConfirmLeave: () => optionsRef.current?.onConfirmLeave?.(),
          })
        : undefined,
    [active, block],
  );
}

export function LeaveGuardProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation("common");
  const pathname = usePathname();
  const pending = useLeaveGuardStore((state) => state.pending);
  const confirmLeave = useLeaveGuardStore((state) => state.confirmLeave);
  const cancelLeave = useLeaveGuardStore((state) => state.cancelLeave);
  const resetLeaving = useLeaveGuardStore((state) => state.resetLeaving);

  useEffect(() => {
    resetLeaving();
  }, [pathname, resetLeaving]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      const { blockers, leaving } = useLeaveGuardStore.getState();
      if (blockers.size > 0 && !leaving) {
        event.preventDefault();
      }
    };

    window.addEventListener("beforeunload", warn);

    return () => {
      window.removeEventListener("beforeunload", warn);
    };
  }, []);

  return (
    <>
      {children}

      <Dialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) cancelLeave();
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="max-w-md overflow-hidden rounded-2xl p-0 shadow-2xl"
        >
          {/* Content */}
          <div className="px-6 pb-6 pt-7 sm:px-7">
            <div className="flex flex-col items-center text-center">
              {/* Warning icon */}
              <div className="relative mb-5">
                <div className="absolute inset-0 rounded-full bg-destructive/10 blur-xl" />

                <div className="relative flex size-14 items-center justify-center rounded-full border border-destructive/15 bg-destructive/10">
                  <TriangleAlert
                    className="size-6 text-destructive"
                    strokeWidth={2}
                    aria-hidden
                  />
                </div>
              </div>

              <DialogHeader className="items-center space-y-2">
                <DialogTitle className="text-lg font-semibold tracking-tight sm:text-xl">
                  {t(
                    pending?.variant === "deleteDocument"
                      ? "leaveGuard.deleteDocument.title"
                      : "leaveGuard.title",
                  )}
                </DialogTitle>

                <DialogDescription className="max-w-sm text-center text-sm leading-6 text-muted-foreground">
                  {t(
                    pending?.variant === "deleteDocument"
                      ? "leaveGuard.deleteDocument.description"
                      : "leaveGuard.description",
                  )}
                </DialogDescription>
              </DialogHeader>
            </div>
          </div>

          {/* Actions */}
          <DialogFooter className="flex-col gap-2 border-t bg-muted/20 p-4 sm:flex-row sm:justify-between">
            <DialogClose
              render={<Button variant="ghost" className="w-full sm:w-auto" />}
            >
              {t("leaveGuard.stay")}
            </DialogClose>

            <Button
              variant="destructive"
              onClick={confirmLeave}
              className="w-full shadow-sm sm:w-auto"
            >
              {t("leaveGuard.leave")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
