import type { LandingT } from "./types";

/** iLovePDF-style hero: one big promise, one line of support, then straight
 *  into the tools — no marketing between the visitor and their task. */
export function HeroSection({ t }: { t: LandingT }) {
  return (
    <section aria-labelledby="hero-title">
      <div className="mx-auto flex w-full max-w-4xl flex-col items-center px-4 pt-14 pb-2 text-center sm:px-6 sm:pt-20">
        <h1
          id="hero-title"
          className="text-3xl font-bold tracking-tight text-balance sm:text-4xl lg:text-[2.75rem] lg:leading-[1.15]"
        >
          {t("hero.title")}
          <span className="text-brand">{t("hero.titleAccent")}</span>
        </h1>
        <p className="mt-4 max-w-2xl text-base text-pretty text-muted-foreground sm:text-lg">
          {t("hero.description")}
        </p>
      </div>
    </section>
  );
}
