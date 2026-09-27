import { ArrowUpRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { TOOL_HREFS } from "@/feature/tools/constants";
import { SectionHeading } from "./section-heading";
import { FALLBACK_TOOL_ICON, TOOL_ICONS } from "./tool-icons";
import { SECTION_IDS, START_HREF, tList, type LandingT } from "./types";

export type Tool = {
  icon: string;
  name: string;
  description: string;
  formats: string[];
  limit: string;
};

export type ToolGroup = {
  id: string;
  title: string;
  description: string;
  items: Tool[];
};

/** The whole toolkit, grouped by the kind of job each tool does. Every card
 *  is one link, so the full card is the click target. */
export function ToolsSection({ t }: { t: LandingT }) {
  const groups = tList<ToolGroup>(t, "tools.groups");

  return (
    <section
      id={SECTION_IDS.tools}
      aria-labelledby="tools-title"
      className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6 sm:py-24"
    >
      <SectionHeading
        id="tools-title"
        eyebrow={t("tools.eyebrow")}
        title={t("tools.title")}
        description={t("tools.description")}
      />

      <div className="mt-14 flex flex-col gap-12">
        {groups.map((group) => (
          <div
            key={group.id}
            className="grid gap-5 lg:grid-cols-[14rem_1fr] lg:gap-8"
          >
            <div className="lg:pt-5">
              <h3
                id={`tools-${group.id}`}
                className="text-sm font-semibold tracking-wide text-brand uppercase"
              >
                {group.title}
              </h3>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {group.description}
              </p>
            </div>

            <ul
              aria-labelledby={`tools-${group.id}`}
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              {group.items.map((tool) => {
                const Icon = TOOL_ICONS[tool.icon] ?? FALLBACK_TOOL_ICON;
                return (
                  <li key={tool.icon} className="flex">
                    <Link
                      href={TOOL_HREFS[tool.icon] ?? START_HREF}
                      className="group flex w-full flex-col rounded-xl border bg-card p-5 transition duration-200 hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none motion-reduce:hover:translate-y-0"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="grid size-10 place-items-center rounded-lg bg-brand-soft text-brand transition-colors group-hover:bg-brand group-hover:text-primary-foreground">
                          <Icon className="size-5" aria-hidden />
                        </span>
                        <ArrowUpRight
                          className="size-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-brand"
                          aria-hidden
                        />
                      </div>

                      <p className="mt-5 text-base font-semibold">
                        {tool.name}
                      </p>
                      <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                        {tool.description}
                      </p>

                      <div className="mt-4 flex flex-wrap items-center gap-1.5">
                        <ul
                          aria-label={t("tools.formatsLabel")}
                          className="flex flex-wrap gap-1.5"
                        >
                          {tool.formats.map((format) => (
                            <li
                              key={format}
                              className="rounded-md border bg-background px-2 py-0.5 font-mono text-[11px] font-medium text-muted-foreground"
                            >
                              {format}
                            </li>
                          ))}
                        </ul>
                        <span className="text-[11px] text-muted-foreground">
                          · {tool.limit}
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
