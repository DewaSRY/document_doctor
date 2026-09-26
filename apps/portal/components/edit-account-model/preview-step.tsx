import { useState } from "react";
import { useTranslation } from "react-i18next";

import { PreviewRow } from "@/components/common/preview-row";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DialogFooter } from "@/components/ui/dialog";
import { useUpdateAccount } from "@/feature/account-manage";
import { getApiErrorMessage, getApiFieldErrors } from "@/lib/api/error";

import { useEditAccountStore } from "./store";
import type { EditForm } from "./edit-account-dialog";

interface Props {
  accountId: number;
  form: EditForm;
  onSuccess: () => void;
}

export function PreviewStep({ accountId, form, onSuccess }: Props) {
  const { t } = useTranslation("account");
  const { t: tCommon } = useTranslation("common");
  const { values, setStep, setFieldErrors, reset } = useEditAccountStore();
  const { mutateAsync, isPending } = useUpdateAccount(accountId);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    if (!values) return;

    setError(null);
    try {
      await mutateAsync(values);
      onSuccess();
      form.reset();
      reset();
    } catch (err) {
      const fieldErrors = getApiFieldErrors(err);
      if (fieldErrors) {
        setFieldErrors(fieldErrors);
        setStep("form");
        return;
      }
      setError(getApiErrorMessage(err, t("updateError")));
    }
  }

  if (!values) return null;

  return (
    <div>
      <Card className="mb-4">
        <CardContent className="space-y-3">
          <PreviewRow label={t("name")} value={values.name} />
          <PreviewRow label={t("description")} value={values.description} />
        </CardContent>
      </Card>

      {error && <p className="mb-2 text-sm text-destructive">{error}</p>}

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
  );
}
