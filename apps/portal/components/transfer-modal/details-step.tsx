import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { MoneyInputField } from "@/components/form/money-input-field";
import { TextareaField } from "@/components/form/textarea-field";
import { scrollToFirstError } from "@/lib/form";
import type { TransferDetailsFormValues } from "@/feature/transfer";

import type { TransferForm } from "./transfer-dialog";
import { useTransferStore } from "./store";

interface Props {
  form: TransferForm;
}

export function DetailsStep({ form }: Props) {
  const { t } = useTranslation("transfer");
  const { t: tCommon } = useTranslation("common");
  const { fieldErrors, sourceAccount, setDetails, setFieldErrors, setStep } =
    useTransferStore();

  useEffect(() => {
    if (!fieldErrors) return;

    for (const [field, message] of Object.entries(fieldErrors)) {
      form.setError(field as keyof TransferDetailsFormValues, { message });
    }
    setFieldErrors(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldErrors]);

  const onSubmit = form.handleSubmit(
    (data) => {
      setDetails({
        amount: Number(data.amount),
        description: data.description,
      });
      setStep("preview");
    },
    (errors) => scrollToFirstError(errors),
  );

  return (
    <form onSubmit={onSubmit}>
      <div className="space-y-4 mb-6">
        <MoneyInputField
          name="amount"
          label={t("amount")}
          control={form.control}
          currency={sourceAccount?.currency}
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
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={() => setStep("destination")}
        >
          {tCommon("back")}
        </Button>
        <Button type="submit">{tCommon("continue")}</Button>
      </DialogFooter>
    </form>
  );
}
