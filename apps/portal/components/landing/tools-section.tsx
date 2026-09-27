import {
  ArrowRight,
  Combine,
  FileSearch,
  FileText,
  Image as ImageIcon,
  Languages,
  Minimize2,
  Repeat2,
  type LucideIcon,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SectionHeading } from "./section-heading";
import {
  DOCS_HREF,
  SECTION_IDS,
  START_HREF,
  tList,
  type LandingT,
} from "./types";

const ICONS: Record<string, LucideIcon> = {
  translator: Languages,
  summarizer: FileText,
  extractor: FileSearch,
  converter: Repeat2,
  pdf: Combine,
  resizer: ImageIcon,
  compressor: Minimize2,
};

type Tool = {
  icon: string;
  name: string;
  description: string;
  category: string;
  formats: string[];
  available: boolean;
};

/** The tool directory from the PRD's dashboard (§6): every tool is its own
 *  card, and only the ones that ship get working buttons. */
export function ToolsSection({ t }: { t: LandingT }) {
  const tools = tList<Tool>(t, "tools.items");

  return (
    <section
      id={SECTION_IDS.tools}
      aria-labelledby="tools-title"
      className="mx-auto w-full max-w-7xl mb-4  "
    >
      <ul className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tools.map((tool) => {
          const Icon = ICONS[tool.icon] ?? FileText;
          return (
            <li
              key={tool.name}
              className={cn(
                "flex flex-col rounded-xl border bg-card p-5",
                tool.available
                  ? "border-brand/40 shadow-md shadow-brand/5 ring-1 ring-brand/10 sm:col-span-2 lg:col-span-2"
                  : "bg-card/60",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <span
                  className={cn(
                    "grid size-10 place-items-center rounded-lg",
                    tool.available
                      ? "bg-brand text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                </span>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs font-medium",
                    tool.available
                      ? "bg-brand-soft text-brand-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {tool.available
                    ? t("tools.available")
                    : t("tools.comingSoon")}
                </span>
              </div>

              <p className="mt-5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {tool.category}
              </p>
              <h3 className="mt-1 text-base font-semibold">{tool.name}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                {tool.description}
              </p>

              <ul
                aria-label={t("tools.formatsLabel")}
                className="mt-4 flex flex-wrap gap-1.5"
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

              {tool.available && (
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link
                    href={START_HREF}
                    className={cn(
                      buttonVariants(),
                      "group h-9 rounded-lg px-4",
                    )}
                  >
                    {t("tools.useTool")}
                    <ArrowRight
                      className="transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </Link>
                  <a
                    href={DOCS_HREF}
                    className={cn(
                      buttonVariants({ variant: "outline" }),
                      "h-9 rounded-lg px-4",
                    )}
                  >
                    {t("tools.documentation")}
                  </a>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
