"use client";

import { useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { ArrowRight, Repeat2 } from "lucide-react";

import {
  ErrorAlert,
  FieldError,
  FileDropzone,
  FileResult,
  Processing,
  SubmitButton,
  ToolIntro,
  useFileValidator,
} from "@/components/file-tools";
import { FileChip } from "@/components/file-chip";
import { Button } from "@/components/ui/button";
import { zodResolverTranslate } from "@/lib/form";

import { DOCUMENT_ACCEPT, FILE_TOOL_MAX_SIZE, getFileExtension } from "../constants";
import { useFileTool } from "../hooks/query";
import {
  converterSchema,
  documentFileSchema,
  type ConverterOutput,
  type ConverterValues,
} from "../schema";
import { fileStem } from "../utils";

const MAX_SIZE_MB = FILE_TOOL_MAX_SIZE / 1024 / 1024;

export function Converter() {
  const { t } = useTranslation("tools");
  const convert = useFileTool("convert");
  const validate = useFileValidator(documentFileSchema);
  const form = useForm<ConverterValues, unknown, ConverterOutput>({
    resolver: zodResolverTranslate(converterSchema, t),
    defaultValues: { file: null },
  });
  const file = useWatch({ control: form.control, name: "file" });
  const fileError = form.formState.errors.file?.message;

  const source = file && getFileExtension(file.name) === "pdf" ? "pdf" : "docx";
  const target = source === "pdf" ? "docx" : "pdf";

  function selectFile([selected]: File[]) {
    if (!selected) return;
    const error = validate(selected);
    if (error) return form.setError("file", { message: error });
    form.clearErrors("file");
    form.setValue("file", selected);
  }

  function startOver() {
    convert.reset();
    form.reset();
  }

  function submit({ file }: ConverterOutput) {
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
        <form noValidate onSubmit={form.handleSubmit(submit)} className="flex flex-col gap-6">
          <FileChip file={file} preview defaultPreviewOpen>
            <Button variant="ghost" size="sm" onClick={startOver}>
              {t("common.changeFile")}
            </Button>
          </FileChip>

          <div className="flex items-center justify-center gap-4 rounded-xl border bg-card p-6">
            <FormatBadge label={t(`converter.formats.${source}`)} />
            <ArrowRight className="size-5 text-muted-foreground" aria-hidden />
            <FormatBadge label={t(`converter.formats.${target}`)} highlighted />
          </div>
          <p className="text-sm text-muted-foreground">{t(`converter.notes.${source}`)}</p>

          {convert.isError && <ErrorAlert title={t("converter.errorTitle")} error={convert.error} />}

          <SubmitButton retry={convert.isError}>{t(`converter.submit.${target}`)}</SubmitButton>
        </form>
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
