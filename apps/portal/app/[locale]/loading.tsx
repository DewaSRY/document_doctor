"use client";

import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function Loading() {
  const { t } = useTranslation("common");

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center">
      <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
      <span className="sr-only">{t("loading")}</span>
    </div>
  );
}
