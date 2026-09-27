import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { START_HREF, TOOLS_HREF, type LandingT } from "./types";

export function FinalCtaSection({ t }: { t: LandingT }) {
  return (
    <section
      aria-labelledby="final-cta-title"
      className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6 sm:pb-28"
    >
      <div className="relative isolate overflow-hidden rounded-2xl bg-foreground px-6 py-14 text-center text-background sm:px-12 sm:py-20">
        <div
          aria-hidden
          className="absolute -top-24 left-1/2 -z-10 h-64 w-2/3 -translate-x-1/2 rounded-full bg-brand/40 blur-3xl"
        />
        <h2
          id="final-cta-title"
          className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl"
        >
          {t("finalCta.title")}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base text-pretty opacity-75 sm:text-lg">
          {t("finalCta.description")}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a
            href={TOOLS_HREF}
            className={cn(
              buttonVariants({ size: "lg" }),
              "group h-11 rounded-lg px-6 text-base",
            )}
          >
            {t("finalCta.cta")}
            <ArrowRight
              className="transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </a>
          <Link
            href={START_HREF}
            className={cn(
              buttonVariants({ size: "lg", variant: "outline" }),
              "h-11 rounded-lg border-background/25 bg-transparent px-6 text-base text-background hover:bg-background/10 hover:text-background",
            )}
          >
            {t("finalCta.ctaSecondary")}
          </Link>
        </div>
      </div>
    </section>
  );
}
