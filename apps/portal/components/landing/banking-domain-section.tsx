"use client";

import { useTranslation } from "react-i18next";
import { Lock } from "lucide-react";
import { ScrollReveal } from "./scroll-reveal";
import { InteractiveFlow } from "./interactive-flow";

export function BankingDomainSection() {
  const { t } = useTranslation("landing");

  const steps = t("banking.steps", { returnObjects: true }) as Array<{
    title: string;
    summary: string;
    detail: string;
  }>;
  const notes = t("banking.notes", { returnObjects: true }) as string[];

  return (
    <section id="banking" className="px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto w-full max-w-[84rem]">
        <ScrollReveal className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-medium text-muted-foreground">
            {t("banking.eyebrow")}
          </span>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {t("banking.title")}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground text-balance">
            {t("banking.subtitle")}
          </p>
        </ScrollReveal>

        <ScrollReveal delay={0.1} className="mt-12">
          <InteractiveFlow steps={steps} />
        </ScrollReveal>

        <ScrollReveal
          delay={0.15}
          className="mx-auto mt-8 max-w-3xl rounded-2xl bg-primary/5 p-6 ring-1 ring-primary/20"
        >
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary">
              <Lock className="size-4" aria-hidden />
            </span>
            <div>
              <h3 className="text-sm font-semibold">
                {t("banking.lockCallout.title")}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {t("banking.lockCallout.body")}
              </p>
            </div>
          </div>
        </ScrollReveal>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {notes.map((note, index) => (
            <ScrollReveal key={note.slice(0, 32)} delay={index * 0.1}>
              <div className="h-full rounded-2xl bg-muted/40 p-5 text-sm leading-relaxed text-muted-foreground ring-1 ring-foreground/5">
                {note}
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
