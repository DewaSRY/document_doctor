import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { START_HREF, TOOLS_HREF, type LandingT } from "./types";

/** Last stop before the footer: the same two ways in as the hero. */
export function FinalCtaSection({ t }: { t: LandingT }) {
  return (
    <section
      aria-labelledby="final-cta-title"
      className="mx-auto w-full max-w-7xl px-4 pb-20 sm:px-6 sm:pb-28"
    >
      <div className="flex flex-col items-center gap-6 rounded-2xl border-t-4 border-brand bg-card px-6 py-12 text-center shadow-xs sm:px-10 lg:flex-row lg:justify-between lg:px-14 lg:text-left">
        <div className="max-w-xl">
          <h2
            id="final-cta-title"
            className="text-2xl font-bold tracking-tight text-balance sm:text-3xl"
          >
            {t("finalCta.title")}
          </h2>
          <p className="mt-2 text-base text-pretty text-muted-foreground">
            {t("finalCta.description")}
          </p>
        </div>
        <div className="flex w-full shrink-0 flex-col gap-3 sm:w-auto sm:flex-row">
          <Link
            href={START_HREF}
            className={cn(
              buttonVariants({ size: "lg" }),
              "group h-11 rounded-lg px-6 text-base",
            )}
          >
            {t("finalCta.primary")}
            <ArrowRight
              className="transition-transform group-hover:translate-x-0.5 motion-reduce:group-hover:translate-x-0"
              aria-hidden
            />
          </Link>
          <a
            href={TOOLS_HREF}
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "h-11 rounded-lg px-6 text-base",
            )}
          >
            {t("finalCta.secondary")}
          </a>
        </div>
      </div>
    </section>
  );
}
