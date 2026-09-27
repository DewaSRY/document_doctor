"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight, Repeat2 } from "lucide-react";

import {
  DocumentPreview,
  ErrorAlert,
  FieldError,
  FileChip,
  FileDropzone,
  FileResult,
  Processing,
  SubmitButton,
  ToolIntro,
  useFileValidator,
} from "@/components/file-tools";
import { Button } from "@/components/ui/button";

import {
  DOCUMENT_ACCEPT,
  DOCUMENT_EXTENSIONS,
  FILE_TOOL_MAX_SIZE,
  getFileExtension,
} from "../constants";
import { useFileTool } from "../hooks/query";
import { fileStem } from "../utils";

const MAX_SIZE_MB = FILE_TOOL_MAX_SIZE / 1024 / 1024;

export function Converter() {
  const { t } = useTranslation("tools");
  const convert = useFileTool("convert");
  const validate = useFileValidator({
    extensions: DOCUMENT_EXTENSIONS,
    maxSize: FILE_TOOL_MAX_SIZE,
    typeError: t("common.documentType"),
  });

  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const source = file && getFileExtension(file.name) === "pdf" ? "pdf" : "docx";
  const target = source === "pdf" ? "docx" : "pdf";

  function selectFile([selected]: File[]) {
    if (!selected) return;
    const error = validate(selected);
    setFileError(error);
    if (!error) setFile(selected);
  }

  function startOver() {
    convert.reset();
    setFile(null);
    setFileError(null);
  }

  function submit() {
    if (!file) return;
    const body = new FormData();
    body.append("file", file);
    convert.mutate({ body, fallbackName: `${fileStem(file.name)}.${target}` });
  }

  return (
    <div className="flex flex-col gap-8">
      <ToolIntro
        icon={Repeat2}
        category={t("categories.fileTools")}
        title={t("converter.title")}
        description={t("converter.description")}
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

      {file && !convert.isPending && !convert.isSuccess && (
        <section className="flex flex-col gap-6">
          <FileChip file={file}>
            <Button variant="ghost" size="sm" onClick={startOver}>
              {t("common.changeFile")}
            </Button>
          </FileChip>

          <DocumentPreview file={file} />

          <div className="flex items-center justify-center gap-4 rounded-xl border bg-card p-6">
            <FormatBadge label={t(`converter.formats.${source}`)} />
            <ArrowRight className="size-5 text-muted-foreground" aria-hidden />
            <FormatBadge label={t(`converter.formats.${target}`)} highlighted />
          </div>
          <p className="text-sm text-muted-foreground">{t(`converter.notes.${source}`)}</p>

          {convert.isError && <ErrorAlert title={t("converter.errorTitle")} error={convert.error} />}

          <SubmitButton retry={convert.isError} onClick={submit}>
            {t(`converter.submit.${target}`)}
          </SubmitButton>
        </section>
      )}

      {file && convert.isPending && (
        <Processing
          title={t("converter.processing", { fileName: file.name })}
          description={t("common.processing")}
        />
      )}

      {convert.data && (
        <FileResult
          blob={convert.data.blob}
          fileName={convert.data.fileName}
          title={t("converter.doneTitle")}
          description={t(`converter.doneDescription.${target}`)}
          onReset={startOver}
          resetLabel={t("converter.another")}
        />
      )}
    </div>
  );
}

function FormatBadge({ label, highlighted = false }: { label: string; highlighted?: boolean }) {
  return (
    <span
      className={
        highlighted
          ? "rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-primary-foreground"
          : "rounded-lg border bg-background px-4 py-2 text-sm font-semibold"
      }
    >
      {label}
    </span>
  );
}
