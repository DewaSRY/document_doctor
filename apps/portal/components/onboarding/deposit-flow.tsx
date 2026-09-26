"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MoneyInputField } from "@/components/form/money-input-field";
import { TextareaField } from "@/components/form/textarea-field";
import { PreviewRow } from "@/components/common/preview-row";
import { AnimatedNumber } from "@/components/onboarding/animated-number";
import { RecentActivity } from "@/components/onboarding/recent-activity";
import { StepGuard } from "@/components/onboarding/step-guard";
import { Link } from "@/i18n/navigation";
import {
  depositSchema,
  type DepositFormValues,
} from "@/feature/account-transaction";
import {
  delay,
  useOnboardingStore,
  useOnboardingToastStore,
} from "@/feature/onboarding";
import { formatAccountAmount } from "@/lib/number";
import { zodResolverTranslate, scrollToFirstError } from "@/lib/form";

type Step = "details" | "preview";

const QUICK_AMOUNTS = [100000, 500000, 1000000];

export function DepositFlow() {
  const { t } = useTranslation("deposit");
  const { t: tOnboarding } = useTranslation("onboarding");
  const { t: tCommon } = useTranslation("common");

  const account = useOnboardingStore((s) => s.account);
  const entries = useOnboardingStore((s) => s.entries);
  const deposit = useOnboardingStore((s) => s.deposit);
  const pushToast = useOnboardingToastStore((s) => s.push);

  const [step, setStep] = useState<Step>("details");
  const [details, setDetails] = useState<{
    amount: number;
    description: string;
  } | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [justDeposited, setJustDeposited] = useState(false);

  const form = useForm({
    resolver: zodResolverTranslate(depositSchema, t),
    defaultValues: { amount: "", description: "" },
  });

  if (!account) {
    return (
      <StepGuard
        title={tOnboarding("deposit.guardTitle")}
        description={tOnboarding("deposit.guardDescription")}
        cta={tOnboarding("deposit.guardCta")}
      />
    );
  }

  const onSubmit = form.handleSubmit(
    (data: DepositFormValues) => {
      setDetails({
        amount: Number(data.amount),
        description: data.description,
      });
      setStep("preview");
    },
    (errors) => scrollToFirstError(errors),
  );

  async function handleConfirm() {
    if (!details || !account) return;
    setIsPending(true);
    await delay(800);
    deposit(details);
    setIsPending(false);
    setJustDeposited(true);
    pushToast({
      title: tOnboarding("toast.depositSuccess"),
      description: tOnboarding("toast.depositSuccessDescription", {
        amount: formatAccountAmount(String(details.amount), account.currency),
      }),
      variant: "success",
    });
    form.reset();
    setStep("details");
    setDetails(null);
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-0 bg-primary text-primary-foreground shadow-lg">
        <CardContent className="flex items-center justify-between gap-4 p-6">
          <div>
            <p className="text-sm text-primary-foreground/65">{account.name}</p>
            <p className="text-xs text-primary-foreground/50">
              {account.number}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-primary-foreground/65">
              {tCommon("availableBalance")}
            </p>
            <AnimatedNumber
              value={account.balance}
              format={(v) =>
                formatAccountAmount(v.toFixed(2), account.currency)
              }
              className="block font-mono text-2xl font-semibold tracking-tight"
            />
          </div>
        </CardContent>
      </Card>

      <AnimatePresence mode="wait">
        {step === "details" && (
          <motion.form
            key="details"
            onSubmit={onSubmit}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.3 }}
          >
            <Card>
              <CardContent className="space-y-4">
                <div>
                  <MoneyInputField
                    name="amount"
                    label={t("amount")}
                    control={form.control}
                    currency={account.currency}
                    placeholder={t("amountPlaceholder")}
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="self-center text-xs text-muted-foreground">
                      {tOnboarding("deposit.quickAmounts")}
                    </span>
                    {QUICK_AMOUNTS.map((amount) => (
                      <button
                        key={amount}
                        type="button"
                        onClick={() =>
                          form.setValue("amount", String(amount), {
                            shouldValidate: true,
                            shouldDirty: true,
                          })
                        }
                        className="rounded-full border px-3 py-1 text-xs font-medium transition-colors hover:bg-muted active:scale-95"
                      >
                        {formatAccountAmount(String(amount), account.currency)}
                      </button>
                    ))}
                  </div>
                </div>
                <TextareaField
                  name="description"
                  label={t("description")}
                  control={form.control}
                  maxLength={200}
                  counter
                  counterPosition="bottom"
                  placeholder={t("descriptionPlaceholder")}
                />
              </CardContent>
            </Card>
            <div className="mt-4 flex justify-end">
              <Button type="submit">{tCommon("continue")}</Button>
            </div>
          </motion.form>
        )}

        {step === "preview" && details && (
          <motion.div
            key="preview"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.3 }}
          >
            <Card>
              <CardContent className="space-y-3">
                <PreviewRow
                  label={t("account")}
                  value={account.name}
                  subValue={account.number}
                />
                <PreviewRow
                  label={t("amount")}
                  value={formatAccountAmount(
                    String(details.amount),
                    account.currency,
                  )}
                />
                <PreviewRow
                  label={t("description")}
                  value={details.description}
                />
              </CardContent>
            </Card>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("details")}
                disabled={isPending}
              >
                {tCommon("back")}
              </Button>
              <Button
                type="button"
                onClick={handleConfirm}
                disabled={isPending}
              >
                {isPending ? t("depositing") : t("confirmDeposit")}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <RecentActivity entries={entries} />

      {justDeposited && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex items-center justify-between gap-3 rounded-sm bg-success/10 p-4"
        >
          <div className="flex items-center gap-2 text-sm font-medium text-success">
            <Check className="size-4" aria-hidden />
            {tOnboarding("toast.depositSuccess")}
          </div>
          <Button
            size="sm"
            nativeButton={false}
            render={<Link href="/onboarding/transfer" />}
            className="gap-1.5"
          >
            {tOnboarding("deposit.continueCta")}
            <ArrowRight className="size-3.5" aria-hidden />
          </Button>
        </motion.div>
      )}
    </div>
  );
}
