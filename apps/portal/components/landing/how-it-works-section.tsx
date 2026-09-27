import { Download, LayoutGrid, Upload } from "lucide-react";
import { SectionHeading } from "./section-heading";
import { SECTION_IDS, tList, type LandingT } from "./types";

const STEP_ICONS = [LayoutGrid, Upload, Download];

export function HowItWorksSection({ t }: { t: LandingT }) {
  const steps = tList<{ title: string; body: string }>(t, "howItWorks.steps");

  return (
    <section
      id={SECTION_IDS.howItWorks}
      aria-labelledby="how-it-works-title"
      className="scroll-mt-20"
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <SectionHeading
          id="how-it-works-title"
          eyebrow={t("howItWorks.eyebrow")}
          title={t("howItWorks.title")}
          description={t("howItWorks.description")}
        />

        <ol className="relative mt-14 grid gap-10 sm:grid-cols-3 sm:gap-6">
          {/* Connector line between the step markers on wide screens. */}
          <div
            aria-hidden
            className="absolute top-6 right-[16%] left-[16%] hidden h-px bg-linear-to-r from-brand/0 via-brand/40 to-brand/0 sm:block"
          />
          {steps.map((step, index) => {
            const Icon = STEP_ICONS[index] ?? Upload;
            return (
              <li
                key={step.title}
                className="relative flex flex-col items-center text-center"
              >
                <span className="relative grid size-12 place-items-center rounded-full border-4 border-background bg-brand text-primary-foreground shadow-sm">
                  <Icon className="size-5" aria-hidden />
                </span>
                <p className="mt-5 text-xs font-semibold tracking-wide text-brand uppercase">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-1 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
                  {step.body}
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
