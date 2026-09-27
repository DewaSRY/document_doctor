import { ArrowRight, Check } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TOOL_HREFS } from "@/feature/tools/constants";
import { FALLBACK_TOOL_ICON, TOOL_ICONS } from "./tool-icons";
import { START_HREF, TOOLS_HREF, tList, type LandingT } from "./types";

type Task = { icon: string; label: string };

/** Task-first hero: people arrive with a job to do, so the tools are one
 *  click away instead of below a product pitch. */
export function HeroSection({ t }: { t: LandingT }) {
  const trust = tList<string>(t, "hero.trust");
  const tasks = tList<Task>(t, "hero.tasks");

  return (
    <section aria-labelledby="hero-title" className="relative">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center px-4 pt-16 pb-8 text-center sm:px-6 sm:pt-24">
        <p className="inline-flex items-center gap-2 rounded-full border bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground">
          <span className="size-1.5 rounded-full bg-brand" aria-hidden />
          {t("hero.eyebrow")}
        </p>

        <h1
          id="hero-title"
          className="mt-6 max-w-4xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl"
        >
          {t("hero.title")}
          <span className="text-brand">{t("hero.titleAccent")}</span>
        </h1>

        <p className="mt-6 max-w-2xl text-base text-pretty text-muted-foreground sm:text-lg">
          {t("hero.description")}
        </p>

        <div className="mt-10 w-full max-w-4xl">
          <p
            id="hero-tasks"
            className="text-sm font-medium text-foreground"
          >
            {t("hero.tasksLabel")}
          </p>
          <ul
            aria-labelledby="hero-tasks"
            className="mt-4 flex flex-wrap justify-center gap-2"
          >
            {tasks.map((task) => {
              const Icon = TOOL_ICONS[task.icon] ?? FALLBACK_TOOL_ICON;
              return (
                <li key={task.icon}>
                  <Link
                    href={TOOL_HREFS[task.icon] ?? START_HREF}
                    className="group inline-flex h-10 items-center gap-2 rounded-full border bg-card px-4 text-sm font-medium shadow-xs transition hover:border-brand/40 hover:bg-brand-soft focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <Icon className="size-4 text-brand" aria-hidden />
                    {task.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        <a
          href={TOOLS_HREF}
          className={cn(
            buttonVariants({ size: "lg" }),
            "group mt-8 h-11 rounded-lg px-6 text-base",
          )}
        >
          {t("nav.cta")}
          <ArrowRight
            className="transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        </a>

        <ul className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          {trust.map((item) => (
            <li key={item} className="inline-flex items-center gap-1.5">
              <Check className="size-4 text-brand" aria-hidden />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
