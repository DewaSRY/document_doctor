import type { AppLocale } from "@/i18n/settings";

import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { LogoutButton } from "@/components/auth/logout-button";

import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { siGithub } from "simple-icons";

export function SiteHeader({ locale }: { locale: AppLocale }) {
  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b bg-background/80 backdrop-blur-sm transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <div className="ml-auto flex items-center gap-2">
          <LocaleSwitcher />
          <ThemeToggle />
          <Separator
            orientation="vertical"
            className="mx-1 data-[orientation=vertical]:h-4"
          />
          <LogoutButton locale={locale} />
        </div>

        <Button variant="outline" size="icon">
          <Link
            href="https://github.com/DewaSRY/simple-bank"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View source code on GitHub"
          >
            <svg
              role="img"
              viewBox="0 0 24 24"
              className="size-4"
              fill="currentColor"
            >
              <path d={siGithub.path} />
            </svg>
          </Link>
        </Button>
      </div>
    </header>
  );
}
