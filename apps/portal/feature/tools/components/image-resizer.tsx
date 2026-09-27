"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Image as ImageIcon, Link2, Link2Off } from "lucide-react";

import {
  ErrorAlert,
  FieldError,
  FileChip,
  FileDropzone,
  FileResult,
  NumberField,
  Processing,
  Segmented,
  SelectField,
  SubmitButton,
  ToolIntro,
  useFileValidator,
} from "@/components/file-tools";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  FIT_MODES,
  IMAGE_ACCEPT,
  IMAGE_EXTENSIONS,
  IMAGE_FORMATS,
  IMAGE_MAX_SIZE,
  MAX_IMAGE_DIMENSION,
  RESIZE_PRESETS,
  type FitMode,
  type ImageFormat,
} from "../constants";
import { useFileTool } from "../hooks/query";
import { useImagePreview } from "../hooks/use-image-preview";
import { fileStem } from "../utils";

const MAX_SIZE_MB = IMAGE_MAX_SIZE / 1024 / 1024;
const KEEP_FORMAT = "original";

function parseDimension(value: string): number | null {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 && number <= MAX_IMAGE_DIMENSION ? number : null;
}

export function ImageResizer() {
  const { t } = useTranslation("tools");
  const resize = useFileTool("image-resize");
  const validate = useFileValidator({
    extensions: IMAGE_EXTENSIONS,
    maxSize: IMAGE_MAX_SIZE,
    typeError: t("common.imageType"),
  });

  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [lockRatio, setLockRatio] = useState(true);
  const [fit, setFit] = useState<FitMode>("cover");
  const [format, setFormat] = useState<ImageFormat | typeof KEEP_FORMAT>(KEEP_FORMAT);

  const original = useImagePreview(file);
  const result = useImagePreview(resize.data?.blob);
  const ratio = original && original.height ? original.width / original.height : null;

  const parsedWidth = parseDimension(width);
  const parsedHeight = parseDimension(height);
  const invalid =
    (width !== "" && parsedWidth === null) ||
    (height !== "" && parsedHeight === null) ||
    (parsedWidth === null && parsedHeight === null);
  // With the ratio locked, only one side is sent and the service keeps the ratio.
  const bothSides = !lockRatio && parsedWidth !== null && parsedHeight !== null;

  function selectFile([selected]: File[]) {
    if (!selected) return;
    const error = validate(selected);
    setFileError(error);
    if (!error) setFile(selected);
  }

  function changeWidth(value: string) {
    setWidth(value);
    const number = parseDimension(value);
    if (lockRatio && ratio && number) setHeight(String(Math.max(1, Math.round(number / ratio))));
  }

  function changeHeight(value: string) {
    setHeight(value);
    const number = parseDimension(value);
    if (lockRatio && ratio && number) setWidth(String(Math.max(1, Math.round(number * ratio))));
  }

  function applyPreset(presetWidth: number, presetHeight: number) {
    setLockRatio(false);
    setWidth(String(presetWidth));
    setHeight(String(presetHeight));
  }

  function startOver() {
    resize.reset();
    setFile(null);
    setFileError(null);
    setWidth("");
    setHeight("");
  }

  function submit() {
    if (!file || invalid) return;
    const body = new FormData();
    body.append("file", file);
    if (lockRatio) {
      if (parsedWidth) body.append("width", String(parsedWidth));
      else if (parsedHeight) body.append("height", String(parsedHeight));
    } else {
      if (parsedWidth) body.append("width", String(parsedWidth));
      if (parsedHeight) body.append("height", String(parsedHeight));
      body.append("fit", fit);
    }
    if (format !== KEEP_FORMAT) body.append("format", format);
    resize.mutate({ body, fallbackName: `${fileStem(file.name)}_resized` });
  }

  return (
    <div className="flex flex-col gap-8">
      <ToolIntro
        icon={ImageIcon}
        category={t("categories.imageTools")}
        title={t("resizer.title")}
        description={t("resizer.description")}
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

      {file && !resize.isPending && !resize.isSuccess && (
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
            <p className="text-sm font-medium">{t("resizer.presets")}</p>
            <div className="flex flex-wrap gap-2">
              {RESIZE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset.width, preset.height)}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-left text-xs transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    !lockRatio && parsedWidth === preset.width && parsedHeight === preset.height
                      ? "border-brand bg-brand-soft/40"
                      : "bg-background hover:border-brand/40",
                  )}
                >
                  <span className="block font-medium">{t(`resizer.presetNames.${preset.id}`)}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {preset.width} × {preset.height}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid items-end gap-3 grid-cols-[1fr_auto_1fr]">
            <NumberField
              label={t("resizer.width")}
              value={width}
              onChange={changeWidth}
              min={1}
              max={MAX_IMAGE_DIMENSION}
              suffix="px"
              placeholder={original?.width ? String(original.width) : undefined}
            />
            <Button
              variant="outline"
              size="icon-lg"
              className="rounded-lg"
              aria-pressed={lockRatio}
              aria-label={lockRatio ? t("resizer.unlockRatio") : t("resizer.lockRatio")}
              onClick={() => setLockRatio((locked) => !locked)}
            >
              {lockRatio ? <Link2 aria-hidden /> : <Link2Off aria-hidden />}
            </Button>
            <NumberField
              label={t("resizer.height")}
              value={height}
              onChange={changeHeight}
              min={1}
              max={MAX_IMAGE_DIMENSION}
              suffix="px"
              placeholder={original?.height ? String(original.height) : undefined}
            />
          </div>
          <p className="-mt-3 text-xs text-muted-foreground">
            {lockRatio ? t("resizer.ratioLocked") : t("resizer.ratioUnlocked")}
          </p>

          {bothSides && (
            <Segmented
              label={t("resizer.fit")}
              value={fit}
              onChange={setFit}
              options={FIT_MODES.map((mode) => ({
                value: mode,
                label: t(`resizer.fitModes.${mode}`),
                description: t(`resizer.fitDescriptions.${mode}`),
              }))}
            />
          )}

          <SelectField
            label={t("common.outputFormat")}
            value={format}
            onChange={setFormat}
            options={[
              { value: KEEP_FORMAT, label: t("common.keepFormat") },
              ...IMAGE_FORMATS.map((value) => ({ value, label: value.toUpperCase() })),
            ]}
          />

          {(width !== "" || height !== "") && invalid && (
            <FieldError>{t("resizer.invalidSize", { max: MAX_IMAGE_DIMENSION })}</FieldError>
          )}

          {resize.isError && <ErrorAlert title={t("resizer.errorTitle")} error={resize.error} />}

          <SubmitButton retry={resize.isError} disabled={invalid} onClick={submit}>
            {t("resizer.submit")}
          </SubmitButton>
        </section>
      )}

      {file && resize.isPending && (
        <Processing title={t("resizer.processing", { fileName: file.name })} description={t("common.processing")} />
      )}

      {resize.data && (
        <FileResult
          blob={resize.data.blob}
          fileName={resize.data.fileName}
          title={t("resizer.doneTitle")}
          description={t("resizer.doneDescription", {
            width: resize.data.headers["x-image-width"] ?? result?.width,
            height: resize.data.headers["x-image-height"] ?? result?.height,
          })}
          onReset={startOver}
          resetLabel={t("resizer.another")}
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
