"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useNavigationGuardStore } from "@/components/common/navigation-guard/store";
import {
  createAccountSchema,
  type AccountWithUserName,
} from "@/feature/account";
import { zodResolverTranslate } from "@/lib/form";

import { FormStep } from "./form-step";
import { PreviewStep } from "./preview-step";
import { useEditAccountStore } from "./store";

interface Props {
  account: AccountWithUserName;
  open?: boolean;
  setOpen?: (open: boolean) => void;
}

export function useEditAccountForm(
  t: (key: string) => string,
  account: AccountWithUserName,
) {
  return useForm({
    resolver: zodResolverTranslate(createAccountSchema, t),
    defaultValues: {
      name: account.name,
      description: account.description,
    },
  });
}

export type EditForm = ReturnType<typeof useEditAccountForm>;

export function EditAccountDialog({ account, open, setOpen }: Props) {
  const { t } = useTranslation("account");
  const { step, reset } = useEditAccountStore();

  const form = useEditAccountForm(t, account);
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
      title: t("editAccountTitle"),
      description: t("editAccountDescription"),
    },
    preview: {
      title: t("reviewChangesTitle"),
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
      <DialogContent className="p-4 lg:min-w-4xl space-y-4">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {step === "form" && <FormStep form={form} />}
        {step === "preview" && (
          <PreviewStep
            accountId={account.id}
            form={form}
            onSuccess={handleSuccessClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
