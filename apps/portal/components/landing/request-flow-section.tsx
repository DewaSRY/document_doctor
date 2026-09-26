"use client";

import { useTranslation } from "react-i18next";
import { ScrollReveal } from "./scroll-reveal";
import { InteractiveFlow } from "./interactive-flow";

export function RequestFlowSection() {
  const { t } = useTranslation("landing");

  const steps = t("requestFlow.steps", { returnObjects: true }) as Array<{
    title: string;
    summary: string;
    detail: string;
  }>;

  return (
    <section
      id="request-flow"
      className="bg-muted/30 px-4 py-16 sm:px-6 sm:py-24"
    >
      <div className="mx-auto w-full max-w-[84rem]">
        <ScrollReveal className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-medium text-muted-foreground">
            {t("requestFlow.eyebrow")}
          </span>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {t("requestFlow.title")}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground text-balance">
            {t("requestFlow.subtitle")}
          </p>
        </ScrollReveal>

        <ScrollReveal delay={0.1} className="mt-12">
          <InteractiveFlow steps={steps} />
        </ScrollReveal>
      </div>
    </section>
  );
}
