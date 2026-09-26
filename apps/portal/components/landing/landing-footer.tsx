"use client";

import { useTranslation } from "react-i18next";
import { Wallet, ExternalLink, Mail, Phone } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { AUTHOR } from "@/components/landing/author";

const REPO_URL = "https://github.com/DewaSRY/simple_bank_golang";

export function LandingFooter() {
  const { t } = useTranslation("common");
  const { t: tLanding } = useTranslation("landing");
  const { t: tAuth } = useTranslation("auth");

  return (
    <footer className="border-t px-4 py-10 sm:px-6">
      <div className="mx-auto flex w-full max-w-[84rem] flex-col items-center gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col items-center gap-2 sm:items-start">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-semibold tracking-tight"
          >
            <span className="flex size-6 items-center justify-center rounded-xs bg-primary text-primary-foreground">
              <Wallet className="size-3.5" aria-hidden />
            </span>
            {t("appName")}
          </Link>
          <p className="max-w-xs text-center text-sm text-muted-foreground sm:text-left">
            {tLanding("footer.tagline")}
          </p>
        </div>

        <div className="flex items-center gap-6 text-sm">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
          >
            {tLanding("nav.viewSource")}
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
          <Link
            href="/login"
            className="text-muted-foreground hover:text-foreground"
          >
            {tAuth("login")}
          </Link>
        </div>
      </div>
      <div className="mx-auto mt-8 w-full max-w-[84rem] border-t pt-6">
        <p className="text-center text-xs font-medium text-foreground sm:text-left">
          {tLanding("footer.author.heading", { name: AUTHOR.name })}
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground sm:justify-start">
          <a
            href={`mailto:${AUTHOR.email}`}
            className="flex items-center gap-1.5 hover:text-foreground"
          >
            <Mail className="size-3.5" aria-hidden />
            {AUTHOR.email}
          </a>
          <a
            href={AUTHOR.linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 hover:text-foreground"
          >
            {AUTHOR.linkedinLabel}
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
          <a
            href={AUTHOR.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 hover:text-foreground"
          >
            {AUTHOR.githubLabel}
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        </div>
      </div>
      <p className="mt-6 text-center text-xs text-muted-foreground sm:text-left">
        {tLanding("footer.builtBy")}
      </p>
      <p className="mt-2 text-center text-xs text-muted-foreground sm:text-left">
        © {new Date().getFullYear()} {t("appName")}. {tLanding("footer.rights")}
      </p>
    </footer>
  );
}
