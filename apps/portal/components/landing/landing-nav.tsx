"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Popover } from "@base-ui/react/popover";
import {
  ChevronDown,
  Menu,
  Wallet,
  Layers,
  Server,
  Database,
  ShieldCheck,
  ArrowUpRight,
  Sparkles,
} from "lucide-react";
import { motion } from "motion/react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import { siGithub } from "simple-icons";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";

export function LandingNav() {
  const { t } = useTranslation("common");
  const { t: tLanding } = useTranslation("landing");
  const { t: tAuth } = useTranslation("auth");
  const [mobileOpen, setMobileOpen] = useState(false);

  const exploreItems = [
    {
      icon: Layers,
      title: tLanding("nav.links.architecture"),
      href: "#journey",
    },
    {
      icon: Server,
      title: tLanding("nav.links.backend"),
      href: "#backend",
    },
    {
      icon: Database,
      title: tLanding("nav.links.database"),
      href: "#database",
    },
    {
      icon: ShieldCheck,
      title: tLanding("nav.links.security"),
      href: "#security",
    },
  ];

  return (
    <header className="sticky top-0 z-50 w-full">
      {/* Background blur */}
      <div className="absolute inset-0 border-b border-border/40 bg-background/75 backdrop-blur-xl" />

      <div className="relative mx-auto flex h-[72px] w-full max-w-[84rem] items-center justify-between px-4 sm:px-6">
        {/* Logo */}
        <Link href="/" className="group flex items-center gap-2.5">
          <motion.span
            whileHover={{ rotate: -8, scale: 1.08 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            className="relative flex size-8 items-center justify-center overflow-hidden rounded-xs bg-primary text-primary-foreground shadow-sm"
          >
            <Wallet className="relative z-10 size-4" aria-hidden />

            <motion.span
              className="absolute inset-0 bg-white/20"
              initial={{ x: "-100%" }}
              whileHover={{ x: "100%" }}
              transition={{ duration: 0.5 }}
            />
          </motion.span>

          <span className="text-[15px] font-semibold tracking-tight">
            {t("appName")}
          </span>
        </Link>

        {/* Desktop navigation */}
        <nav className="hidden items-center gap-1 md:flex">
          <Popover.Root>
            <Popover.Trigger
              render={
                <Button
                  variant="ghost"
                  className="group relative h-9 gap-1.5 rounded-xs px-3 text-sm text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
                />
              }
            >
              {tLanding("nav.explore")}

              <ChevronDown className="size-3.5 transition-transform duration-200 group-data-popup-open/button:rotate-180" />

              {/* active underline */}
              <span className="absolute inset-x-3 -bottom-[1px] h-px origin-center scale-x-0 bg-primary transition-transform duration-200 group-hover:scale-x-100" />
            </Popover.Trigger>

            <Popover.Portal>
              <Popover.Positioner
                className="isolate z-50 outline-none"
                side="bottom"
                align="start"
                sideOffset={10}
              >
                <Popover.Popup className="w-[390px] origin-(--transform-origin) overflow-hidden rounded-xs border border-border/60 bg-popover/95 p-2 text-popover-foreground shadow-2xl shadow-black/10 backdrop-blur-xl duration-200 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
                  {/* Header */}
                  <div className="px-3 pb-2 pt-2">
                    <div className="flex items-center gap-2">
                      <span className="flex size-7 items-center justify-center rounded-xs bg-primary/10 text-primary">
                        <Sparkles className="size-3.5" />
                      </span>

                      <p className="text-sm font-semibold">
                        {tLanding("nav.explore")}
                      </p>
                    </div>

                    <p className="mt-1.5 pl-9 text-xs leading-relaxed text-muted-foreground">
                      {tLanding("nav.exploreDescription")}
                    </p>
                  </div>

                  {/* Items */}
                  <div className="grid grid-cols-2 gap-1 p-1">
                    {exploreItems.map((item) => (
                      <Popover.Close
                        key={item.title}
                        nativeButton={false}
                        render={
                          <a
                            href={item.href}
                            className="group flex items-center gap-3 rounded-xs p-3 transition-all duration-200 hover:bg-muted"
                          />
                        }
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-xs bg-primary/10 text-primary transition-transform duration-200 group-hover:scale-105 group-hover:bg-primary group-hover:text-primary-foreground">
                          <item.icon className="size-4" aria-hidden />
                        </span>

                        <span className="min-w-0">
                          <span className="block text-sm font-medium">
                            {item.title}
                          </span>

                          <span className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                            Explore
                            <ArrowUpRight className="size-3" />
                          </span>
                        </span>
                      </Popover.Close>
                    ))}
                  </div>
                </Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>
          </Popover.Root>
        </nav>

        {/* Desktop actions */}
        <div className="hidden items-center gap-1.5 md:flex">
          <LocaleSwitcher />
          <ThemeToggle />

          <div className="mx-1 h-5 w-px bg-border/70" />

          {/* GitHub */}
          <Tooltip>
            <TooltipTrigger>
              <Button
                variant="ghost"
                size="icon"
                className="size-9 rounded-xs text-muted-foreground hover:text-foreground"
                nativeButton={false}
                render={
                  <a
                    href="https://github.com/DewaSRY/simple_bank_golang"
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                }
              >
                <svg
                  role="img"
                  viewBox="0 0 24 24"
                  className="size-4"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d={siGithub.path} />
                </svg>
              </Button>
            </TooltipTrigger>

            <TooltipContent>{tLanding("nav.viewSource")}</TooltipContent>
          </Tooltip>

          {/* Try demo */}
          <div className="relative inline-flex rounded-xs p-[1px] overflow-hidden">
            <div className="absolute inset-[-100%] animate-[spin_3s_linear_infinite] bg-[conic-gradient(from_0deg,transparent_0%,transparent_40%,#6dec2e_50%,transparent_60%,transparent_100%)]" />

            <Link
              href="/onboarding"
              className="relative rounded-[5px] bg-background px-3 py-1 text-sm font-medium text-brand transition-colors ease-in-out duration-300 hover:text-foreground"
            >
              {tLanding("nav.tryDemo")}
            </Link>
          </div>

          {/* Login */}
          <Link
            href="/login"
            className="relative flex h-9 items-center rounded-xs px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {tAuth("login")}
          </Link>

          {/* CTA */}
          <div className="relative ml-1">
            <motion.div
              className="absolute -inset-[1px] rounded-xs bg-primary/50 blur-sm"
              animate={{
                opacity: [0.35, 0.7, 0.35],
              }}
              transition={{
                duration: 2.5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />

            <Button
              size="sm"
              className="relative h-9 rounded-xs px-4 shadow-sm"
              nativeButton={false}
              render={<Link href="/register" />}
            >
              {tLanding("nav.getStarted")}

              <ArrowUpRight className="ml-1 size-3.5" />
            </Button>
          </div>
        </div>

        {/* Mobile */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <Button
            variant="ghost"
            size="icon"
            className="size-9 rounded-xs md:hidden"
            aria-label={tLanding("nav.menuToggle")}
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="size-5" />
          </Button>

          <SheetContent
            side="right"
            className="w-full border-l-border/50 bg-background/95 backdrop-blur-xl sm:max-w-sm"
          >
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-xs bg-primary text-primary-foreground">
                  <Wallet className="size-4" />
                </span>

                {t("appName")}
              </SheetTitle>
            </SheetHeader>

            <div className="flex flex-col gap-1 px-4 pt-4">
              <p className="px-1 pb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {tLanding("nav.explore")}
              </p>

              {exploreItems.map((item) => (
                <SheetClose
                  key={item.title}
                  nativeButton={false}
                  render={
                    <a
                      href={item.href}
                      className="group flex items-center gap-3 rounded-xs p-3 transition-colors hover:bg-muted"
                    />
                  }
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xs bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <item.icon className="size-4" aria-hidden />
                  </span>

                  <span className="text-sm font-medium">{item.title}</span>

                  <ArrowUpRight className="ml-auto size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </SheetClose>
              ))}
            </div>

            <div className="mt-auto flex flex-col gap-3 border-t border-border/50 p-4">
              <div className="flex items-center justify-between rounded-xs border bg-muted/30 p-2">
                <LocaleSwitcher />
                <ThemeToggle />
              </div>

              <SheetClose
                nativeButton={false}
                render={<Link href="/onboarding" />}
                className="flex h-10 items-center justify-center rounded-xs text-sm font-medium transition-colors hover:bg-muted"
              >
                {tLanding("nav.tryDemo")}
              </SheetClose>

              <SheetClose
                nativeButton={false}
                render={<Link href="/login" />}
                className={cn(
                  "flex h-10 items-center justify-center rounded-xs text-sm font-medium transition-colors hover:bg-muted",
                )}
              >
                {tAuth("login")}
              </SheetClose>

              <Button
                nativeButton={false}
                render={<Link href="/register" />}
                className="h-10 w-full rounded-xs"
              >
                {tLanding("nav.getStarted")}
                <ArrowUpRight className="ml-1 size-4" />
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Loading/progress line */}
      <motion.div
        className="relative h-px w-full origin-left bg-border"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />
    </header>
  );
}
