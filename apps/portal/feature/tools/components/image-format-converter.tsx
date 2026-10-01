"use client";

import { useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { ArrowLeftRight, Image as ImageIcon } from "lucide-react";

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
import { useLeaveGuard } from "@/components/leave-guard";
import { Button } from "@/components/ui/button";
import { zodResolverTranslate } from "@/lib/form";

import { IMAGE_MAX_SIZE, type SingleImageConversion } from "../constants";
import { useFileTool } from "../hooks/query";
import { useImagePreview } from "../hooks/use-image-preview";
import {
  imageFileSchema,
  singleImageConversionSchema,
  type SingleImageConversionOutput,
  type SingleImageConversionValues,
} from "../schema";
import { detectImageFormat, fileStem } from "../utils";
import { ResolutionSuggestions } from "./resolution-suggestions";

const MAX_SIZE_MB = IMAGE_MAX_SIZE / 1024 / 1024;
const SOURCE_LABELS: Record<SingleImageConversion["source"], string> = {
  png: "PNG",
  jpeg: "JPG",
};
const SOURCE_ACCEPT: Record<SingleImageConversion["source"], string> = {
  png: ".png,image/png",
  jpeg: ".jpg,.jpeg,image/jpeg",
};

/** A single fixed-pair conversion (e.g. jpg-to-png), split out of the
 *  multi-format image-converter so each service has one clear job. */
export function ImageFormatConverter({ source, target, id }: SingleImageConversion) {
  const { t } = useTranslation("tools");
  const convert = useFileTool("image-convert");
  const validate = useFileValidator(imageFileSchema);
  const key = `singleImageConversion.${id}`;

  const form = useForm<SingleImageConversionValues, unknown, SingleImageConversionOutput>({
    resolver: zodResolverTranslate(singleImageConversionSchema, t),
    defaultValues: { file: null },
    mode: "onChange",
  });
  useLeaveGuard(form.formState.isDirty && !convert.isSuccess);
  const [file] = useWatch({ control: form.control, name: ["file"] });
  const { errors, isValid } = form.formState;
  const original = useImagePreview(file);
  const result = useImagePreview(convert.data?.blob);

  async function selectFile([selected]: File[]) {
    if (!selected) return;
    const error = validate(selected);
    if (error) return form.setError("file", { message: error });

    const detected = await detectImageFormat(selected);
    if (detected !== source) {
      form.setError("file", { message: t(`${key}.wrongFormat`) });
      return;
    }

    convert.reset();
    form.clearErrors("file");
    form.setValue("file", selected, { shouldDirty: true, shouldValidate: true });
  }

  function startOver() {
    convert.reset();
    form.reset({ file: null });
  }

  function submit({ file }: SingleImageConversionOutput) {
    const body = new FormData();
    body.append("file", file);
    body.append("format", target);
    convert.mutate({
      body,
      fallbackName: `${fileStem(file.name)}.${target}`,
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <ToolIntro
        icon={ArrowLeftRight}
        category={t("categories.imageTools")}
        title={t(`${key}.title`)}
        description={t(`${key}.description`)}
      />

      {!file && (
        <>
          <FileDropzone
            accept={SOURCE_ACCEPT[source]}
            hint={t("common.imageHint", { size: MAX_SIZE_MB })}
            onFiles={(files) => void selectFile(files)}
          />
          <FieldError>{errors.file?.message}</FieldError>
        </>
      )}

      {file && !convert.isPending && !convert.isSuccess && (
        <form noValidate onSubmit={form.handleSubmit(submit)} className="flex flex-col gap-6">
          <FileChip file={file} icon={ImageIcon}>
            <span className="text-xs font-medium uppercase text-muted-foreground">
              {SOURCE_LABELS[source]}
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

          {convert.isError && <ErrorAlert title={t(`${key}.errorTitle`)} error={convert.error} />}

          <SubmitButton retry={convert.isError} disabled={!isValid}>
            {t(`${key}.submit`)}
          </SubmitButton>
        </form>
      )}

      {file && convert.isPending && (
        <Processing title={t(`${key}.processing`, { fileName: file.name })} description={t("common.processing")} />
      )}

      {convert.data && (
        <FileResult
          blob={convert.data.blob}
          fileName={convert.data.fileName}
          title={t(`${key}.doneTitle`)}
          onReset={startOver}
          resetLabel={t(`${key}.another`)}
        >
          {result && (
            // eslint-disable-next-line @next/next/no-img-element -- local object URL
            <img
              src={result.url}
              alt={t("common.resultAlt")}
              className="max-h-80 w-full rounded-lg border bg-muted object-contain"
            />
          )}
          <ResolutionSuggestions width={result?.width} height={result?.height} />
        </FileResult>
      )}
    </div>
  );
}
