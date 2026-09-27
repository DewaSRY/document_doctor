"use client";

import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ErrorAlert,
  FieldError,
  FileDropzone,
  FileResult,
  formatFileSize,
  NumberField,
  Processing,
  SelectField,
  SubmitButton,
  ToolIntro,
  useFileValidator,
} from "@/components/file-tools";
import { FileChip } from "@/components/file-chip";
import { Button } from "@/components/ui/button";
import { Image as ImageIcon, Minimize2 } from "lucide-react";

import {
  IMAGE_ACCEPT,
  IMAGE_EXTENSIONS,
  IMAGE_FORMATS,
  IMAGE_MAX_SIZE,
  MAX_IMAGE_DIMENSION,
  type ImageFormat,
} from "../constants";
import { useFileTool } from "../hooks/query";
import { useImagePreview } from "../hooks/use-image-preview";
import { fileStem } from "../utils";

const MAX_SIZE_MB = IMAGE_MAX_SIZE / 1024 / 1024;
const KEEP_FORMAT = "original";

export function ImageCompressor() {
  const { t } = useTranslation("tools");
  const compress = useFileTool("image-compress");
  const validate = useFileValidator({
    extensions: IMAGE_EXTENSIONS,
    maxSize: IMAGE_MAX_SIZE,
    typeError: t("common.imageType"),
  });
  const qualityId = useId();

  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [quality, setQuality] = useState(75);
  const [format, setFormat] = useState<ImageFormat | typeof KEEP_FORMAT>(KEEP_FORMAT);
  const [maxDimension, setMaxDimension] = useState("");

  const original = useImagePreview(file);
  const result = useImagePreview(compress.data?.blob);

  const parsedMax = maxDimension === "" ? null : Number(maxDimension);
  const invalidMax =
    parsedMax !== null && !(Number.isInteger(parsedMax) && parsedMax >= 1 && parsedMax <= MAX_IMAGE_DIMENSION);

  function selectFile([selected]: File[]) {
    if (!selected) return;
    const error = validate(selected);
    setFileError(error);
    if (!error) setFile(selected);
  }

  function startOver() {
    compress.reset();
    setFile(null);
    setFileError(null);
  }

  function submit() {
    if (!file || invalidMax) return;
    const body = new FormData();
    body.append("file", file);
    body.append("quality", String(quality));
    if (format !== KEEP_FORMAT) body.append("format", format);
    if (parsedMax) body.append("max_dimension", String(parsedMax));
    compress.mutate({ body, fallbackName: `${fileStem(file.name)}_compressed` });
  }

  const originalSize = Number(compress.data?.headers["x-original-size"] ?? file?.size ?? 0);
  const outputSize = compress.data?.blob.size ?? 0;
  const saved = originalSize > 0 ? Math.round((1 - outputSize / originalSize) * 100) : 0;

  return (
    <div className="flex flex-col gap-8">
      <ToolIntro
        icon={Minimize2}
        category={t("categories.imageTools")}
        title={t("compressor.title")}
        description={t("compressor.description")}
      />

      {!file && (
        <>
          <FileDropzone
            accept={IMAGE_ACCEPT}
            hint={t("common.imageHint", { size: MAX_SIZE_MB })}
            onFiles={selectFile}
          />
          <FieldError>{fileError}</FieldError>
        </>
      )}

      {file && !compress.isPending && !compress.isSuccess && (
        <section className="flex flex-col gap-6">
          <FileChip file={file} icon={ImageIcon}>
            {original && original.width > 0 && (
              <span className="text-xs text-muted-foreground tabular-nums">
                {original.width} × {original.height}
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={startOver}>
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

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label htmlFor={qualityId} className="text-sm font-medium">
                {t("compressor.quality")}
              </label>
              <span className="text-sm font-medium tabular-nums">{quality}</span>
            </div>
            <input
              id={qualityId}
              type="range"
              min={10}
              max={95}
              step={5}
              value={quality}
              onChange={(event) => setQuality(Number(event.target.value))}
              className="w-full accent-brand"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{t("compressor.smaller")}</span>
              <span>{t("compressor.sharper")}</span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField
              label={t("common.outputFormat")}
              value={format}
              onChange={setFormat}
              options={[
                { value: KEEP_FORMAT, label: t("common.keepFormat") },
                ...IMAGE_FORMATS.map((value) => ({ value, label: value.toUpperCase() })),
              ]}
            />
            <NumberField
              label={t("compressor.maxDimension")}
              value={maxDimension}
              onChange={setMaxDimension}
              min={1}
              max={MAX_IMAGE_DIMENSION}
              suffix="px"
              placeholder={t("compressor.maxDimensionPlaceholder")}
            />
          </div>
          <p className="-mt-3 text-xs text-muted-foreground">{t("compressor.hint")}</p>

          {invalidMax && (
            <FieldError>{t("compressor.invalidMax", { max: MAX_IMAGE_DIMENSION })}</FieldError>
          )}

          {compress.isError && <ErrorAlert title={t("compressor.errorTitle")} error={compress.error} />}

          <SubmitButton retry={compress.isError} disabled={invalidMax} onClick={submit}>
            {t("compressor.submit")}
          </SubmitButton>
        </section>
      )}

      {file && compress.isPending && (
        <Processing title={t("compressor.processing", { fileName: file.name })} description={t("common.processing")} />
      )}

      {compress.data && (
        <FileResult
          blob={compress.data.blob}
          fileName={compress.data.fileName}
          title={saved > 0 ? t("compressor.doneTitle", { percent: saved }) : t("compressor.noGainTitle")}
          description={
            saved > 0
              ? t("compressor.doneDescription", {
                  from: formatFileSize(originalSize),
                  to: formatFileSize(outputSize),
                })
              : t("compressor.noGainDescription")
          }
          onReset={startOver}
          resetLabel={t("compressor.another")}
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
