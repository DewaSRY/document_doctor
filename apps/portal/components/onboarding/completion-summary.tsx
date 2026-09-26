"use client";

import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import { ArrowRight, PartyPopper, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AccountSummaryCard } from "@/components/account/account-summary-card";
import { AnimatedNumber } from "@/components/onboarding/animated-number";
import { OnboardingEntriesCard } from "@/components/onboarding/onboarding-entries-card";
import { StepGuard } from "@/components/onboarding/step-guard";
import { Link, useRouter } from "@/i18n/navigation";
import { toAccountWithUserName, toDisplayLedgerEntry, useOnboardingStore } from "@/feature/onboarding";

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <Card size="sm" className="text-center">
      <CardContent className="py-2">
        <AnimatedNumber
          value={value}
          format={(v) => String(Math.round(v))}
          className="block font-mono text-2xl font-semibold tracking-tight text-primary"
        />
        <p className="mt-1 text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

export function CompletionSummary() {
  const { t } = useTranslation("onboarding");
  const router = useRouter();

  const account = useOnboardingStore((s) => s.account);
  const entries = useOnboardingStore((s) => s.entries);
  const depositCount = useOnboardingStore((s) => s.depositCount);
  const transferCount = useOnboardingStore((s) => s.transferCount);
  const reset = useOnboardingStore((s) => s.reset);

  if (!account || entries.length === 0) {
    return (
      <StepGuard
        title={t("complete.guardTitle")}
        description={t("complete.guardDescription")}
        cta={t("complete.guardCta")}
      />
    );
  }

  function handleRestart() {
    reset();
    router.push("/onboarding");
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col items-center gap-3 rounded-2xl bg-primary/5 py-8 text-center ring-1 ring-primary/10"
      >
        <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <PartyPopper className="size-7" aria-hidden />
        </span>
        <h2 className="text-xl font-semibold tracking-tight">{t("complete.title")}</h2>
        <p className="max-w-md text-sm text-muted-foreground">{t("complete.description")}</p>
      </motion.div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label={t("complete.statsAccounts")} value={1} />
        <StatTile label={t("complete.statsDeposits")} value={depositCount} />
        <StatTile label={t("complete.statsTransfers")} value={transferCount} />
        <StatTile label={t("complete.statsEntries")} value={entries.length} />
      </div>

      <AccountSummaryCard account={toAccountWithUserName(account)} />

      <OnboardingEntriesCard
        accountName={account.name}
        currency={account.currency}
        entries={entries.map(toDisplayLedgerEntry)}
      />

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex flex-col gap-3 sm:flex-row sm:justify-end"
      >
        <Button variant="outline" onClick={handleRestart} className="gap-1.5">
          <RotateCcw className="size-4" aria-hidden />
          {t("complete.ctaRestart")}
        </Button>
        <Button nativeButton={false} render={<Link href="/register" />} className="gap-1.5">
          {t("complete.ctaRegister")}
          <ArrowRight className="size-4" aria-hidden />
        </Button>
      </motion.div>
    </div>
  );
}
