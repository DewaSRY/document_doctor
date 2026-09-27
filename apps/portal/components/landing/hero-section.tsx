import { ArrowRight, Check, Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { WorkspacePreview } from "./workspace-preview";
import { SECTION_IDS, START_HREF, tList, type LandingT } from "./types";

export function HeroSection({ t }: { t: LandingT }) {
  const trust = tList<string>(t, "hero.trust");

  return (
    <section
      aria-labelledby="hero-title"
      className="relative isolate overflow-hidden"
    >
      {/* Faint grid + a soft red wash at the top — texture, not decoration. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] mask-[radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)] bg-size-[48px_48px] opacity-60"
      />
      <div
        aria-hidden
        className="absolute inset-x-0 -top-40 -z-10 mx-auto h-96 max-w-3xl rounded-full bg-brand/15 blur-3xl"
      />

      <div className="mx-auto flex w-full max-w-6xl flex-col items-center px-4 pt-16 pb-20 sm:px-6 sm:pt-24 lg:pb-28">
        <p className="inline-flex items-center gap-2 rounded-full border bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground shadow-xs">
          <Sparkles className="size-3.5 text-brand" aria-hidden />
          {t("hero.eyebrow")}
        </p>

        <h1
          id="hero-title"
          className="mt-6 max-w-4xl text-center text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl"
        >
          {t("hero.title")}{" "}
          <span className="text-brand">{t("hero.titleAccent")}</span>
        </h1>

        <p className="mt-6 max-w-2xl text-center text-base text-pretty text-muted-foreground sm:text-lg">
          {t("hero.description")}
        </p>

        <div className="mt-9 flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center">
          <a
            href={START_HREF}
            className={cn(
              buttonVariants({ size: "lg" }),
              "group h-11 rounded-lg px-6 text-base",
            )}
          >
            {t("hero.ctaPrimary")}
            <ArrowRight
              className="transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </a>
          <a
            href={`#${SECTION_IDS.tools}`}
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "h-11 rounded-lg px-6 text-base",
            )}
          >
            {t("hero.ctaSecondary")}
          </a>
        </div>

        <ul className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          {trust.map((item) => (
            <li key={item} className="inline-flex items-center gap-1.5">
              <Check className="size-4 text-brand" aria-hidden />
              {item}
            </li>
          ))}
        </ul>

        <WorkspacePreview t={t} />
      </div>
    </section>
  );
}
