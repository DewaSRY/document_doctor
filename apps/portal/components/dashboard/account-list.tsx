"use client";
import { Fragment } from "react";

import { AlertCircle, Wallet } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getApiErrorMessage } from "@/lib/api/error";

import { useAccounts } from "@/feature/account";

import { AccountListItem } from "./account-card";
import { AccountCardSkeleton } from "./account-card-skeleton";
import { AccountListMessage } from "./account-list-message";

export function AccountList() {
  const { t } = useTranslation("common");
  const {
    data: accounts,
    error,
    isPending,
  } = useAccounts({ page: 1, limit: 10 });

  if (isPending) {
    return <AccountCardSkeleton />;
  }

  if (error) {
    return (
      <AccountListMessage icon={AlertCircle} className="text-destructive">
        {getApiErrorMessage(error, t("loadAccountsError"))}
      </AccountListMessage>
    );
  }

  if (!accounts || accounts.data.length === 0) {
    return (
      <AccountListMessage icon={Wallet}>{t("noAccounts")}</AccountListMessage>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {accounts.data.map((account) => (
          <Fragment key={account.id}>
            <AccountListItem account={account} />
          </Fragment>
        ))}
      </div>
    </div>
  );
}
