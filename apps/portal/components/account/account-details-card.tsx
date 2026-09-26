"use client";

import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AccountWithUserName } from "@/feature/account";

export function AccountDetailsCard({
  account,
}: {
  account: AccountWithUserName;
}) {
  const { t } = useTranslation("account");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("accountDetailsTitle")}</CardTitle>
        <CardDescription>{t("accountDetailsDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs text-muted-foreground">{t("currency")}</p>
          <p className="mt-1 font-medium">{account.currency}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t("description")}</p>
          <p className="mt-1 font-medium">
            {account.description || t("noDescription")}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
