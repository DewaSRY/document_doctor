import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { DialogClose, DialogFooter } from "@/components/ui/dialog";
import { SearchInput } from "@/components/common/search-input";
import { useAccounts } from "@/feature/account";

import { AccountCard } from "./account-card";
import { useTransferStore } from "./store";
import type { SourceAccount } from "./type";

export function SourceStep() {
  const { t } = useTranslation("transfer");
  const { t: tCommon } = useTranslation("common");
  const { sourceAccount, setSourceAccount, setStep } = useTransferStore();
  const [name, setName] = useState("");

  const { data: accounts } = useAccounts({ name, page: 1, limit: 10 });

  function handleSelect(account: SourceAccount) {
    setSourceAccount(account);
    setStep("destination");
  }

  return (
    <div>
      <SearchInput
        search={name}
        onSearch={setName}
        placeholder={t("searchAccountsPlaceholder")}
      />

      <div className="max-h-80 space-y-2 overflow-y-auto py-2">
        {accounts?.data &&
          accounts.data.length > 0 &&
          accounts.data.map((account, idx) => (
            <AccountCard
              key={`source-${account.id}-${idx}`}
              name={account.name}
              number={account.number}
              selected={sourceAccount?.id === account.id}
              onClick={() => handleSelect(account)}
            />
          ))}
      </div>

      <DialogFooter>
        <DialogClose
          render={<Button variant="outline">{tCommon("cancel")}</Button>}
        />
      </DialogFooter>
    </div>
  );
}
