"use client";

import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Check, Copy, Download, FileText, RotateCcw } from "lucide-react";

import {
  ErrorAlert,
  FieldError,
  FileDropzone,
  Processing,
  saveBlob,
  Segmented,
  SelectField,
  SubmitButton,
  ToolIntro,
  useFileValidator,
} from "@/components/file-tools";
import { FileChip } from "@/components/file-chip";
import { Button } from "@/components/ui/button";
import { LANGUAGE_CODES } from "@/feature/translator/constants";
import { zodResolverTranslate } from "@/lib/form";

import { DOCUMENT_ACCEPT, DOCUMENT_AI_MAX_SIZE, SUMMARY_LENGTHS } from "../constants";
import { useSummarizeDocument } from "../hooks/query";
import {
  aiDocumentFileSchema,
  SAME_LANGUAGE,
  summarizerSchema,
  type SummarizerOutput,
  type SummarizerValues,
} from "../schema";
import type { DocumentSummary } from "../type";
import { fileStem } from "../utils";

const MAX_SIZE_MB = DOCUMENT_AI_MAX_SIZE / 1024 / 1024;

function summaryText(summary: DocumentSummary): string {
  return [
    summary.overview,
    "",
    ...summary.key_points.map((point) => `• ${point}`),
  ].join("\n");
}

export function Summarizer() {
  const { t } = useTranslation("tools");
  const summarize = useSummarizeDocument();
  const validate = useFileValidator(aiDocumentFileSchema);
  const form = useForm<SummarizerValues, unknown, SummarizerOutput>({
    resolver: zodResolverTranslate(summarizerSchema, t),
    defaultValues: { file: null, length: "medium", language: SAME_LANGUAGE },
  });
  const file = useWatch({ control: form.control, name: "file" });
  const fileError = form.formState.errors.file?.message;

  function selectFile([selected]: File[]) {
    if (!selected) return;
    const error = validate(selected);
    if (error) return form.setError("file", { message: error });
    form.clearErrors("file");
    form.setValue("file", selected);
  }

  function startOver() {
    summarize.reset();
    // Keep the chosen length and language for the next document.
    form.reset({ ...form.getValues(), file: null });
  }

  function submit(values: SummarizerOutput) {
    summarize.mutate(values);
  }

  return (
    <div className="flex flex-col gap-8">
      <ToolIntro
        icon={FileText}
        category={t("categories.documentAi")}
        title={t("summarizer.title")}
        description={t("summarizer.description")}
      />

      {!file && (
        <>
          <FileDropzone
            accept={DOCUMENT_ACCEPT}
            hint={t("common.documentHint", { size: MAX_SIZE_MB })}
            onFiles={selectFile}
          />
          <FieldError>{fileError}</FieldError>
        </>
      )}

      {file && !summarize.isPending && !summarize.isSuccess && (
        <form noValidate onSubmit={form.handleSubmit(submit)} className="flex flex-col gap-6">
          <FileChip file={file} preview>
            <Button variant="ghost" size="sm" onClick={startOver}>
              {t("common.changeFile")}
            </Button>
          </FileChip>

          <Controller
            control={form.control}
            name="length"
            render={({ field }) => (
              <Segmented
                label={t("summarizer.length")}
                value={field.value}
                onChange={field.onChange}
                options={SUMMARY_LENGTHS.map((value) => ({
                  value,
                  label: t(`summarizer.lengths.${value}`),
                  description: t(`summarizer.lengthDescriptions.${value}`),
                }))}
              />
            )}
          />

          <Controller
            control={form.control}
            name="language"
            render={({ field }) => (
              <SelectField
                label={t("summarizer.language")}
                value={field.value}
                onChange={field.onChange}
                options={[
                  { value: SAME_LANGUAGE, label: t("summarizer.sameLanguage") },
                  ...LANGUAGE_CODES.map((code) => ({
                    value: code,
                    label: t(`languages.${code}`),
                  })),
                ]}
              />
            )}
          />

          {summarize.isError && (
            <ErrorAlert
              title={t("summarizer.errorTitle")}
              error={summarize.error}
            />
          )}

          <SubmitButton retry={summarize.isError}>{t("summarizer.submit")}</SubmitButton>
        </form>
      )}

      {file && summarize.isPending && (
        <Processing
          title={t("summarizer.processing", { fileName: file.name })}
          description={t("common.processingSlow")}
        />
      )}

      {file && summarize.data && (
        <SummaryResult summary={summarize.data} onReset={startOver} />
      )}
    </div>
  );
}

function SummaryResult({
  summary,
  onReset,
}: {
  summary: DocumentSummary;
  onReset: () => void;
}) {
  const { t } = useTranslation("tools");
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(summaryText(summary));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section aria-labelledby="summary-title" className="flex flex-col gap-6">
      <div className="rounded-xl border bg-card p-6">
        <p className="truncate text-sm text-muted-foreground">
          {summary.file_name}
        </p>
        <h2
          id="summary-title"
          className="mt-1 text-xl font-semibold tracking-tight"
        >
          {t("summarizer.overview")}
        </h2>
        <p className="mt-3 leading-relaxed">{summary.overview}</p>

        {summary.key_points.length > 0 && (
          <>
            <h3 className="mt-6 text-base font-semibold">
              {t("summarizer.keyPoints")}
            </h3>
            <ul className="mt-3 flex flex-col gap-2">
              {summary.key_points.map((point) => (
                <li key={point} className="flex gap-2.5 leading-relaxed">
                  <span
                    aria-hidden
                    className="mt-2.5 size-1.5 shrink-0 rounded-full bg-brand"
                  />
                  {point}
                </li>
              ))}
            </ul>
          </>
        )}

        {summary.truncated && (
          <p className="mt-6 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
            {t("common.truncated")}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          className="h-9 rounded-lg px-4"
          onClick={copy}
        >
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          {copied ? t("common.copied") : t("common.copy")}
        </Button>
        <Button
          variant="outline"
          className="h-9 rounded-lg px-4"
          onClick={() =>
            saveBlob(
              new Blob([summaryText(summary)], {
                type: "text/plain;charset=utf-8",
              }),
              `${fileStem(summary.file_name)}_summary.txt`,
            )
          }
        >
          <Download aria-hidden />
          {t("summarizer.downloadText")}
        </Button>
        <Button
          variant="ghost"
          className="h-9 rounded-lg px-4 sm:ml-auto"
          onClick={onReset}
        >
          <RotateCcw aria-hidden />
          {t("summarizer.another")}
        </Button>
      </div>
    </section>
  );
}
