"use client";

import { useEffect } from "react";

/**
 * Shows the browser's native "Leave site?" prompt on tab close, refresh, or
 * address-bar navigation. Browsers ignore custom messages and show their own
 * generic text — `preventDefault`/a non-empty `returnValue` is all that's
 * required to trigger it.
 */
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
