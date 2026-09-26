"use client";

import { RotateCcw, Wallet, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { useOnboardingStore } from "@/feature/onboarding";
import { OnboardingStepper } from "./onboarding-stepper";

export function OnboardingHeader() {
  const { t } = useTranslation("onboarding");
  const { t: tCommon } = useTranslation("common");
  const router = useRouter();
  const hasAccount = useOnboardingStore((s) => s.account !== null);
  const reset = useOnboardingStore((s) => s.reset);

  function handleRestart() {
    reset();
    router.push("/onboarding");
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-3 sm:px-6 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/onboarding"
            className="flex shrink-0 items-center gap-2 text-sm font-semibold tracking-tight"
          >
            <span className="flex size-7 items-center justify-center rounded-xs bg-primary text-primary-foreground">
              <Wallet className="size-4" aria-hidden />
            </span>
            <span className="hidden sm:inline">{tCommon("appName")}</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {t("badgeShort")}
            </span>
          </Link>

          <div className="flex shrink-0 items-center gap-1.5">
            {hasAccount && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRestart}
                className="gap-1.5"
              >
                <RotateCcw className="size-3.5" aria-hidden />
                <span className="hidden sm:inline">{t("restartDemo")}</span>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href="/" />}
              className="gap-1.5"
            >
              <X className="size-3.5" aria-hidden />
              <span className="hidden sm:inline">{t("exitDemo")}</span>
            </Button>
          </div>
        </div>

        <OnboardingStepper />
      </div>
    </header>
  );
}
