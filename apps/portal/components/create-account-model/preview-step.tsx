import { useState } from "react";
import { useTranslation } from "react-i18next";

import { PreviewRow } from "@/components/common/preview-row";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DialogFooter } from "@/components/ui/dialog";
import { useCreateAccountMutation } from "@/feature/account";
import { getApiErrorMessage, getApiFieldErrors } from "@/lib/api/error";

import { useCreateAccountStore } from "./store";
import { CreateForm } from "./create-account-dialog";

interface Props {
  onSuccess: () => void;
  form: CreateForm;
}

export function PreviewStep({ onSuccess, form }: Props) {
  const { t } = useTranslation("account");
  const { t: tCommon } = useTranslation("common");
  const { values, setStep, setFieldErrors, reset } = useCreateAccountStore();
  const { mutateAsync, isPending } = useCreateAccountMutation();
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
      setError(getApiErrorMessage(err, t("registerError")));
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
