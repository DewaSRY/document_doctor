"use client";

import { useTranslation } from "react-i18next";
import {
  KeyRound,
  ShieldCheck,
  Globe,
  AlertTriangle,
  Lock,
  Cookie,
} from "lucide-react";
import { motion } from "motion/react";
import { ScrollReveal } from "./scroll-reveal";

const ICONS = [KeyRound, ShieldCheck, Globe, AlertTriangle, Lock, Cookie];

export function SecuritySection() {
  const { t } = useTranslation("landing");

  const cards = t("security.cards", { returnObjects: true }) as Array<{
    title: string;
    body: string;
  }>;

  return (
    <section id="security" className="bg-muted/30 px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto w-full max-w-[84rem]">
        <ScrollReveal className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-medium text-muted-foreground">
            {t("security.eyebrow")}
          </span>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {t("security.title")}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground text-balance">
            {t("security.subtitle")}
          </p>
        </ScrollReveal>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card, index) => {
            const Icon = ICONS[index] ?? ShieldCheck;
            return (
              <ScrollReveal key={card.title} delay={index * 0.08}>
                <motion.div
                  whileHover={{ y: -2 }}
                  transition={{ duration: 0.2 }}
                  className="h-full rounded-2xl bg-card p-5 ring-1 ring-foreground/10"
                >
                  <span className="flex size-9 items-center justify-center rounded-xs bg-primary/10 text-primary">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <h3 className="mt-3 text-sm font-semibold">{card.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {card.body}
                  </p>
                </motion.div>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
