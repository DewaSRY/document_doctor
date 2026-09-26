"use client";

import { useTranslation } from "react-i18next";
import { ScrollReveal } from "./scroll-reveal";
import { InteractiveFlow } from "./interactive-flow";

export function InfrastructureSection() {
  const { t } = useTranslation("landing");

  const steps = t("infrastructure.steps", { returnObjects: true }) as Array<{
    title: string;
    summary: string;
    detail: string;
  }>;
  const notes = t("infrastructure.notes", {
    returnObjects: true,
  }) as string[];

  return (
    <section id="deployment" className="px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto w-full max-w-[84rem]">
        <ScrollReveal className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-medium text-muted-foreground">
            {t("infrastructure.eyebrow")}
          </span>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {t("infrastructure.title")}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground text-balance">
            {t("infrastructure.subtitle")}
          </p>
        </ScrollReveal>

        <ScrollReveal delay={0.1} className="mt-12">
          <InteractiveFlow steps={steps} />
        </ScrollReveal>

        <div className="mt-12 grid gap-4 sm:grid-cols-2">
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
