"use client";

import { useEffect } from "react";
import { AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

import { AccountListMessage } from "@/components/dashboard/account-list-message";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useTranslation("common");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex my-2 flex-1 flex-col gap-4 bg-background px-6 font-sans">
      <AccountListMessage icon={AlertCircle} className="text-destructive">
        {t("error.dashboardDescription")}
      </AccountListMessage>
      <Button onClick={reset} className="self-center">
        {t("tryAgain")}
      </Button>
    </div>
  );
}
