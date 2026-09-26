import { useState } from "react";
import { useTranslation } from "react-i18next";

import { PreviewRow } from "@/components/common/preview-row";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DialogFooter } from "@/components/ui/dialog";
import { useDeposit } from "@/feature/account-transaction";
import { formatAccountAmount } from "@/lib/number";
import { getApiErrorMessage, getApiFieldErrors } from "@/lib/api/error";

import type { DepositeForm } from "./deposite-dialog";
import { useDepositeStore } from "./store";

interface Props {
  form: DepositeForm;
  onSuccess: () => void;
}

export function PreviewStep({ form, onSuccess }: Props) {
  const { t } = useTranslation("deposit");
  const { t: tCommon } = useTranslation("common");
  const { selectedAccount, details, setStep, setFieldErrors, reset } =
    useDepositeStore();
  const [error, setError] = useState<string | null>(null);

  const { mutateAsync, isPending } = useDeposit(selectedAccount?.id ?? 0);

  async function handleConfirm() {
    if (!selectedAccount || !details) return;

    setError(null);
    try {
      await mutateAsync(details);
      onSuccess();
      form.reset();
      reset();
    } catch (err) {
      const fieldErrors = getApiFieldErrors(err);
      if (fieldErrors) {
        setFieldErrors(fieldErrors);
        setStep("details");
        return;
      }
      setError(getApiErrorMessage(err, t("depositError")));
    }
  }

  if (!selectedAccount || !details) return null;

  return (
    <div>
      <Card className="mb-4">
        <CardContent className="space-y-3">
          <PreviewRow
            label={t("account")}
            value={selectedAccount.name}
            subValue={selectedAccount.number}
          />
          <PreviewRow
            label={t("amount")}
            value={formatAccountAmount(String(details.amount))}
          />
          <PreviewRow label={t("description")} value={details.description} />
        </CardContent>
      </Card>

      {error && <p className="mb-2 text-sm text-destructive">{error}</p>}

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={() => setStep("details")}
          disabled={isPending}
        >
          {tCommon("back")}
        </Button>
        <Button type="button" onClick={handleConfirm} disabled={isPending}>
          {isPending ? t("depositing") : t("confirmDeposit")}
        </Button>
      </DialogFooter>
    </div>
  );
}
