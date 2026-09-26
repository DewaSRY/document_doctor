"use client";

import { useTranslation } from "react-i18next";
import { ArrowRight, ArrowDown, Table2 } from "lucide-react";
import { ScrollReveal } from "./scroll-reveal";

interface Entity {
  name: string;
  description: string;
  columns: string[];
}

function EntityCard({ entity, delay }: { entity: Entity; delay: number }) {
  return (
    <ScrollReveal delay={delay} className="h-full">
      <div className="flex h-full flex-col rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-xs bg-primary/10 text-primary">
            <Table2 className="size-4" aria-hidden />
          </span>
          <p className="font-mono text-sm font-semibold">{entity.name}</p>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {entity.description}
        </p>
        <ul className="mt-3 flex flex-1 flex-col gap-1 border-t border-foreground/10 pt-3">
          {entity.columns.map((column) => (
            <li
              key={column}
              className="truncate font-mono text-[11px] text-muted-foreground"
            >
              {column}
            </li>
          ))}
        </ul>
      </div>
    </ScrollReveal>
  );
}

export function DatabaseArchitectureSection() {
  const { t } = useTranslation("landing");

  const entities = t("database.entities", { returnObjects: true }) as Entity[];
  const relationships = t("database.relationships", {
    returnObjects: true,
  }) as string[];
  const constraints = t("database.constraints", {
    returnObjects: true,
  }) as string[];

  const [users, accounts, transfers, entries] = entities;

  return (
    <section id="database" className="bg-muted/30 px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto w-full max-w-[84rem]">
        <ScrollReveal className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-medium text-muted-foreground">
            {t("database.eyebrow")}
          </span>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {t("database.title")}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground text-balance">
            {t("database.subtitle")}
          </p>
        </ScrollReveal>

        <div className="mt-12 flex flex-col items-center gap-4">
          <div className="w-full max-w-xs">
            <EntityCard entity={users} delay={0} />
          </div>

          <ArrowDown
            className="size-5 shrink-0 text-muted-foreground/40"
            aria-hidden
          />

          <div className="w-full max-w-xs">
            <EntityCard entity={accounts} delay={0.05} />
          </div>

          <ArrowDown
            className="size-5 shrink-0 text-muted-foreground/40"
            aria-hidden
          />

          <div className="grid w-full gap-4 sm:grid-cols-2">
            <EntityCard entity={transfers} delay={0.1} />
            <EntityCard entity={entries} delay={0.15} />
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {transfers.name}
            <ArrowRight className="size-3.5" aria-hidden />
            {entries.name}
          </div>
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-2">
          <ScrollReveal>
            <h3 className="text-sm font-semibold tracking-wide text-foreground uppercase">
              {t("database.relationshipsLabel")}
            </h3>
            <ul className="mt-3 flex flex-col gap-2.5">
              {relationships.map((item) => (
                <li
                  key={item.slice(0, 32)}
                  className="text-sm leading-relaxed text-muted-foreground"
                >
                  {item}
                </li>
              ))}
            </ul>
          </ScrollReveal>
          <ScrollReveal delay={0.08}>
            <h3 className="text-sm font-semibold tracking-wide text-foreground uppercase">
              {t("database.constraintsLabel")}
            </h3>
            <ul className="mt-3 flex flex-col gap-2.5">
              {constraints.map((item) => (
                <li
                  key={item.slice(0, 32)}
                  className="text-sm leading-relaxed text-muted-foreground"
                >
                  {item}
                </li>
              ))}
            </ul>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
