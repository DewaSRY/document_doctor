import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { SearchInput } from "@/components/common/search-input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSearchAccountByNumber } from "@/feature/account";
import { useRecentTransactions } from "@/feature/account-transaction";

import { AccountCard } from "./account-card";
import { useTransferStore } from "./store";
import type { DestinationAccount } from "./type";

export function DestinationStep() {
  const { t } = useTranslation("transfer");
  const { t: tCommon } = useTranslation("common");
  const { sourceAccount, destinationAccount, setDestinationAccount, setStep } =
    useTransferStore();
  const [number, setNumber] = useState("");

  const { data: recent } = useRecentTransactions(sourceAccount?.id ?? 0, {
    page: 1,
    limit: 10,
  });

  const { data: searchResults } = useSearchAccountByNumber(
    { number, page: 1, limit: 10 },
    { enabled: number.trim().length > 0 },
  );

  function handleSelect(account: DestinationAccount) {
    setDestinationAccount(account);
    setStep("details");
  }

  const recentResults = (recent?.data ?? []).filter(
    (account) => account.id !== sourceAccount?.id,
  );

  const numberResults = (searchResults?.data ?? []).filter(
    (account) => account.id !== sourceAccount?.id,
  );

  return (
    <div>
      <Tabs defaultValue="recent">
        <TabsList>
          <TabsTrigger value="recent">{t("recentTab")}</TabsTrigger>
          <TabsTrigger value="search">{t("searchByNumberTab")}</TabsTrigger>
        </TabsList>

        <TabsContent value="recent">
          <div className="max-h-80 space-y-2 overflow-y-auto py-2">
            {recentResults.length > 0 ? (
              recentResults.map((account, idx) => (
                <AccountCard
                  key={`recent-${account.id}-${idx}`}
                  name={account.name}
                  number={account.number}
                  subtitle={account.username}
                  selected={destinationAccount?.id === account.id}
                  onClick={() => handleSelect(account)}
                />
              ))
            ) : (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {t("noRecentTransactions")}
              </p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="search">
          <SearchInput
            search={number}
            onSearch={setNumber}
            placeholder={t("searchByNumberPlaceholder")}
          />
          <div className="max-h-80 space-y-2 overflow-y-auto py-2">
            {number.trim().length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {t("enterAccountNumberPrompt")}
              </p>
            ) : numberResults.length > 0 ? (
              numberResults.map((account, idx) => (
                <AccountCard
                  key={`search-${account.id}-${idx}`}
                  name={account.name}
                  number={account.number}
                  subtitle={account.username}
                  selected={destinationAccount?.id === account.id}
                  onClick={() => handleSelect(account)}
                />
              ))
            ) : (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {t("noAccountsFound")}
              </p>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={() => setStep("source")}
        >
          {tCommon("back")}
        </Button>
      </DialogFooter>
    </div>
  );
}
