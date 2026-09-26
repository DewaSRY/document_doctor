"use client";

import { useEffect } from "react";
import { LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLogoutMutation } from "@/feature/auth";
import type { AppLocale } from "@/i18n/settings";
import { AuthBackdrop } from "@/components/auth/auth-backdrop";

const MIN_SPINNER_MS = 600;

export function LogoutBanner() {
  const { t, i18n } = useTranslation("auth");
  const { mutate: logout } = useLogoutMutation();

  useEffect(() => {
    const timer = setTimeout(() => {
      logout(i18n.language as AppLocale);
    }, MIN_SPINNER_MS);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthBackdrop>
      <div className="relative flex flex-col items-center gap-6 px-6 text-center">
        <div className="relative flex size-20 items-center justify-center">
          <span className="absolute inset-0 rounded-full border-4 border-brand/20" />
          <span className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-brand" />
          <LogOut
            className="size-8 text-brand-700 dark:text-brand"
            aria-hidden
          />
        </div>

        <div className="space-y-1" role="status" aria-live="polite">
          <p className="text-lg font-semibold text-foreground">
            {t("loggingOutTitle")}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("loggingOutSubtitle")}
          </p>
        </div>

        <div className="h-1 w-40 overflow-hidden rounded-full bg-brand/10">
          <div className="h-full w-full origin-left animate-[logout-progress_300ms_ease-out_forwards] rounded-full bg-brand" />
        </div>
      </div>
    </AuthBackdrop>
  );
}
