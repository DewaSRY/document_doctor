"use client";

import { Check, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import { Link, usePathname } from "@/i18n/navigation";
import { useOnboardingStore } from "@/feature/onboarding";
import { cn } from "@/lib/utils";

const STEP_PATHS = [
  "/onboarding",
  "/onboarding/create-account",
  "/onboarding/deposit",
  "/onboarding/transfer",
  "/onboarding/complete",
] as const;

const STEP_KEYS = [
  "start",
  "createAccount",
  "deposit",
  "transfer",
  "complete",
] as const;

export function OnboardingStepper() {
  const { t } = useTranslation("onboarding");
  const pathname = usePathname();
  const hasAccount = useOnboardingStore((s) => s.account !== null);
  const hasEntries = useOnboardingStore((s) => s.entries.length > 0);

  const unlocked = [true, true, hasAccount, hasAccount, hasEntries];
  const activeIndex = STEP_PATHS.indexOf(
    pathname as (typeof STEP_PATHS)[number],
  );

  return (
    <ol className="flex w-full items-center gap-1.5 overflow-x-auto sm:gap-2">
      {STEP_PATHS.map((href, index) => {
        const isActive = index === activeIndex;
        const isComplete = index < activeIndex;
        const isUnlocked = unlocked[index];
        const label = t(`steps.${STEP_KEYS[index]}`);

        return (
          <li
            key={href}
            className="flex shrink-0 items-center gap-1.5 sm:gap-2"
          >
            {isUnlocked ? (
              <Link
                href={href}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors sm:text-sm",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : isComplete
                      ? "text-foreground hover:bg-muted"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex size-4.5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold sm:size-5",
                    isActive
                      ? "bg-primary-foreground/20"
                      : isComplete
                        ? "bg-success/15 text-success"
                        : "bg-muted-foreground/15",
                  )}
                >
                  {isComplete ? (
                    <Check className="size-3" aria-hidden />
                  ) : (
                    index + 1
                  )}
                </span>
                <span className="hidden sm:inline">{label}</span>
              </Link>
            ) : (
              <span
                title={t("stepLocked")}
                className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs text-muted-foreground/50 sm:text-sm"
              >
                <span className="flex size-4.5 shrink-0 items-center justify-center rounded-full bg-muted-foreground/10 sm:size-5">
                  <Lock className="size-2.5" aria-hidden />
                </span>
                <span className="hidden sm:inline">{label}</span>
              </span>
            )}

            {index < STEP_PATHS.length - 1 && (
              <motion.span
                initial={false}
                animate={{
                  backgroundColor: isComplete
                    ? "var(--color-success)"
                    : "var(--color-border)",
                }}
                className="h-px w-3 shrink-0 sm:w-6"
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
