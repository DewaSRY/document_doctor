"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SearchInput } from "@/components/common/search-input";
import { MoneyInputField } from "@/components/form/money-input-field";
import { TextareaField } from "@/components/form/textarea-field";
import { PreviewRow } from "@/components/common/preview-row";
import { AccountCard } from "@/components/transfer-modal/account-card";
import { AnimatedNumber } from "@/components/onboarding/animated-number";
import { RecentActivity } from "@/components/onboarding/recent-activity";
import { StepGuard } from "@/components/onboarding/step-guard";
import { Link } from "@/i18n/navigation";
import {
  transferDetailsSchema,
  type TransferDetailsFormValues,
} from "@/feature/transfer";
import {
  DIRECTORY_CONTACTS,
  InsufficientFundsError,
  delay,
  useOnboardingStore,
  useOnboardingToastStore,
  type DirectoryContact,
} from "@/feature/onboarding";
import { formatAccountAmount } from "@/lib/number";
import { zodResolverTranslate, scrollToFirstError } from "@/lib/form";

type Step = "destination" | "details" | "preview";

export function TransferFlow() {
  const { t } = useTranslation("transfer");
  const { t: tOnboarding } = useTranslation("onboarding");
  const { t: tCommon } = useTranslation("common");

  const account = useOnboardingStore((s) => s.account);
  const entries = useOnboardingStore((s) => s.entries);
  const transfer = useOnboardingStore((s) => s.transfer);
  const pushToast = useOnboardingToastStore((s) => s.push);

  const [step, setStep] = useState<Step>("destination");
  const [contact, setContact] = useState<DirectoryContact | null>(null);
  const [details, setDetails] = useState<{
    amount: number;
    description: string;
  } | null>(null);
  const [number, setNumber] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justTransferred, setJustTransferred] = useState(false);

  const form = useForm({
    resolver: zodResolverTranslate(transferDetailsSchema, t),
    defaultValues: { amount: "", description: "" },
  });

  if (!account) {
    return (
      <StepGuard
        title={tOnboarding("transfer.guardTitle")}
        description={tOnboarding("transfer.guardDescription")}
        cta={tOnboarding("transfer.guardCta")}
      />
    );
  }

  const recentContacts = DIRECTORY_CONTACTS.filter((c) => c.recent);
  const searchResults = DIRECTORY_CONTACTS.filter((c) =>
    c.number.toLowerCase().includes(number.trim().toLowerCase()),
  );

  function handleSelectContact(selected: DirectoryContact) {
    setContact(selected);
    setStep("details");
  }

  const onSubmit = form.handleSubmit(
    (data: TransferDetailsFormValues) => {
      setDetails({
        amount: Number(data.amount),
        description: data.description,
      });
      setStep("preview");
    },
    (errors) => scrollToFirstError(errors),
  );

  async function handleConfirm() {
    if (!contact || !details) return;
    setError(null);
    setIsPending(true);
    await delay(800);
    try {
      transfer({
        contact,
        amount: details.amount,
        description: details.description,
      });
      setIsPending(false);
      setJustTransferred(true);
      pushToast({
        title: tOnboarding("toast.transferSuccess"),
        description: tOnboarding("toast.transferSuccessDescription", {
          amount: formatAccountAmount(
            String(details.amount),
            account!.currency,
          ),
          name: contact.name,
        }),
        variant: "success",
      });
      form.reset();
      setStep("destination");
      setContact(null);
      setDetails(null);
    } catch (err) {
      setIsPending(false);
      if (err instanceof InsufficientFundsError) {
        setError(tOnboarding("transfer.insufficientFunds"));
        setStep("details");
        return;
      }
      setError(t("transferError"));
      pushToast({
        title: tOnboarding("toast.transferFailed"),
        variant: "error",
      });
    }
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
        {step === "destination" && (
          <motion.div
            key="destination"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.3 }}
          >
            <Tabs defaultValue="recent">
              <TabsList>
                <TabsTrigger value="recent">{t("recentTab")}</TabsTrigger>
                <TabsTrigger value="search">
                  {t("searchByNumberTab")}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="recent">
                <div className="space-y-2 py-2">
                  {recentContacts.length > 0 ? (
                    recentContacts.map((c) => (
                      <AccountCard
                        key={c.id}
                        name={c.name}
                        number={c.number}
                        subtitle={c.username}
                        selected={contact?.id === c.id}
                        onClick={() => handleSelectContact(c)}
                      />
                    ))
                  ) : (
                    <p className="py-4 text-center text-sm text-muted-foreground">
                      {t("noRecentTransactions")}
                    </p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="search">
                <SearchInput
                  search={number}
                  onSearch={setNumber}
                  placeholder={t("searchByNumberPlaceholder")}
                />
                <div className="space-y-2 py-2">
                  {number.trim().length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">
                      {t("enterAccountNumberPrompt")}
                    </p>
                  ) : searchResults.length > 0 ? (
                    searchResults.map((c) => (
                      <AccountCard
                        key={c.id}
                        name={c.name}
                        number={c.number}
                        subtitle={c.username}
                        selected={contact?.id === c.id}
                        onClick={() => handleSelectContact(c)}
                      />
                    ))
                  ) : (
                    <p className="py-4 text-center text-sm text-muted-foreground">
                      {t("noAccountsFound")}
                    </p>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </motion.div>
        )}

        {step === "details" && contact && (
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
                <PreviewRow
                  label={t("to")}
                  value={contact.name}
                  subValue={contact.number}
                />
                <MoneyInputField
                  name="amount"
                  label={t("amount")}
                  control={form.control}
                  currency={account?.currency}
                  placeholder={t("amountPlaceholder")}
                />
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
            {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("destination")}
              >
                {tCommon("back")}
              </Button>
              <Button type="submit">{tCommon("continue")}</Button>
            </div>
          </motion.form>
        )}

        {step === "preview" && contact && details && (
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
                  label={t("from")}
                  value={account.name}
                  subValue={account.number}
                />
                <PreviewRow
                  label={t("to")}
                  value={contact.name}
                  subValue={contact.number}
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
            {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
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
                {isPending ? t("transferring") : t("confirmTransfer")}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <RecentActivity entries={entries} />

      {justTransferred && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex items-center justify-between gap-3 rounded-sm bg-success/10 p-4"
        >
          <div className="flex items-center gap-2 text-sm font-medium text-success">
            <Check className="size-4" aria-hidden />
            {tOnboarding("toast.transferSuccess")}
          </div>
          <Button
            size="sm"
            nativeButton={false}
            render={<Link href="/onboarding/complete" />}
            className="gap-1.5"
          >
            {tOnboarding("transfer.continueCta")}
            <ArrowRight className="size-3.5" aria-hidden />
          </Button>
        </motion.div>
      )}
    </div>
  );
}
