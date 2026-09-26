"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDeleteAccount } from "@/feature/account-manage";
import { getApiErrorMessage } from "@/lib/api/error";
import type { AccountWithUserName } from "@/feature/account";

interface Props {
  account: AccountWithUserName;
  open?: boolean;
  setOpen?: (open: boolean) => void;
  onDeleted: () => void;
}

export function DeleteAccountDialog({
  account,
  open,
  setOpen,
  onDeleted,
}: Props) {
  const { t } = useTranslation("account");
  const { t: tCommon } = useTranslation("common");
  const { mutateAsync, isPending } = useDeleteAccount(account.id);
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(nextOpen: boolean) {
    setOpen?.(nextOpen);
    if (nextOpen) setError(null);
  }

  async function handleConfirm() {
    setError(null);
    try {
      await mutateAsync();
      handleOpenChange(false);
      onDeleted();
    } catch (err) {
      setError(getApiErrorMessage(err, t("deleteError")));
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm px-4">
        <DialogHeader>
          <DialogTitle>{t("deleteAccountTitle")}</DialogTitle>
          <DialogDescription>
            {t("deleteAccountDescription", { name: account.name })}
          </DialogDescription>
        </DialogHeader>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
          >
            {tCommon("cancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={isPending}
          >
            {isPending ? t("deleting") : t("deleteAccountTitle")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
