"use client";

import { useTranslation } from "react-i18next";
import { CheckCircle2 } from "lucide-react";
import { motion } from "motion/react";
import { ScrollReveal } from "./scroll-reveal";

export function OverviewSection() {
  const { t } = useTranslation("landing");

  const items = t("overview.demonstrates.items", {
    returnObjects: true,
  }) as string[];

  return (
    <section id="overview" className="px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto w-full max-w-[84rem]">
        <ScrollReveal className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-medium text-muted-foreground">
            {t("overview.eyebrow")}
          </span>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {t("overview.title")}
          </h2>
        </ScrollReveal>

        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          <ScrollReveal>
            <div className="h-full rounded-2xl bg-card p-6 ring-1 ring-foreground/10">
              <h3 className="text-base font-semibold">
                {t("overview.what.title")}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {t("overview.what.body")}
              </p>
            </div>
          </ScrollReveal>
          <ScrollReveal delay={0.08}>
            <div className="h-full rounded-2xl bg-card p-6 ring-1 ring-foreground/10">
              <h3 className="text-base font-semibold">
                {t("overview.why.title")}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {t("overview.why.body")}
              </p>
            </div>
          </ScrollReveal>
        </div>

        <ScrollReveal delay={0.12} className="mt-4">
          <div className="rounded-2xl bg-muted/40 p-6 ring-1 ring-foreground/5 sm:p-8">
            <h3 className="text-base font-semibold">
              {t("overview.demonstrates.title")}
            </h3>
            <motion.ul
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              variants={{
                hidden: {},
                visible: { transition: { staggerChildren: 0.05 } },
              }}
              className="mt-4 grid gap-x-6 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3"
            >
              {items.map((item) => (
                <motion.li
                  key={item}
                  variants={{
                    hidden: { opacity: 0, x: -8 },
                    visible: { opacity: 1, x: 0 },
                  }}
                  className="flex items-start gap-2 text-sm text-muted-foreground"
                >
                  <CheckCircle2
                    className="mt-0.5 size-4 shrink-0 text-primary"
                    aria-hidden
                  />
                  <span>{item}</span>
                </motion.li>
              ))}
            </motion.ul>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
