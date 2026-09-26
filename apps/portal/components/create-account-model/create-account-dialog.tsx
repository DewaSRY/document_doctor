import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolverTranslate } from "@/lib/form";
import { createAccountSchema } from "@/feature/account";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useNavigationGuardStore } from "@/components/common/navigation-guard/store";

import { FormStep } from "./form-step";
import { PreviewStep } from "./preview-step";
import { useCreateAccountStore } from "./store";

export interface props {
  open?: boolean;
  setOpen?: (open: boolean) => void;
}

export function useCreateAccountForm(t: (key: string) => string) {
  return useForm({
    resolver: zodResolverTranslate(createAccountSchema, t),
    defaultValues: {
      name: "",
      description: "",
    },
  });
}

export type CreateForm = ReturnType<typeof useCreateAccountForm>;

export function CreateAccountDialog({ open, setOpen }: props) {
  const { t } = useTranslation("account");
  const { step, reset, values } = useCreateAccountStore();

  const form = useCreateAccountForm(t);
  const isDirty = form.formState.isDirty;

  const setGuard = useNavigationGuardStore((s) => s.setGuard);

  const requestNavigation = useNavigationGuardStore((s) => s.requestNavigation);

  useEffect(() => {
    if (!open) return;
    setGuard(isDirty, {
      onAbort: () => {
        form.reset();
        reset();
      },
    });
    return () => setGuard(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isDirty, setGuard, form]);

  const STEP_COPY = {
    form: {
      title: t("createAccountTitle"),
      description: t("createAccountDescription"),
    },
    preview: {
      title: t("reviewAccountTitle"),
      description: t("reviewAccountDescription"),
    },
  } as const;

  const { title, description } = STEP_COPY[step];

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setOpen?.(true);
      reset();
      return;
    }
    requestNavigation(() => setOpen?.(false));
  }

  function handleSuccessClose() {
    setGuard(false);
    setOpen?.(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="lg:min-w-4xl px-4 space-y-4">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {step === "form" && <FormStep form={form} />}
        {step === "preview" && (
          <PreviewStep onSuccess={handleSuccessClose} form={form} />
        )}
      </DialogContent>
    </Dialog>
  );
}
