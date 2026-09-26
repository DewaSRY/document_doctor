"use client";

import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUnsavedChangesWarning } from "./use-unsaved-changes-warning";
import { useNavigationGuardStore } from "./store";

/**
 * Mounted once near the app root. Renders the one shared "unsaved changes"
 * dialog, arms the native `beforeunload` prompt whenever the store is
 * guarded, and intercepts browser back/forward via `popstate`.
 */
export function NavigationGuardProvider() {
  const { t } = useTranslation("common");
  const isGuarded = useNavigationGuardStore((s) => s.isGuarded);
  const options = useNavigationGuardStore((s) => s.options);
  const pendingNavigation = useNavigationGuardStore((s) => s.pendingNavigation);
  const confirmLeave = useNavigationGuardStore((s) => s.confirmLeave);
  const cancelLeave = useNavigationGuardStore((s) => s.cancelLeave);

  useUnsavedChangesWarning(isGuarded);

  const allowNextPopRef = useRef(false);
  const restoringSentinelRef = useRef(false);

  useEffect(() => {
    // Next.js's App Router has its own popstate listener that renders the
    // destination route independently of the raw History API — by the time
    // our handler below could react and push the URL back, Next has already
    // swapped in the other page underneath. So the guard can't fight a
    // *different* route after the fact; instead, the moment it arms, it
    // pushes a duplicate of the current entry. The first back press then
    // only ever traverses between two identical URLs (harmless for Next to
    // re-render) until the user actually confirms leaving.
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

      // Undo the pop by moving forward onto the sentinel entry we already
      // pushed, rather than pushing yet another duplicate — that way
      // repeated cancels never pile up extra history entries.
      restoringSentinelRef.current = true;
      window.history.forward();

      state.requestNavigation(() => {
        allowNextPopRef.current = true;
        // Two steps back: past the sentinel entry, and past the real entry
        // it duplicated, landing on whatever preceded it.
        window.history.go(-2);
      });
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const hideCancelButton = options?.hideCancelButton ?? false;

  return (
    <Dialog
      open={pendingNavigation !== null}
      onOpenChange={(open) => {
        if (!open) cancelLeave();
      }}
    >
      <DialogContent className="sm:max-w-lg px-4 py-4 flex flex-col justify-between space-y-4">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {options?.title ?? t("unsavedChangesTitle")}
          </DialogTitle>
          <DialogDescription>
            {options?.description ?? t("unsavedChangesDescription")}
          </DialogDescription>
        </DialogHeader>

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
      </DialogContent>
    </Dialog>
  );
}
