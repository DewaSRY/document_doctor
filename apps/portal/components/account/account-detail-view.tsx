"use client";

import { useState } from "react";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useRouter } from "@/i18n/navigation";

import { useAccountDetail } from "@/feature/account-manage";

import { AccountStateMessage } from "@/components/account/account-state-message";
import { AccountSummaryCard } from "@/components/account/account-summary-card";
import { AccountDetailsCard } from "@/components/account/account-details-card";
import { AccountEntriesCard } from "@/components/account/account-entries-card";
import { Button } from "@/components/ui/button";
import { EditAccountDialog } from "@/components/edit-account-model/edit-account-dialog";
import { DeleteAccountDialog } from "@/components/delete-account-model/delete-account-dialog";

export function AccountDetailView({ accountId }: { accountId: number }) {
  const { t } = useTranslation("account");
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data: accountDetail } = useAccountDetail(accountId);

  const account = accountDetail?.data;

  if (!account) {
    return (
      <AccountStateMessage
        title={t("notFoundTitle")}
        description={t("notFoundDescription")}
      />
    );
  }

  return (
    <main className="flex flex-1 flex-col bg-background px-4 py-6 sm:px-6">
      <div className="mx-auto w-full max-w-[84rem] space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {t("backToDashboard")}
          </Link>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil aria-hidden />
              {t("edit")}
            </Button>
            <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 aria-hidden />
              {t("delete")}
            </Button>
          </div>
        </div>

        <EditAccountDialog
          account={account}
          open={editOpen}
          setOpen={setEditOpen}
        />
        <DeleteAccountDialog
          account={account}
          open={deleteOpen}
          setOpen={setDeleteOpen}
          onDeleted={() => router.push("/dashboard")}
        />

        <section className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <AccountSummaryCard account={account} />
          <AccountDetailsCard account={account} />
        </section>

        <AccountEntriesCard
          accountName={account.name}
          accountId={accountId}
          currency={account.currency}
        />
      </div>
    </main>
  );
}
