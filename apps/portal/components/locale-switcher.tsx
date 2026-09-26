"use client";

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

  function handleLocaleChange(nextLocale: AppLocale) {
    router.replace(pathname, { locale: nextLocale });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger>
          <span className="cursor-pointer">{t("language")}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {locales.map((loc) => (
            <DropdownMenuItem key={loc}>
              <Button
                variant="ghost"
                onClick={() => handleLocaleChange(loc)}
                className="w-full justify-end"
              >
                {loc.toUpperCase()}
              </Button>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
