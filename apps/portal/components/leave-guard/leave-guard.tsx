"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { TriangleAlert } from "lucide-react";

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

interface LeaveGuardContextValue {
  block: () => () => void;
  holdLeave: (leave: () => void) => boolean;
}

const LeaveGuardContext = createContext<LeaveGuardContextValue>({
  block: () => () => {},
  holdLeave: () => false,
});

export function useLeaveGuardContext() {
  return useContext(LeaveGuardContext);
}

export function useLeaveGuard(active: boolean) {
  const { block } = useLeaveGuardContext();

  useEffect(() => (active ? block() : undefined), [active, block]);
}

export function LeaveGuardProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation("common");
  const pathname = usePathname();

  const blockers = useRef(new Set<symbol>());
  const leaving = useRef(false);

  const [pending, setPending] = useState<{ leave: () => void } | null>(null);

  useEffect(() => {
    leaving.current = false;
  }, [pathname]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (blockers.current.size > 0 && !leaving.current) {
        event.preventDefault();
      }
    };

    window.addEventListener("beforeunload", warn);

    return () => {
      window.removeEventListener("beforeunload", warn);
    };
  }, []);

  const value = useMemo<LeaveGuardContextValue>(
    () => ({
      block() {
        const id = Symbol();

        blockers.current.add(id);

        return () => blockers.current.delete(id);
      },

      holdLeave(leave) {
        if (blockers.current.size === 0 || leaving.current) {
          return false;
        }

        setPending({ leave });

        return true;
      },
    }),
    [],
  );

  function leave() {
    if (!pending) return;

    leaving.current = true;
    setPending(null);
    pending.leave();
  }

  return (
    <LeaveGuardContext.Provider value={value}>
      {children}

      <Dialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="max-w-md gap-0 overflow-hidden p-0"
        >
          {/* Visual header */}
          <div className="px-6 pt-6">
            <div className="flex flex-col items-center text-center">
              <div
                className="
                  mb-5 flex size-14 items-center justify-center
                  rounded-2xl
                  bg-destructive/10
                  ring-8 ring-destructive/5
                "
              >
                <TriangleAlert
                  className="size-7 text-destructive"
                  strokeWidth={2}
                  aria-hidden
                />
              </div>

              <DialogHeader className="space-y-2">
                <DialogTitle className="text-xl font-semibold tracking-tight">
                  {t("leaveGuard.title")}
                </DialogTitle>

                <DialogDescription className="text-center text-sm leading-6 text-muted-foreground">
                  {t("leaveGuard.description")}
                </DialogDescription>
              </DialogHeader>
            </div>
          </div>

          {/* Actions */}
          <DialogFooter className="mt-6 p-2! flex-col-reverse gap-2 border-t bg-muted/30  sm:flex-row sm:justify-between">
            <DialogClose
              render={<Button variant="outline" className="w-full sm:w-auto" />}
            >
              {t("leaveGuard.stay")}
            </DialogClose>

            <Button
              variant="destructive"
              onClick={leave}
              className="w-full shadow-sm sm:w-auto"
            >
              {t("leaveGuard.leave")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </LeaveGuardContext.Provider>
  );
}
