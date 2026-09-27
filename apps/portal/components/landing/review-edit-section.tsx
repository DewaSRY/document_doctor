import {
  Bold,
  Check,
  Download,
  Heading2,
  Italic,
  Link2,
  List,
  PencilLine,
  Redo2,
  Table,
  Underline,
  Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionHeading } from "./section-heading";
import { tList, type LandingT } from "./types";

type Step = { label: string; state: "done" | "active" | "pending" };

const TOOLBAR = [
  [Bold, Italic, Underline],
  [Heading2, List, Link2, Table],
  [Undo2, Redo2],
];

/** Mirrors the PRD's processing screen (§10) and the Tiptap review editor
 *  (§12): the user sees progress, then gets to fix the result before download. */
export function ReviewEditSection({ t }: { t: LandingT }) {
  const points = tList<{ title: string; body: string }>(t, "review.points");
  const steps = tList<Step>(t, "review.progress.steps");
  const paragraphs = tList<string>(t, "review.editor.paragraphs");

  return (
    <section
      aria-labelledby="review-title"
      className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-28"
    >
      <div className="grid items-center gap-14 lg:grid-cols-[1fr_1.15fr]">
        <div>
          <SectionHeading
            id="review-title"
            align="left"
            eyebrow={t("review.eyebrow")}
            title={t("review.title")}
            description={t("review.description")}
          />
          <ul className="mt-8 flex flex-col gap-5">
            {points.map((point) => (
              <li key={point.title} className="flex gap-3">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
                  <Check className="size-3" aria-hidden />
                </span>
                <div>
                  <h3 className="text-sm font-semibold">{point.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {point.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <figure
          role="img"
          aria-label={t("review.label")}
          className="relative pb-36"
        >
          <div aria-hidden className="overflow-hidden rounded-xl border bg-card shadow-xl shadow-black/5">
            <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
              <p className="truncate text-sm font-medium">
                {t("review.editor.fileName")}
              </p>
              <div className="flex shrink-0 gap-2">
                <span className="inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium">
                  <Download className="size-3.5" />
                  {t("review.editor.downloadDocx")}
                </span>
                <span className="inline-flex h-7 items-center gap-1.5 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground">
                  <Download className="size-3.5" />
                  {t("review.editor.downloadPdf")}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1 border-b bg-muted/40 px-3 py-1.5">
              {TOOLBAR.map((group, i) => (
                <div
                  key={i}
                  className="flex items-center gap-0.5 not-last:mr-1 not-last:border-r not-last:pr-1.5"
                >
                  {group.map((Icon, j) => (
                    <span
                      key={j}
                      className={cn(
                        "grid size-7 place-items-center rounded text-muted-foreground",
                        i === 0 && j === 0 && "bg-background text-foreground shadow-xs",
                      )}
                    >
                      <Icon className="size-3.5" />
                    </span>
                  ))}
                </div>
              ))}
            </div>

            <div className="px-6 py-6 text-left sm:px-8">
              <p className="text-lg font-semibold tracking-tight">
                {t("review.editor.title")}
              </p>
              {paragraphs.map((paragraph, index) => (
                <p
                  key={paragraph}
                  className="mt-3 text-[13px] leading-relaxed text-muted-foreground"
                >
                  {index === 0 ? (
                    <>
                      {paragraph}{" "}
                      <mark className="rounded-sm bg-brand-soft px-0.5 font-semibold text-foreground">
                        {t("review.editor.edited")}
                      </mark>
                      <span className="ml-px inline-block h-4 w-px translate-y-0.5 animate-pulse bg-brand motion-reduce:animate-none" />
                    </>
                  ) : (
                    paragraph
                  )}
                </p>
              ))}
              <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <PencilLine className="size-3.5 text-brand" />
                {t("review.editor.hint")}
              </p>
            </div>
          </div>

          {/* Processing card, floating over the editor's corner. */}
          <div aria-hidden className="absolute right-4 bottom-0 w-64 rounded-xl border bg-card p-4 text-left shadow-lg shadow-black/10 sm:-right-6">
            <p className="text-sm font-semibold">{t("review.progress.title")}</p>
            <ol className="mt-3 flex flex-col gap-2">
              {steps.map((step) => (
                <li
                  key={step.label}
                  className={cn(
                    "flex items-center gap-2 text-xs",
                    step.state === "pending" && "text-muted-foreground",
                    step.state === "active" && "font-medium",
                  )}
                >
                  {step.state === "done" && (
                    <Check className="size-3.5 text-success" />
                  )}
                  {step.state === "active" && (
                    <span className="grid size-3.5 place-items-center">
                      <span className="size-2 animate-pulse rounded-full bg-brand motion-reduce:animate-none" />
                    </span>
                  )}
                  {step.state === "pending" && (
                    <span className="grid size-3.5 place-items-center">
                      <span className="size-2 rounded-full border border-muted-foreground/50" />
                    </span>
                  )}
                  {step.label}
                </li>
              ))}
            </ol>
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full w-[65%] rounded-full bg-brand" />
              </div>
              <span className="tabular-nums">65%</span>
            </div>
          </div>
        </figure>
      </div>
    </section>
  );
}
