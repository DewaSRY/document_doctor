import { useTranslation } from "react-i18next";
import { AccountWithUserName, useAccounts } from "@/feature/account";
import { SearchInput } from "@/components/common/search-input";

import { AccountCard } from "./account-card";

import { useDepositeStore } from "./store";
import { useState } from "react";
import { DepositeForm } from "./deposite-dialog";

interface Props {
  form: DepositeForm;
}

export function AccountList({ form }: Props) {
  const { t } = useTranslation("common");
  const { setSelectedAccount, selectedAccount } = useDepositeStore();

  const [name, setName] = useState("");

  const { data: accounts } = useAccounts({
    name: name,
    page: 1,
    limit: 10,
  });

  function handleSearch(value: string) {
    setName(value);
  }

  function handleSelectAccount(account: AccountWithUserName) {
    setSelectedAccount(account);
    form.setValue("accountId", account.id, { shouldDirty: true });
  }

  return (
    <div>
      <SearchInput
        search={name}
        onSearch={handleSearch}
        placeholder={t("searchPlaceholder")}
      />

      <div className="space-y-2 py-2">
        {accounts?.data &&
          accounts?.data.length > 0 &&
          accounts.data.map((account, idx) => (
            <AccountCard
              key={`account-${account.id}-${idx}`}
              name={account.name}
              number={account.number}
              selected={selectedAccount?.id === account.id}
              onClick={() => handleSelectAccount(account)}
            />
          ))}
      </div>
    </div>
  );
}
