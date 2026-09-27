"use client";

import { useState } from "react";
import { ChevronDown, Menu } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Link, usePathname } from "@/i18n/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { TOOL_HREFS } from "@/feature/tools/constants";
import {
  FALLBACK_TOOL_COLOR,
  FALLBACK_TOOL_ICON,
  TOOL_COLORS,
  TOOL_ICONS,
} from "./tool-icons";
import type { ToolGroup } from "./tools-section";
import { SECTION_IDS, START_HREF } from "./types";

const SECTION_LINKS = [
  { id: SECTION_IDS.useCases, key: "useCases" },
  { id: SECTION_IDS.features, key: "features" },
  { id: SECTION_IDS.faq, key: "faq" },
] as const;

const QUICK_LINK_CLASS =
  "rounded-md px-3 py-2 text-[13px] font-semibold tracking-wide uppercase transition-colors hover:text-brand focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";

function ToolIcon({ tool, size = "sm" }: { tool: string; size?: "sm" | "md" }) {
  const Icon = TOOL_ICONS[tool] ?? FALLBACK_TOOL_ICON;
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-md text-white",
        size === "sm" ? "size-6" : "size-8",
        TOOL_COLORS[tool] ?? FALLBACK_TOOL_COLOR,
      )}
    >
      <Icon
        className={cn(size === "sm" ? "size-3.5" : "size-4", "text-white!")}
        aria-hidden
      />
    </span>
  );
}

export function LandingNav() {
  const { t } = useTranslation("landing");
  const { t: tCommon } = useTranslation("common");
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const quick = t("nav.quick", { returnObjects: true }) as unknown as string[];
  const groups = t("tools.groups", {
    returnObjects: true,
  }) as unknown as ToolGroup[];

  return (
    <header className="sticky top-0 z-40 border-b bg-card shadow-xs">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            aria-label={t("nav.home")}
            className="rounded-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <BrandLogo name={tCommon("appName")} />
          </Link>

          <nav aria-label={t("nav.label")} className="hidden lg:block">
            <ul className="flex items-center">
              {quick.map((tool) => (
                <li key={tool}>
                  <Link
                    href={TOOL_HREFS[tool] ?? START_HREF}
                    aria-current={pathname === TOOL_HREFS[tool] ? "page" : undefined}
                    className={cn(QUICK_LINK_CLASS, "aria-[current=page]:text-brand")}
                  >
                    {t(`nav.quickLabels.${tool}`)}
                  </Link>
                </li>
              ))}
              <li>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className={cn(
                      QUICK_LINK_CLASS,
                      "inline-flex items-center gap-1 data-popup-open:text-brand",
                    )}
                  >
                    {t("nav.allTools")}
                    <ChevronDown className="size-3.5" aria-hidden />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    sideOffset={12}
                    className="grid w-auto min-w-176 grid-cols-3 gap-2 p-4"
                  >
                    {groups.map((group) => (
                      <DropdownMenuGroup key={group.id}>
                        <DropdownMenuLabel className="text-xs font-semibold tracking-wide uppercase">
                          {group.title}
                        </DropdownMenuLabel>
                        {group.items.map((tool) => (
                          <DropdownMenuItem
                            key={tool.icon}
                            className="cursor-pointer gap-2.5 rounded-md py-2"
                            render={
                              <Link href={TOOL_HREFS[tool.icon] ?? START_HREF} />
                            }
                          >
                            <ToolIcon tool={tool.icon} />
                            <span className="font-medium">{tool.name}</span>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuGroup>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            </ul>
          </nav>
        </div>

        <div className="flex items-center gap-1.5">
          <ul className="hidden items-center xl:flex">
            {SECTION_LINKS.map((link) => (
              <li key={link.id}>
                <Link
                  href={`/#${link.id}`}
                  className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {t(`nav.links.${link.key}`)}
                </Link>
              </li>
            ))}
          </ul>
          <LocaleSwitcher />

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
            <SheetContent side="right" className="gap-0 overflow-y-auto">
              <SheetHeader>
                <SheetTitle>{t("nav.menuTitle")}</SheetTitle>
                <SheetDescription className="sr-only">
                  {t("nav.menuDescription")}
                </SheetDescription>
              </SheetHeader>
              <nav aria-label={t("nav.label")} className="flex flex-col gap-6 px-4 pb-6">
                {groups.map((group) => (
                  <div key={group.id}>
                    <p className="px-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      {group.title}
                    </p>
                    <ul className="mt-2 flex flex-col">
                      {group.items.map((tool) => (
                        <li key={tool.icon}>
                          <Link
                            href={TOOL_HREFS[tool.icon] ?? START_HREF}
                            aria-current={
                              pathname === TOOL_HREFS[tool.icon] ? "page" : undefined
                            }
                            onClick={() => setOpen(false)}
                            className="flex items-center gap-3 rounded-md px-2 py-2.5 text-base font-medium transition-colors hover:bg-muted"
                          >
                            <ToolIcon tool={tool.icon} size="md" />
                            {tool.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                <ul className="flex flex-col border-t pt-4">
                  {SECTION_LINKS.map((link) => (
                    <li key={link.id}>
                      <Link
                        href={`/#${link.id}`}
                        onClick={() => setOpen(false)}
                        className="block rounded-md px-2 py-2.5 text-base transition-colors hover:bg-muted"
                      >
                        {t(`nav.links.${link.key}`)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
