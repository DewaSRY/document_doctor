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
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center px-4 py-4 ">
        <h1
          id="hero-title"
          className="mt-6 max-w-7xl text-center text-xl font-semibold tracking-tight text-balance sm:text-2xl lg:text-3xl"
        >
          {t("hero.title")}
          <span className="text-brand">{t("hero.titleAccent")}</span>
        </h1>

        <p className="mt-3 max-w-7xl text-center text-base text-pretty text-muted-foreground ">
          {t("hero.description")}
        </p>

        <ul className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          {trust.map((item) => (
            <li key={item} className="inline-flex items-center gap-1.5">
              <Check className="size-4 text-brand" aria-hidden />
              {item}
            </li>
          ))}
        </ul>

        {/* <WorkspacePreview t={t} /> */}
      </div>
    </section>
  );
}
