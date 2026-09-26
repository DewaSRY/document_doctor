"use client";

import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "motion/react";
import { getEntryLabel } from "@/feature/account-transaction";
import {
  toDisplayLedgerEntry,
  type OnboardingEntry,
} from "@/feature/onboarding";
import { formatAccountAmount } from "@/lib/number";
import { getEntryVisual } from "@/components/account/entry-visual";

interface Props {
  entries: OnboardingEntry[];
  limit?: number;
}

export function RecentActivity({ entries, limit = 4 }: Props) {
  const { t } = useTranslation("account");

  if (entries.length === 0) return null;

  const shown = entries.slice(0, limit);

  return (
    <div>
      <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {t("accountEntriesTitle")}
      </p>
      <div className="space-y-1.5">
        <AnimatePresence initial={false}>
          {shown.map((entry) => {
            const display = toDisplayLedgerEntry(entry);
            const isIncoming = display.direction === "incoming";
            const { Icon, iconWrapperClassName, amountClassName } =
              getEntryVisual(display.type);

            return (
              <motion.div
                key={entry.id}
                layout
                initial={{ opacity: 0, y: -10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="flex items-center gap-3 rounded-xs border px-3 py-2.5"
              >
                <span
                  className={`flex size-8 shrink-0 items-center justify-center rounded-full ${iconWrapperClassName}`}
                >
                  <Icon className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {getEntryLabel(display, t)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {entry.description}
                  </p>
                </div>
                <span
                  className={`shrink-0 font-mono text-sm font-medium ${amountClassName}`}
                >
                  {formatAccountAmount(display.amount, "IDR", isIncoming)}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
