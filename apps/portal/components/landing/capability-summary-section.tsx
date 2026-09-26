"use client";

import { useTranslation } from "react-i18next";
import { ScrollReveal } from "./scroll-reveal";

interface CapabilityItem {
  title: string;
  body: string;
}

interface CapabilityGroup {
  name: string;
  items: CapabilityItem[];
}

export function CapabilitySummarySection() {
  const { t } = useTranslation("landing");

  const groups = t("capabilities.groups", {
    returnObjects: true,
  }) as CapabilityGroup[];

  return (
    <section id="capabilities" className="px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto w-full max-w-[84rem]">
        <ScrollReveal className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-medium text-muted-foreground">
            {t("capabilities.eyebrow")}
          </span>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {t("capabilities.title")}
          </h2>
        </ScrollReveal>

        <div className="mt-12 grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
          {groups.map((group, groupIndex) => (
            <ScrollReveal key={group.name} delay={groupIndex * 0.08}>
              <div className="h-full rounded-2xl bg-card p-6 ring-1 ring-foreground/10">
                <h3 className="text-sm font-semibold tracking-wide text-primary uppercase">
                  {group.name}
                </h3>
                <ul className="mt-4 flex flex-col gap-4">
                  {group.items.map((item) => (
                    <li key={item.title}>
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                        {item.body}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
