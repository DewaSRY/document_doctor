import {
  ArrowRight,
  Download,
  FileText,
  LoaderCircle,
  PencilLine,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { LandingT } from "./types";

type SampleDoc = {
  title: string;
  paragraphs: string[];
  tableHead: string[];
  tableRows: string[][];
};

function Paper({
  doc,
  label,
  highlighted,
}: {
  doc: SampleDoc;
  label: string;
  highlighted?: boolean;
}) {
  return (
    <div className="relative flex flex-col gap-3 bg-muted/40 p-4 sm:p-6">
      <span
        className={cn(
          "inline-flex w-fit items-center gap-1.5 rounded-full border bg-background px-2.5 py-0.5 text-xs font-medium",
          highlighted
            ? "border-brand/30 text-brand-foreground"
            : "text-muted-foreground",
        )}
      >
        <span
          className={cn(
            "size-1.5 rounded-full",
            highlighted ? "bg-brand" : "bg-muted-foreground/50",
          )}
        />
        {label}
      </span>

      <div className="relative overflow-hidden rounded-md border bg-card p-5 text-left shadow-sm sm:p-7">
        {highlighted && (
          <div
            className="animate-scan pointer-events-none absolute inset-x-0 top-0 h-12 bg-linear-to-b from-transparent via-brand/10 to-transparent [--scan-distance:14rem]"
          >
            <div className="absolute inset-x-0 bottom-1/2 h-px bg-brand/40" />
          </div>
        )}
        <p className="text-lg font-semibold tracking-tight">{doc.title}</p>
        <div className="mt-2 h-0.5 w-10 rounded-full bg-brand/70" />
        {doc.paragraphs.map((paragraph) => (
          <p
            key={paragraph}
            className="mt-3 text-[13px] leading-relaxed text-muted-foreground"
          >
            {paragraph}
          </p>
        ))}
        <table className="mt-4 w-full text-[12px]">
          <thead>
            <tr className="border-b">
              {doc.tableHead.map((cell) => (
                <th key={cell} className="py-1.5 text-left font-semibold">
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {doc.tableRows.map((row) => (
              <tr key={row.join()} className="border-b last:border-0">
                {row.map((cell, i) => (
                  <td
                    key={cell}
                    className={cn(
                      "py-1.5 text-muted-foreground",
                      i > 0 && "tabular-nums",
                    )}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function WorkspacePreview({ t }: { t: LandingT }) {
  const source = t("preview.source", { returnObjects: true }) as unknown as SampleDoc;
  const target = t("preview.target", { returnObjects: true }) as unknown as SampleDoc;

  return (
    <figure
      role="img"
      aria-label={t("preview.label")}
      className="relative mt-16 w-full max-w-5xl sm:mt-20"
    >
      <div
        aria-hidden
        className="absolute inset-x-10 -bottom-6 top-10 -z-10 rounded-[2rem] bg-brand/10 blur-2xl"
      />
      <div aria-hidden className="overflow-hidden rounded-xl border bg-card shadow-2xl shadow-black/5">
        {/* Window toolbar */}
        <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
          <div className="hidden gap-1.5 sm:flex">
            <span className="size-2.5 rounded-full bg-muted-foreground/20" />
            <span className="size-2.5 rounded-full bg-muted-foreground/20" />
            <span className="size-2.5 rounded-full bg-muted-foreground/20" />
          </div>
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-md bg-brand-soft">
              <FileText className="size-4 text-brand" />
            </span>
            <div className="min-w-0 text-left">
              <p className="truncate text-sm font-medium">{t("preview.fileName")}</p>
              <p className="text-xs text-muted-foreground">{t("preview.fileMeta")}</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs sm:inline-flex">
              <span className="text-muted-foreground">{t("preview.from")}</span>
              <span className="font-medium">{t("preview.sourceLanguage")}</span>
              <ArrowRight className="size-3 text-brand" />
              <span className="text-muted-foreground">{t("preview.to")}</span>
              <span className="font-medium">{t("preview.targetLanguage")}</span>
            </span>
            <span className="inline-flex h-7 items-center gap-1.5 rounded-md border bg-background px-3 text-xs font-medium">
              <PencilLine className="size-3.5" />
              {t("preview.edit")}
            </span>
            <span className="inline-flex h-7 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground">
              <Download className="size-3.5" />
              {t("preview.download")}
            </span>
          </div>
        </div>

        {/* Side-by-side pages */}
        <div className="grid gap-px bg-border md:grid-cols-2">
          <div className="hidden md:block">
            <Paper doc={source} label={t("preview.original")} />
          </div>
          <Paper doc={target} label={t("preview.translated")} highlighted />
        </div>

        {/* Status bar */}
        <div className="flex items-center gap-3 border-t px-4 py-3 text-xs text-muted-foreground">
          <LoaderCircle className="size-3.5 animate-spin text-brand motion-reduce:animate-none" />
          <span>{t("preview.status")}</span>
          <div className="ml-auto h-1.5 w-28 overflow-hidden rounded-full bg-muted sm:w-48">
            <div className="animate-fill h-full rounded-full bg-brand" />
          </div>
        </div>
      </div>
    </figure>
  );
}
