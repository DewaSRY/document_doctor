import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { DialogClose, DialogFooter } from "@/components/ui/dialog";
import { InputField } from "@/components/form/input-field";
import { TextareaField } from "@/components/form/textarea-field";
import { CreateAccountFormValues } from "@/feature/account";
import { scrollToFirstError } from "@/lib/form";

import { useCreateAccountStore } from "./store";
import type { CreateForm } from "./create-account-dialog";

interface FormStepProps {
  form: CreateForm;
}

export function FormStep({ form }: FormStepProps) {
  const { t } = useTranslation("account");
  const { t: tCommon } = useTranslation("common");
  const { fieldErrors, setValues, setFieldErrors, setStep } =
    useCreateAccountStore();

  useEffect(() => {
    if (!fieldErrors) return;

    for (const [field, message] of Object.entries(fieldErrors)) {
      form.setError(field as keyof CreateAccountFormValues, { message });
    }
    setFieldErrors(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldErrors]);

  const onSubmit = form.handleSubmit(
    (data) => {
      setValues(data);
      setStep("preview");
    },
    (errors) => scrollToFirstError(errors),
  );

  return (
    <form onSubmit={onSubmit}>
      <div className="space-y-4 mb-6">
        <InputField
          name="name"
          label={t("name")}
          control={form.control}
          autoComplete="name"
          placeholder={t("namePlaceholder")}
        />
        <TextareaField
          name="description"
          label={t("description")}
          control={form.control}
          cols={40}
          maxLength={400}
          autoComplete="description"
          counter
          counterPosition="bottom"
          placeholder={t("descriptionPlaceholder")}
        />
      </div>

      <DialogFooter>
        <DialogClose
          render={<Button variant="outline">{tCommon("cancel")}</Button>}
        />
        <Button type="submit">{tCommon("continue")}</Button>
      </DialogFooter>
    </form>
  );
}
