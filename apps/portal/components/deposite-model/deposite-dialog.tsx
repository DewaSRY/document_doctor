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
import { depositSchema } from "@/feature/account-transaction";
import { zodResolverTranslate } from "@/lib/form";

import { AccountStep } from "./account-step";
import { DetailsStep } from "./details-step";
import { PreviewStep } from "./preview-step";
import { useDepositeStore } from "./store";

interface Props {
  open?: boolean;
  setOpen?: (open: boolean) => void;
}

export function useDepositeDetailsForm(t: (key: string) => string) {
  return useForm({
    resolver: zodResolverTranslate(depositSchema, t),
    defaultValues: {
      amount: "",
      description: "",
    },
  });
}

export type DepositeForm = ReturnType<typeof useDepositeDetailsForm>;

export function DepositeDialog({ open, setOpen }: Props) {
  const { t } = useTranslation("deposit");
  const { step, reset, selectedAccount } = useDepositeStore();

  const form = useDepositeDetailsForm(t);
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
    return () => {
      setGuard(false);
      reset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isDirty, setGuard, form]);

  const STEP_COPY = {
    account: {
      title: t("depositFundsTitle"),
      description: t("selectAccountDescription"),
    },
    details: {
      title: t("depositFundsTitle"),
      description: t("enterDetailsDescription"),
    },
    preview: {
      title: t("reviewDepositTitle"),
      description: t("reviewDepositDescription"),
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
          <DialogTitle className="text-xl font-bold">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {step === "account" && <AccountStep form={form} />}
        {step === "details" && <DetailsStep form={form} />}
        {step === "preview" && (
          <PreviewStep form={form} onSuccess={handleSuccessClose} />
        )}
      </DialogContent>
    </Dialog>
  );
}
