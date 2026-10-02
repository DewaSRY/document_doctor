"use client";

import { useState } from "react";
import { useFeatureGroupsQuery } from "@/feature/constant";
import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { TOOL_HREFS } from "@/feature/tools/constants";
import {
  FALLBACK_TOOL_COLOR,
  FALLBACK_TOOL_ICON,
  TOOL_COLORS,
  TOOL_ICONS,
} from "./tool-icons";
import type { ToolGroup } from "./tools-section";
import { START_HREF } from "./types";

const ALL = "all";

export function ToolGrid({
  groups,
  labels,
}: {
  groups: ToolGroup[];
  labels: {
    all: string;
    filters: string;
    formats: string;
    output: string;
    ai: string;
    comingSoon: string;
  };
}) {
  const [active, setActive] = useState(ALL);
  const filters = [{ id: ALL, title: labels.all }, ...groups];

  const tools = groups
    .filter((group) => active === ALL || group.id === active)
    .flatMap((group) =>
      group.items.map((tool) => ({ ...tool, group: group.id })),
    )
    .sort(
      (first, second) =>
        Number(Boolean(first.isComingSoon)) -
        Number(Boolean(second.isComingSoon)),
    );

  return (
    <>
      <div
        role="group"
        aria-label={labels.filters}
        className="flex flex-wrap justify-center gap-2"
      >
        {filters.map((filter) => (
          <button
            key={filter.id}
            type="button"
            aria-pressed={active === filter.id}
            onClick={() => setActive(filter.id)}
            className={cn(
              "h-9 rounded-full border px-5 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              active === filter.id
                ? "border-foreground bg-foreground text-background"
                : "bg-card text-foreground hover:border-foreground/40",
            )}
          >
            {filter.title}
          </button>
        ))}
      </div>

      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {tools.map((tool, index) => {
          const Icon = TOOL_ICONS[tool.icon] ?? FALLBACK_TOOL_ICON;

          const idKey = `${tool.group}-${tool.icon}-${index}`;

          const cardClassName = cn(
            "group relative flex w-full flex-col rounded-xl border border-transparent bg-card p-5 shadow-xs transition duration-200 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:min-h-52 sm:p-6",
            tool.isComingSoon
              ? "cursor-not-allowed"
              : "hover:border-border hover:shadow-lg",
          );
          const cardContent = (
            <>
              {tool.group === "documentAi" && (
                <span className="absolute top-5 right-5 rounded-md bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand-foreground">
                  {labels.ai}
                </span>
              )}
              <span
                className={cn(
                  "grid size-12 place-items-center rounded-lg text-white transition-transform duration-200 group-hover:scale-105 motion-reduce:group-hover:scale-100",
                  TOOL_COLORS[tool.icon] ?? FALLBACK_TOOL_COLOR,
                )}
              >
                <Icon className="size-6" aria-hidden />
              </span>
              <h3 className="mt-5 flex flex-wrap items-center gap-2 text-lg font-semibold">
                {tool.name}
                {tool.isComingSoon && (
                  <span className="rounded-full border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {labels.comingSoon}
                  </span>
                )}
              </h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-pretty text-muted-foreground">
                {tool.description}
              </p>
              {/* Input → output, so each card says what goes in and what comes back. */}
              <div className="mt-5 flex flex-col gap-2 border-t pt-4 text-xs">
                <p className="flex flex-wrap items-center gap-1.5">
                  <span className="sr-only">{labels.formats}: </span>
                  {tool.formats.map((format) => (
                    <span
                      key={format}
                      className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold text-foreground/80"
                    >
                      {format}
                    </span>
                  ))}
                  <ArrowRight
                    className="size-3.5 text-muted-foreground"
                    aria-hidden
                  />
                  <span className="sr-only">{labels.output}: </span>
                  <span className="font-medium text-foreground">
                    {tool.output}
                  </span>
                </p>
                <p className="text-muted-foreground">{tool.limit}</p>
              </div>
            </>
          );
          return (
            <li key={idKey} className="flex">
              {tool.isComingSoon ? (
                <div aria-disabled="true" className={cardClassName}>
                  {cardContent}
                </div>
              ) : (
                <Link
                  href={TOOL_HREFS[tool.icon] ?? START_HREF}
                  className={cardClassName}
                >
                  {cardContent}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
