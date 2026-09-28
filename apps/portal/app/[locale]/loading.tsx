"use client";

import { useTranslation } from "react-i18next";

import { SparkleLoader } from "@/components/ui/sparkle-loader";

export default function Loading() {
  const { t } = useTranslation("common");

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center">
      <SparkleLoader size="lg" label={t("loading")} />
    </div>
  );
}
