"use client";

import { useTranslation } from "react-i18next";
import { ScrollReveal } from "./scroll-reveal";
import { InteractiveFlow } from "./interactive-flow";

export function BackendEngineeringSection() {
  const { t } = useTranslation("landing");

  const steps = t("backend.steps", { returnObjects: true }) as Array<{
    title: string;
    summary: string;
    detail: string;
  }>;

  return (
    <section id="backend" className="bg-muted/30 px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto w-full max-w-[84rem]">
        <ScrollReveal className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-medium text-muted-foreground">
            {t("backend.eyebrow")}
          </span>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {t("backend.title")}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground text-balance">
            {t("backend.subtitle")}
          </p>
        </ScrollReveal>
        <div className="mx-auto ">
          <ScrollReveal delay={0.1} className="mt-12">
            <InteractiveFlow steps={steps} />
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
