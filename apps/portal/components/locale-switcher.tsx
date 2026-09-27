"use client";

import { Check, Languages } from "lucide-react";
import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { locales, type AppLocale } from "@/i18n/settings";
import { usePathname, useRouter } from "@/i18n/navigation";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function LocaleSwitcher() {
  const { t } = useTranslation("common");
  const router = useRouter();
  const pathname = usePathname();
  const { locale: activeLocale } = useParams<{ locale: AppLocale }>();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className="gap-1.5 rounded-lg px-2.5"
            aria-label={t("changeLanguage")}
          />
        }
      >
        <Languages aria-hidden />
        <span className="text-xs font-semibold uppercase">{activeLocale}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        {locales.map((loc) => (
          <DropdownMenuItem
            key={loc}
            lang={loc}
            onClick={() => router.replace(pathname, { locale: loc })}
          >
            {t(`localeNames.${loc}`)}
            {loc === activeLocale && (
              <Check className="ml-auto text-brand" aria-hidden />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
