import { ArrowRight, Check } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { START_HREF, TOOLS_HREF, tList, type LandingT } from "./types";

/** iLovePDF-style hero: one promise, one line of support, two ways in, then
 *  straight into the tools — no marketing between the visitor and their task. */
export function HeroSection({ t }: { t: LandingT }) {
  const trust = tList<string>(t, "hero.trust");

  return (
    <section aria-labelledby="hero-title">
      <div className="mx-auto flex w-full max-w-4xl flex-col items-center px-4 pt-12 pb-4 text-center sm:px-6 sm:pt-20">
        <h1
          id="hero-title"
          className="text-[1.75rem] leading-tight font-bold tracking-tight text-balance sm:text-4xl lg:text-[2.75rem] lg:leading-[1.15]"
        >
          {t("hero.title")}
          <span className="text-brand">{t("hero.titleAccent")}</span>
        </h1>
        <p className="mt-4 max-w-2xl text-base text-pretty text-muted-foreground sm:text-lg">
          {t("hero.description")}
        </p>

        <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Link
            href={START_HREF}
            className={cn(
              buttonVariants({ size: "lg" }),
              "group h-11 rounded-lg px-6 text-base",
            )}
          >
            {t("hero.primaryCta")}
            <ArrowRight
              className="transition-transform group-hover:translate-x-0.5 motion-reduce:group-hover:translate-x-0"
              aria-hidden
            />
          </Link>
          <a
            href={TOOLS_HREF}
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "h-11 rounded-lg bg-card px-6 text-base",
            )}
          >
            {t("hero.secondaryCta")}
          </a>
        </div>

        <ul
          aria-label={t("hero.trustLabel")}
          className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground"
        >
          {trust.map((item) => (
            <li key={item} className="inline-flex items-center gap-1.5">
              <Check className="size-4 text-success" aria-hidden />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
