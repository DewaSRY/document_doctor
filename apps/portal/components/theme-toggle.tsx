"use client";

import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "@/providers/theme-provider";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ThemeToggle() {
  const { t } = useTranslation("common");
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            className="rounded-lg"
            variant="outline"
            size="icon"
            aria-label={t("toggleTheme")}
          />
        }
      >
        <Sun className="scale-100 rotate-0 dark:scale-0 dark:-rotate-90" />
        <Moon className="absolute scale-0 rotate-90 dark:scale-100 dark:rotate-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {(
          [
            { value: "light", label: t("themeLight"), Icon: Sun },
            { value: "dark", label: t("themeDark"), Icon: Moon },
            { value: "system", label: t("themeSystem"), Icon: Monitor },
          ] as const
        ).map(({ value, label, Icon }) => (
          <DropdownMenuItem key={value} onClick={() => setTheme(value)}>
            <Icon /> {label}
            {theme === value && <Check className="ml-auto" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
