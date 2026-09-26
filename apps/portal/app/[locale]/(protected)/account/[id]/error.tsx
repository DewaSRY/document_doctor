"use client";

import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { AccountStateMessage } from "@/components/account/account-state-message";

export default function AccountDetailError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useTranslation("account");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <AccountStateMessage
      title={t("loadErrorTitle")}
      description={t("loadErrorDescription")}
    />
  );
}
