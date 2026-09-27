"use client";

import { useTranslation } from "react-i18next";

import { Link } from "@/i18n/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { LocaleSwitcher } from "@/components/locale-switcher";

export function TranslatorHeader() {
  const { t } = useTranslation("translator");
  const { t: tCommon } = useTranslation("common");

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur supports-backdrop-filter:bg-background/70">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          aria-label={t("header.home")}
          className="rounded-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <BrandLogo name={tCommon("appName")} />
        </Link>
        <LocaleSwitcher />
      </div>
    </header>
  );
}
