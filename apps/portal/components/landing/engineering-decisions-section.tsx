"use client";

import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import { ScrollReveal } from "./scroll-reveal";

interface Decision {
  problem: string;
  constraint: string;
  decision: string;
  result: string;
}

export function EngineeringDecisionsSection() {
  const { t } = useTranslation("landing");

  const items = t("decisions.items", { returnObjects: true }) as Decision[];
  const rowLabels: Array<[keyof Decision, string]> = [
    ["problem", t("decisions.labels.problem")],
    ["constraint", t("decisions.labels.constraint")],
    ["decision", t("decisions.labels.decision")],
    ["result", t("decisions.labels.result")],
  ];

  return (
    <section id="decisions" className="px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto w-full max-w-[84rem]">
        <ScrollReveal className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-medium text-muted-foreground">
            {t("decisions.eyebrow")}
          </span>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {t("decisions.title")}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground text-balance">
            {t("decisions.subtitle")}
          </p>
        </ScrollReveal>

        <div className="mt-12 grid gap-5 lg:grid-cols-2">
          {items.map((item, index) => (
            <ScrollReveal key={item.decision.slice(0, 32)} delay={index * 0.08}>
              <motion.div
                whileHover={{ y: -2 }}
                transition={{ duration: 0.2 }}
                className="h-full rounded-2xl bg-card p-6 ring-1 ring-foreground/10"
              >
                <dl className="flex flex-col gap-3">
                  {rowLabels.map(([key, label]) => (
                    <div key={key}>
                      <dt className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                        {label}
                      </dt>
                      <dd
                        className={
                          key === "decision"
                            ? "mt-0.5 text-sm font-medium text-foreground"
                            : "mt-0.5 text-sm leading-relaxed text-muted-foreground"
                        }
                      >
                        {item[key]}
                      </dd>
                    </div>
                  ))}
                </dl>
              </motion.div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
