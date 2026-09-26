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
import { transferDetailsSchema } from "@/feature/transfer";
import { zodResolverTranslate } from "@/lib/form";

import { DestinationStep } from "./destination-step";
import { DetailsStep } from "./details-step";
import { PreviewStep } from "./preview-step";
import { SourceStep } from "./source-step";
import { useTransferStore } from "./store";

interface Props {
  open?: boolean;
  setOpen?: (open: boolean) => void;
}

export function useTransferDetailsForm(t: (key: string) => string) {
  return useForm({
    resolver: zodResolverTranslate(transferDetailsSchema, t),
    defaultValues: {
      amount: "",
      description: "",
    },
  });
}

export type TransferForm = ReturnType<typeof useTransferDetailsForm>;

export function TransferDialog({ open, setOpen }: Props) {
  const { t } = useTranslation("transfer");
  const { step, reset } = useTransferStore();

  const form = useTransferDetailsForm(t);
  const isDirty = form.formState.isDirty;

  const setGuard = useNavigationGuardStore((s) => s.setGuard);
  const requestNavigation = useNavigationGuardStore(
    (s) => s.requestNavigation,
  );

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
    source: {
      title: t("transferFundsTitle"),
      description: t("selectSourceDescription"),
    },
    destination: {
      title: t("transferFundsTitle"),
      description: t("selectDestinationDescription"),
    },
    details: {
      title: t("transferFundsTitle"),
      description: t("enterDetailsDescription"),
    },
    preview: {
      title: t("reviewTransferTitle"),
      description: t("reviewTransferDescription"),
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
      <DialogContent className="p-4 lg:min-w-4xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {step === "source" && <SourceStep />}
        {step === "destination" && <DestinationStep />}
        {step === "details" && <DetailsStep form={form} />}
        {step === "preview" && (
          <PreviewStep form={form} onSuccess={handleSuccessClose} />
        )}
      </DialogContent>
    </Dialog>
  );
}
