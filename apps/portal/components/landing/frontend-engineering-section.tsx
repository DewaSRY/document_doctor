"use client";

import { useTranslation } from "react-i18next";
import { ScrollReveal } from "./scroll-reveal";
import { InteractiveFlow } from "./interactive-flow";

export function FrontendEngineeringSection() {
  const { t } = useTranslation("landing");

  const steps = t("frontend.steps", { returnObjects: true }) as Array<{
    title: string;
    summary: string;
    detail: string;
  }>;
  const notes = t("frontend.notes", { returnObjects: true }) as string[];

  return (
    <section id="frontend" className="px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto w-full max-w-[84rem]">
        <ScrollReveal className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-medium text-muted-foreground">
            {t("frontend.eyebrow")}
          </span>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {t("frontend.title")}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground text-balance">
            {t("frontend.subtitle")}
          </p>
        </ScrollReveal>

        <ScrollReveal delay={0.1} className="mt-12">
          <InteractiveFlow steps={steps} />

          <div className="mx-auto mt-5 flex w-fit items-center gap-2 rounded-full border border-dashed border-foreground/20 px-4 py-2 text-xs font-medium text-muted-foreground">
            <span className="size-1.5 rounded-full bg-primary" aria-hidden />
            {t("frontend.prefetch.label")}
          </div>
          <p className="mx-auto mt-2 max-w-lg text-center text-sm text-muted-foreground">
            {t("frontend.prefetch.description")}
          </p>
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
