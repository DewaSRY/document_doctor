"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Check, Copy, Download, FileSearch, RotateCcw } from "lucide-react";

import {
  ErrorAlert,
  FieldError,
  FileDropzone,
  Processing,
  saveBlob,
  SubmitButton,
  ToolIntro,
  useFileValidator,
} from "@/components/file-tools";
import { FileChip } from "@/components/file-chip";
import { useLeaveGuard } from "@/components/leave-guard";
import { Button } from "@/components/ui/button";
import { zodResolverTranslate } from "@/lib/form";

import { DOCUMENT_ACCEPT, DOCUMENT_AI_MAX_SIZE, EXTRACTION_FIELDS } from "../constants";
import { useExtractDocument } from "../hooks/query";
import {
  aiDocumentFileSchema,
  extractorSchema,
  type ExtractorOutput,
  type ExtractorValues,
} from "../schema";
import type { DocumentExtraction } from "../type";
import { fileStem } from "../utils";

const MAX_SIZE_MB = DOCUMENT_AI_MAX_SIZE / 1024 / 1024;

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

export function Extractor() {
  const { t } = useTranslation("tools");
  const extract = useExtractDocument();
  const validate = useFileValidator(aiDocumentFileSchema);
  const form = useForm<ExtractorValues, unknown, ExtractorOutput>({
    resolver: zodResolverTranslate(extractorSchema, t),
    defaultValues: { file: null },
  });
  useLeaveGuard(form.formState.isDirty && !extract.isSuccess);
  const file = useWatch({ control: form.control, name: "file" });
  const fileError = form.formState.errors.file?.message;

  function selectFile([selected]: File[]) {
    if (!selected) return;
    const error = validate(selected);
    if (error) return form.setError("file", { message: error });
    form.clearErrors("file");
    form.setValue("file", selected, { shouldDirty: true });
  }

  function startOver() {
    extract.reset();
    form.reset();
  }

  function submit({ file }: ExtractorOutput) {
    extract.mutate(file);
  }

  return (
    <div className="flex flex-col gap-8">
      <ToolIntro
        icon={FileSearch}
        category={t("categories.documentAi")}
        title={t("extractor.title")}
        description={t("extractor.description")}
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

      {file && !extract.isPending && !extract.isSuccess && (
        <form noValidate onSubmit={form.handleSubmit(submit)} className="flex flex-col gap-6">
          <FileChip file={file} preview>
            <Button variant="ghost" size="sm" onClick={startOver}>
              {t("common.changeFile")}
            </Button>
          </FileChip>

          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm font-medium">{t("extractor.looksFor")}</p>
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {EXTRACTION_FIELDS.map((field) => (
                <li
                  key={field}
                  className="rounded-md border bg-background px-2 py-0.5 text-xs text-muted-foreground"
                >
                  {t(`extractor.fields.${field}`)}
                </li>
              ))}
            </ul>
          </div>

          {extract.isError && <ErrorAlert title={t("extractor.errorTitle")} error={extract.error} />}

          <SubmitButton retry={extract.isError}>{t("extractor.submit")}</SubmitButton>
        </form>
      )}

      {file && extract.isPending && (
        <Processing
          title={t("extractor.processing", { fileName: file.name })}
          description={t("common.processingSlow")}
        />
      )}

      {file && extract.data && <ExtractionResult extraction={extract.data} onReset={startOver} />}
    </div>
  );
}

function ExtractionResult({
  extraction,
  onReset,
}: {
  extraction: DocumentExtraction;
  onReset: () => void;
}) {
  const { t } = useTranslation("tools");
  const [copied, setCopied] = useState(false);

  const found = EXTRACTION_FIELDS.filter((field) => extraction.fields[field]?.length);
  const missing = EXTRACTION_FIELDS.filter((field) => !extraction.fields[field]?.length);
  const stem = fileStem(extraction.file_name);

  function asJson() {
    return JSON.stringify(extraction.fields, null, 2);
  }

  function asCsv() {
    const rows = found.flatMap((field) =>
      extraction.fields[field].map((value) => `${csvCell(t(`extractor.fields.${field}`))},${csvCell(value)}`),
    );
    return [`${csvCell(t("extractor.csvField"))},${csvCell(t("extractor.csvValue"))}`, ...rows].join("\n");
  }

  async function copy() {
    await navigator.clipboard.writeText(
      found
        .map((field) => `${t(`extractor.fields.${field}`)}:\n${extraction.fields[field].map((v) => `• ${v}`).join("\n")}`)
        .join("\n\n"),
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section aria-labelledby="extraction-title" className="flex flex-col gap-6">
      <div>
        <p className="truncate text-sm text-muted-foreground">
          {extraction.file_name}
        </p>
        <h2 id="extraction-title" className="mt-1 text-xl font-semibold tracking-tight">
          {found.length ? t("extractor.resultTitle") : t("extractor.nothingFound")}
        </h2>
      </div>

      {found.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {found.map((field) => (
            <div key={field} className="rounded-xl border bg-card p-4">
              <h3 className="flex items-center justify-between text-sm font-semibold">
                {t(`extractor.fields.${field}`)}
                <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand-foreground">
                  {extraction.fields[field].length}
                </span>
              </h3>
              <ul className="mt-3 flex flex-col gap-1.5 text-sm">
                {extraction.fields[field].map((value) => (
                  <li key={value} className="break-words">
                    {value}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {missing.length > 0 && found.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {t("extractor.notFound", {
            fields: missing.map((field) => t(`extractor.fields.${field}`)).join(", "),
          })}
        </p>
      )}

      {extraction.truncated && (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
          {t("common.truncated")}
        </p>
      )}

      <p className="text-xs text-muted-foreground">{t("extractor.reviewHint")}</p>

      <div className="flex flex-wrap gap-2">
        {found.length > 0 && (
          <>
            <Button variant="outline" className="h-9 rounded-lg px-4" onClick={copy}>
              {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
              {copied ? t("common.copied") : t("common.copy")}
            </Button>
            <Button
              variant="outline"
              className="h-9 rounded-lg px-4"
              onClick={() =>
                saveBlob(new Blob(["﻿", asCsv()], { type: "text/csv;charset=utf-8" }), `${stem}_extracted.csv`)
              }
            >
              <Download aria-hidden />
              CSV
            </Button>
            <Button
              variant="outline"
              className="h-9 rounded-lg px-4"
              onClick={() =>
                saveBlob(new Blob([asJson()], { type: "application/json" }), `${stem}_extracted.json`)
              }
            >
              <Download aria-hidden />
              JSON
            </Button>
          </>
        )}
        <Button variant="ghost" className="h-9 rounded-lg px-4 sm:ml-auto" onClick={onReset}>
          <RotateCcw aria-hidden />
          {t("extractor.another")}
        </Button>
      </div>
    </section>
  );
}
