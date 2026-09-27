import { ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { TOOL_HREFS } from "@/feature/tools/constants";
import { SectionHeading } from "./section-heading";
import { FALLBACK_TOOL_ICON, TOOL_ICONS } from "./tool-icons";
import type { ToolGroup } from "./tools-section";
import { SECTION_IDS, START_HREF, tList, type LandingT } from "./types";

type UseCase = {
  role: string;
  situation: string;
  body: string;
  tools: string[];
};

/** Real work situations mapped to the tool, or chain of tools, that solves
 *  them — so visitors recognise their own day rather than a feature list. */
export function UseCasesSection({ t }: { t: LandingT }) {
  const items = tList<UseCase>(t, "useCases.items");
  const toolNames = new Map(
    tList<ToolGroup>(t, "tools.groups").flatMap((group) =>
      group.items.map((tool) => [tool.icon, tool.name] as const),
    ),
  );

  return (
    <section
      id={SECTION_IDS.useCases}
      aria-labelledby="use-cases-title"
      className="scroll-mt-20 border-y bg-muted/30"
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <SectionHeading
          id="use-cases-title"
          eyebrow={t("useCases.eyebrow")}
          title={t("useCases.title")}
          description={t("useCases.description")}
        />

        <ul className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <li
              key={item.situation}
              className="flex flex-col rounded-xl border bg-card p-6"
            >
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {item.role}
              </p>
              <h3 className="mt-2 text-base font-semibold text-balance">
                {item.situation}
              </h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                {item.body}
              </p>

              <ol
                aria-label={t("useCases.stepsLabel")}
                className="mt-5 flex flex-wrap items-center gap-1.5 border-t pt-4"
              >
                {item.tools.map((tool, index) => {
                  const Icon = TOOL_ICONS[tool] ?? FALLBACK_TOOL_ICON;
                  return (
                    <li key={tool} className="flex items-center gap-1.5">
                      {index > 0 && (
                        <ChevronRight
                          className="size-3.5 text-muted-foreground"
                          aria-hidden
                        />
                      )}
                      <Link
                        href={TOOL_HREFS[tool] ?? START_HREF}
                        className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand-foreground transition-colors hover:bg-brand hover:text-primary-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                      >
                        <Icon className="size-3.5" aria-hidden />
                        {toolNames.get(tool) ?? tool}
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
