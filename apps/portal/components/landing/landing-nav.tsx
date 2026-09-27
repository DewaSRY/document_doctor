"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Link } from "@/i18n/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { SECTION_IDS, TOOLS_HREF } from "./types";

const NAV_LINKS = [
  { id: SECTION_IDS.tools, key: "tools" },
  { id: SECTION_IDS.useCases, key: "useCases" },
  { id: SECTION_IDS.howItWorks, key: "howItWorks" },
  { id: SECTION_IDS.features, key: "features" },
  { id: SECTION_IDS.faq, key: "faq" },
] as const;

export function LandingNav() {
  const { t } = useTranslation("landing");
  const { t: tCommon } = useTranslation("common");
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur supports-backdrop-filter:bg-background/70">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          aria-label={t("nav.home")}
          className="rounded-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <BrandLogo name={tCommon("appName")} />
        </Link>

        <nav aria-label={t("nav.label")} className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <li key={link.id}>
                <a
                  href={`#${link.id}`}
                  className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  {t(`nav.links.${link.key}`)}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-1.5">
          <LocaleSwitcher />
          <a
            href={TOOLS_HREF}
            className={cn(
              buttonVariants(),
              "ml-1.5 hidden h-9 rounded-lg px-4 sm:inline-flex",
            )}
          >
            {t("nav.cta")}
          </a>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-lg lg:hidden"
                  aria-label={t("nav.menuOpen")}
                />
              }
            >
              <Menu aria-hidden />
            </SheetTrigger>
            <SheetContent side="right" className="gap-0">
              <SheetHeader>
                <SheetTitle>{t("nav.menuTitle")}</SheetTitle>
                <SheetDescription className="sr-only">
                  {t("nav.menuDescription")}
                </SheetDescription>
              </SheetHeader>
              <nav aria-label={t("nav.label")} className="px-4">
                <ul className="flex flex-col">
                  {NAV_LINKS.map((link) => (
                    <li key={link.id}>
                      <a
                        href={`#${link.id}`}
                        onClick={() => setOpen(false)}
                        className="block rounded-md px-2 py-3 text-base font-medium transition-colors hover:bg-muted"
                      >
                        {t(`nav.links.${link.key}`)}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
              <div className="mt-auto border-t p-4">
                <a
                  href={TOOLS_HREF}
                  onClick={() => setOpen(false)}
                  className={cn(buttonVariants(), "h-10 w-full rounded-lg")}
                >
                  {t("nav.cta")}
                </a>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
