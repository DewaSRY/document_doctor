import type { ReactNode } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Download,
  FileText,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionHeading } from "./section-heading";
import { SECTION_IDS, tList, type LandingT } from "./types";

type Step = { title: string; body: string };

/** Upload → options → result. Every tool follows this flow, so one small
 *  mock of each stage explains the whole toolkit. */
export function HowItWorksSection({ t }: { t: LandingT }) {
  const steps = tList<Step>(t, "howItWorks.steps");
  const lengths = tList<string>(t, "howItWorks.demo.lengths");
  const visuals: ReactNode[] = [
    <UploadVisual key="upload" t={t} />,
    <OptionsVisual key="options" t={t} lengths={lengths} />,
    <ResultVisual key="result" t={t} />,
  ];

  return (
    <section
      id={SECTION_IDS.howItWorks}
      aria-labelledby="how-it-works-title"
      className="scroll-mt-20"
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
        <SectionHeading
          id="how-it-works-title"
          eyebrow={t("howItWorks.eyebrow")}
          title={t("howItWorks.title")}
          description={t("howItWorks.description")}
        />

        <ol
          aria-label={t("howItWorks.label")}
          className="mt-14 grid gap-4 md:grid-cols-3 md:gap-6"
        >
          {steps.map((step, index) => (
            <li
              key={step.title}
              className="relative flex flex-col rounded-xl bg-card p-5 shadow-xs sm:p-6"
            >
              <div
                aria-hidden
                className="flex h-36 items-center justify-center rounded-lg bg-muted px-4"
              >
                {visuals[index]}
              </div>
              <div className="mt-5 flex gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-semibold text-brand-foreground tabular-nums">
                  {index + 1}
                </span>
                <div>
                  <h3 className="text-base font-semibold">{step.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-pretty text-muted-foreground">
                    {step.body}
                  </p>
                </div>
              </div>

              {/* Connector to the next step, only where the steps sit side by side. */}
              {index < steps.length - 1 && (
                <span
                  aria-hidden
                  className="absolute top-20 -right-7 z-10 hidden size-8 place-items-center rounded-full border bg-card text-muted-foreground shadow-xs md:grid"
                >
                  <ArrowRight className="size-4" />
                </span>
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function FileBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-md text-white",
        className,
      )}
    >
      <FileText className="size-4.5" />
    </span>
  );
}

function UploadVisual({ t }: { t: LandingT }) {
  return (
    <div className="flex w-full max-w-60 flex-col items-center gap-2.5 rounded-lg border-2 border-dashed border-foreground/15 bg-card/60 px-3 py-3">
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Upload className="size-3.5" />
        {t("howItWorks.demo.drop")}
      </span>
      <div className="flex w-full items-center gap-2.5 rounded-md border bg-card px-2.5 py-2 shadow-xs">
        <FileBadge className="bg-brand" />
        <div className="min-w-0 text-left">
          <p className="truncate text-xs font-medium">
            {t("howItWorks.demo.file")}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {t("howItWorks.demo.fileMeta")}
          </p>
        </div>
      </div>
    </div>
  );
}

function OptionsVisual({ t, lengths }: { t: LandingT; lengths: string[] }) {
  return (
    <div className="flex w-full max-w-60 flex-col gap-2.5">
      <div className="flex items-center gap-1.5 text-xs">
        {[t("howItWorks.demo.from"), t("howItWorks.demo.to")].map(
          (language, index) => (
            <span key={language} className="contents">
              {index > 0 && (
                <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
              )}
              <span className="flex h-8 min-w-0 flex-1 items-center justify-between gap-1 rounded-md border bg-card px-2 font-medium shadow-xs">
                <span className="truncate">{language}</span>
                <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
              </span>
            </span>
          ),
        )}
      </div>
      <div>
        <p className="text-left text-[11px] text-muted-foreground">
          {t("howItWorks.demo.length")}
        </p>
        <div className="mt-1 grid grid-cols-3 gap-0.5 rounded-md border bg-card p-0.5 text-[11px] font-medium">
          {lengths.map((length, index) => (
            <span
              key={length}
              className={cn(
                "truncate rounded px-1 py-1 text-center",
                index === 1
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground",
              )}
            >
              {length}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function ResultVisual({ t }: { t: LandingT }) {
  return (
    <div className="flex w-full max-w-60 flex-col gap-2.5 rounded-lg border bg-card p-3 shadow-xs">
      <div className="flex items-center gap-2.5">
        <FileBadge className="bg-success" />
        <div className="min-w-0 flex-1 text-left">
          <p className="truncate text-xs font-medium">
            {t("howItWorks.demo.result")}
          </p>
          <p className="inline-flex items-center gap-1 text-[11px] font-medium text-success">
            <Check className="size-3" />
            {t("howItWorks.demo.ready")}
          </p>
        </div>
      </div>
      <span className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-primary text-xs font-medium text-primary-foreground">
        <Download className="size-3.5" />
        {t("howItWorks.demo.download")}
      </span>
    </div>
  );
}
