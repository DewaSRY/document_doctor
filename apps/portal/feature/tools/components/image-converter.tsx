"use client";

import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { ArrowLeftRight, Image as ImageIcon } from "lucide-react";

import {
  ErrorAlert,
  FieldError,
  FileDropzone,
  FileResult,
  Processing,
  SelectField,
  SubmitButton,
  ToolIntro,
  useFileValidator,
} from "@/components/file-tools";
import { FileChip } from "@/components/file-chip";
import { useLeaveGuard } from "@/components/leave-guard";
import { Button } from "@/components/ui/button";
import { zodResolverTranslate } from "@/lib/form";

import { IMAGE_ACCEPT, IMAGE_MAX_SIZE } from "../constants";
import { useFileTool } from "../hooks/query";
import { useImagePreview } from "../hooks/use-image-preview";
import {
  imageConverterSchema,
  imageFileSchema,
  type ImageConverterOutput,
  type ImageConverterValues,
} from "../schema";
import { fileStem } from "../utils";

type SourceFormat = "png" | "jpeg" | "webp";
type TargetFormat = "webp" | "png" | "jpg" | "svg";

const TARGETS: Record<SourceFormat, TargetFormat[]> = {
  png: ["webp", "svg"],
  jpeg: ["webp"],
  webp: ["png", "jpg"],
};

const MAX_SIZE_MB = IMAGE_MAX_SIZE / 1024 / 1024;

async function detectSourceFormat(file: File): Promise<SourceFormat | null> {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (
    bytes.length >= 8 &&
    pngSignature.every((value, index) => bytes[index] === value)
  ) {
    return "png";
  }
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "jpeg";
  }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return "webp";
  }
  return null;
}

export function ImageConverter() {
  const { t } = useTranslation("tools");
  const convert = useFileTool("image-convert");
  const validate = useFileValidator(imageFileSchema);
  const [sourceFormat, setSourceFormat] = useState<SourceFormat | null>(null);

  const form = useForm<ImageConverterValues, unknown, ImageConverterOutput>({
    resolver: zodResolverTranslate(imageConverterSchema, t),
    defaultValues: { file: null, format: "webp" },
    mode: "onChange",
  });
  useLeaveGuard(form.formState.isDirty && !convert.isSuccess);
  const [file, format] = useWatch({
    control: form.control,
    name: ["file", "format"],
  });
  const { errors, isValid } = form.formState;
  const original = useImagePreview(file);
  const result = useImagePreview(convert.data?.blob);
  const targets = sourceFormat ? TARGETS[sourceFormat] : [];

  async function selectFile([selected]: File[]) {
    if (!selected) return;
    const error = validate(selected);
    if (error) return form.setError("file", { message: error });

    const detected = await detectSourceFormat(selected);
    if (!detected) {
      form.setError("file", { message: t("common.imageType") });
      return;
    }

    convert.reset();
    form.clearErrors("file");
    setSourceFormat(detected);
    form.setValue("file", selected, {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.setValue("format", TARGETS[detected][0], {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  function startOver() {
    convert.reset();
    setSourceFormat(null);
    form.reset({ file: null, format: "webp" });
  }

  function submit({ file, format }: ImageConverterOutput) {
    const body = new FormData();
    body.append("file", file);
    body.append("format", format);
    convert.mutate({
      body,
      fallbackName: `${fileStem(file.name)}_converted.${format}`,
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <ToolIntro
        icon={ArrowLeftRight}
        category={t("categories.imageTools")}
        title={t("imageConverter.title")}
        description={t("imageConverter.description")}
      />

      {!file && (
        <>
          <FileDropzone
            accept={IMAGE_ACCEPT}
            hint={t("common.imageHint", { size: MAX_SIZE_MB })}
            onFiles={(files) => void selectFile(files)}
          />
          <FieldError>{errors.file?.message}</FieldError>
        </>
      )}

      {file && !convert.isPending && !convert.isSuccess && (
        <form
          noValidate
          onSubmit={form.handleSubmit(submit)}
          className="flex flex-col gap-6"
        >
          <FileChip file={file} icon={ImageIcon}>
            <span className="text-xs font-medium uppercase text-muted-foreground">
              {sourceFormat === "jpeg" ? "JPEG" : sourceFormat?.toUpperCase()}
            </span>
            <Button type="button" variant="ghost" size="sm" onClick={startOver}>
              {t("common.changeFile")}
            </Button>
          </FileChip>

          {original && (
            // eslint-disable-next-line @next/next/no-img-element -- local object URL
            <img
              src={original.url}
              alt={t("common.previewAlt", { name: file.name })}
              className="max-h-64 w-full rounded-lg border bg-muted object-contain"
            />
          )}

          <Controller
            control={form.control}
            name="format"
            render={({ field }) => (
              <SelectField
                label={t("common.outputFormat")}
                value={field.value}
                onChange={field.onChange}
                options={targets.map((target) => ({
                  value: target,
                  label: target.toUpperCase(),
                }))}
              />
            )}
          />

          {convert.isError && (
            <ErrorAlert
              title={t("imageConverter.errorTitle")}
              error={convert.error}
            />
          )}

          <SubmitButton retry={convert.isError} disabled={!isValid}>
            {t("imageConverter.submit", { format: format.toUpperCase() })}
          </SubmitButton>
        </form>
      )}

      {file && convert.isPending && (
        <Processing
          title={t("imageConverter.processing", { fileName: file.name })}
          description={t("common.processing")}
        />
      )}

      {convert.data && (
        <FileResult
          blob={convert.data.blob}
          fileName={convert.data.fileName}
          title={t("imageConverter.doneTitle")}
          onReset={startOver}
          resetLabel={t("imageConverter.another")}
        >
          {result && (
            // eslint-disable-next-line @next/next/no-img-element -- local object URL
            <img
              src={result.url}
              alt={t("common.resultAlt")}
              className="max-h-80 w-full rounded-lg border bg-muted object-contain"
            />
          )}
        </FileResult>
      )}
    </div>
  );
}
