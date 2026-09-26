"use client";

import { useTranslation } from "react-i18next";
import { ScrollReveal } from "./scroll-reveal";

interface StackGroup {
  name: string;
  items: string[];
}

export function TechStackSection() {
  const { t } = useTranslation("landing");

  const groups = t("techStack.groups", { returnObjects: true }) as StackGroup[];

  return (
    <section
      id="tech-stack"
      className="bg-muted/30 px-4 py-16 sm:px-6 sm:py-24"
    >
      <div className="mx-auto w-full max-w-[84rem]">
        <ScrollReveal className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-medium text-muted-foreground">
            {t("techStack.eyebrow")}
          </span>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {t("techStack.title")}
          </h2>
        </ScrollReveal>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group, groupIndex) => (
            <ScrollReveal key={group.name} delay={groupIndex * 0.06}>
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {group.name}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {group.items.map((item) => (
                  <span
                    key={item}
                    className="rounded-full bg-card px-3 py-1 text-xs font-medium ring-1 ring-foreground/10"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
