"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, CheckCircle2, PlusCircle, Wallet } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InputField } from "@/components/form/input-field";
import { TextareaField } from "@/components/form/textarea-field";
import { MoneyInputField } from "@/components/form/money-input-field";
import { PreviewRow } from "@/components/common/preview-row";
import { AccountSummaryCard } from "@/components/account/account-summary-card";
import { formatAccountAmount } from "@/lib/number";
import {
  delay,
  onboardingCreateAccountSchema,
  toAccountWithUserName,
  useOnboardingStore,
  useOnboardingToastStore,
  type OnboardingCreateAccountFormValues,
} from "@/feature/onboarding";
import { zodResolverTranslate, scrollToFirstError } from "@/lib/form";

type Step = "form" | "preview";

export function CreateAccountFlow() {
  const { t } = useTranslation("account");
  const { t: tOnboarding } = useTranslation("onboarding");
  const { t: tCommon } = useTranslation("common");
  const account = useOnboardingStore((s) => s.account);
  const createAccount = useOnboardingStore((s) => s.createAccount);
  const pushToast = useOnboardingToastStore((s) => s.push);

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("form");
  const [values, setValues] = useState<OnboardingCreateAccountFormValues | null>(
    null,
  );
  const [isPending, setIsPending] = useState(false);

  const form = useForm({
    resolver: zodResolverTranslate(onboardingCreateAccountSchema, t),
    defaultValues: { name: "", description: "", currency: "IDR", openingBalance: "" },
  });

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setStep("form");
      form.reset();
    }
  }

  const onSubmit = form.handleSubmit(
    (data) => {
      setValues(data);
      setStep("preview");
    },
    (errors) => scrollToFirstError(errors),
  );

  async function handleConfirm() {
    if (!values) return;
    setIsPending(true);
    await delay(700);
    const created = createAccount({
      name: values.name,
      description: values.description,
      currency: values.currency,
      openingBalance: Number(values.openingBalance) || 0,
    });
    setIsPending(false);
    setOpen(false);
    pushToast({
      title: tOnboarding("toast.accountCreated"),
      description: tOnboarding("toast.accountCreatedDescription", { name: created.name }),
      variant: "success",
    });
  }

  return (
    <div className="space-y-4">
      <AnimatePresence mode="wait">
        {!account ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="items-center border-2 border-dashed bg-transparent py-12 text-center ring-0">
              <CardContent className="flex flex-col items-center gap-3">
                <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Wallet className="size-6" aria-hidden />
                </span>
                <div>
                  <p className="font-medium">{tOnboarding("createAccount.emptyTitle")}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {tOnboarding("createAccount.emptyDescription")}
                  </p>
                </div>
                <Button onClick={() => handleOpenChange(true)} className="mt-2 gap-1.5">
                  <PlusCircle className="size-4" aria-hidden />
                  {tOnboarding("createAccount.createButton")}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            key="created"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-3"
          >
            <div className="flex items-center gap-2 text-sm font-medium text-success">
              <CheckCircle2 className="size-4" aria-hidden />
              {tOnboarding("createAccount.createdBadge")}
            </div>
            <AccountSummaryCard account={toAccountWithUserName(account)} />

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="flex justify-end"
            >
              <Button nativeButton={false} render={<Link href="/onboarding/deposit" />} className="gap-1.5">
                {tOnboarding("createAccount.continueCta")}
                <ArrowRight className="size-4" aria-hidden />
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="p-4 lg:min-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {step === "form" ? t("createAccountTitle") : t("reviewAccountTitle")}
            </DialogTitle>
            <DialogDescription>
              {step === "form" ? t("createAccountDescription") : t("reviewAccountDescription")}
            </DialogDescription>
          </DialogHeader>

          {step === "form" && (
            <form onSubmit={onSubmit}>
              <div className="mb-6 space-y-4">
                <InputField
                  name="name"
                  label={t("name")}
                  control={form.control}
                  autoComplete="off"
                  placeholder={t("namePlaceholder")}
                />
                <TextareaField
                  name="description"
                  label={t("description")}
                  control={form.control}
                  maxLength={400}
                  counter
                  counterPosition="bottom"
                  placeholder={t("descriptionPlaceholder")}
                />
                <MoneyInputField
                  name="openingBalance"
                  currencyName="currency"
                  label={t("openingBalance")}
                  description={t("openingBalanceDescription")}
                  control={form.control}
                  placeholder={t("openingBalancePlaceholder")}
                />
              </div>
              <DialogFooter>
                <DialogClose render={<Button variant="outline">{tCommon("cancel")}</Button>} />
                <Button type="submit">{tCommon("continue")}</Button>
              </DialogFooter>
            </form>
          )}

          {step === "preview" && values && (
            <div>
              <Card className="mb-4">
                <CardContent className="space-y-3">
                  <PreviewRow label={t("name")} value={values.name} />
                  <PreviewRow label={t("description")} value={values.description} />
                  <PreviewRow
                    label={t("openingBalance")}
                    value={formatAccountAmount(
                      values.openingBalance || "0",
                      values.currency,
                    )}
                  />
                </CardContent>
              </Card>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep("form")}
                  disabled={isPending}
                >
                  {tCommon("back")}
                </Button>
                <Button type="button" onClick={handleConfirm} disabled={isPending}>
                  {isPending ? t("submitting") : tCommon("confirm")}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
