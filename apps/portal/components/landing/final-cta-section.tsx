"use client";

import { useTranslation } from "react-i18next";
import { ExternalLink } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { ScrollReveal } from "./scroll-reveal";

const REPO_URL = "https://github.com/DewaSRY/simple_bank_golang";

export function FinalCtaSection() {
  const { t } = useTranslation("landing");

  return (
    <section className="px-4 py-16 sm:px-6 sm:py-24">
      <ScrollReveal className="mx-auto flex w-full max-w-4xl flex-col items-center gap-6 rounded-3xl bg-primary px-6 py-14 text-center text-primary-foreground sm:px-16">
        <h2 className="max-w-xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          {t("finalCta.title")}
        </h2>
        <p className=" text-primary-foreground/70 text-balance">
          {t("finalCta.description")}
        </p>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Button
            size="lg"
            variant="secondary"
            className="h-12 px-8 text-base"
            nativeButton={false}
            render={<a href="#journey" />}
          >
            {t("finalCta.ctaExplore")}
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-12 border-primary-foreground/30 bg-transparent px-8 text-base text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            nativeButton={false}
            render={<Link href="/onboarding" />}
          >
            {t("finalCta.ctaDemo")}
          </Button>
          <Button
            size="lg"
            variant="ghost"
            className="h-12 gap-2 px-8 text-base text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            nativeButton={false}
            render={
              <a href={REPO_URL} target="_blank" rel="noopener noreferrer" />
            }
          >
            {t("finalCta.ctaSource")}
            <ExternalLink className="size-4" aria-hidden />
          </Button>
        </div>
      </ScrollReveal>
    </section>
  );
}
