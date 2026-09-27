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
  // Set once the user confirmed leaving, so the navigation goes through.
  const leaving = useRef(false);
  const [pending, setPending] = useState<{ leave: () => void } | null>(null);

  useEffect(() => {
    leaving.current = false;
  }, [pathname]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (blockers.current.size > 0 && !leaving.current) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const value = useMemo<LeaveGuardContextValue>(
    () => ({
      block() {
        const id = Symbol();
        blockers.current.add(id);
        return () => blockers.current.delete(id);
      },
      holdLeave(leave) {
        if (blockers.current.size === 0 || leaving.current) return false;
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
        onOpenChange={(open) => !open && setPending(null)}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <div className="flex items-center gap-2">
              <TriangleAlert
                className="size-4 shrink-0 text-destructive"
                aria-hidden
              />
              <DialogTitle>{t("leaveGuard.title")}</DialogTitle>
            </div>
            <DialogDescription>{t("leaveGuard.description")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              {t("leaveGuard.stay")}
            </DialogClose>
            <Button variant="destructive" onClick={leave}>
              {t("leaveGuard.leave")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </LeaveGuardContext.Provider>
  );
}
