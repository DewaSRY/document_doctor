"use client";

import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Image as ImageIcon, Link2, Link2Off } from "lucide-react";

import {
  ErrorAlert,
  FieldError,
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
import { FileChip } from "@/components/file-chip";
import { useLeaveGuard } from "@/components/leave-guard";
import { Button } from "@/components/ui/button";
import { zodResolverTranslate } from "@/lib/form";
import { cn } from "@/lib/utils";

import {
  FIT_MODES,
  IMAGE_ACCEPT,
  IMAGE_FORMATS,
  IMAGE_MAX_SIZE,
  MAX_IMAGE_DIMENSION,
  RESIZE_PRESETS,
} from "../constants";
import { useFileTool } from "../hooks/query";
import { useImagePreview } from "../hooks/use-image-preview";
import {
  imageFileSchema,
  isDimension,
  KEEP_FORMAT,
  resizerSchema,
  type ResizerOutput,
  type ResizerValues,
} from "../schema";
import { fileStem } from "../utils";

const MAX_SIZE_MB = IMAGE_MAX_SIZE / 1024 / 1024;

export function ImageResizer() {
  const { t } = useTranslation("tools");
  const resize = useFileTool("image-resize");
  const validate = useFileValidator(imageFileSchema);

  const form = useForm<ResizerValues, unknown, ResizerOutput>({
    resolver: zodResolverTranslate(resizerSchema, t),
    defaultValues: {
      file: null,
      width: "",
      height: "",
      lockRatio: true,
      fit: "cover",
      format: KEEP_FORMAT,
    },
    mode: "onChange",
  });
  useLeaveGuard(form.formState.isDirty && !resize.isSuccess);
  const [file, width, height, lockRatio] = useWatch({
    control: form.control,
    name: ["file", "width", "height", "lockRatio"],
  });
  const { errors, isValid } = form.formState;

  const original = useImagePreview(file);
  const result = useImagePreview(resize.data?.blob);
  const ratio = original && original.height ? original.width / original.height : null;

  const bothSides = !lockRatio && isDimension(width) && isDimension(height);
  const sizeError =
    width !== "" || height !== "" ? (errors.width?.message ?? errors.height?.message) : undefined;

  function selectFile([selected]: File[]) {
    if (!selected) return;
    const error = validate(selected);
    if (error) return form.setError("file", { message: error });
    form.clearErrors("file");
    form.setValue("file", selected, { shouldDirty: true });
  }

  /** Width and height are checked together: one side's value can clear or
   *  cause the other's error. */
  function setSize(size: { width?: string; height?: string }) {
    if (size.width !== undefined) form.setValue("width", size.width, { shouldDirty: true });
    if (size.height !== undefined) form.setValue("height", size.height, { shouldDirty: true });
    void form.trigger(["width", "height"]);
  }

  function changeWidth(value: string) {
    const linked = lockRatio && ratio && isDimension(value);
    setSize(linked ? { width: value, height: String(Math.max(1, Math.round(Number(value) / ratio))) } : { width: value });
  }

  function changeHeight(value: string) {
    const linked = lockRatio && ratio && isDimension(value);
    setSize(linked ? { width: String(Math.max(1, Math.round(Number(value) * ratio))), height: value } : { height: value });
  }

  function applyPreset(presetWidth: number, presetHeight: number) {
    form.setValue("lockRatio", false);
    setSize({ width: String(presetWidth), height: String(presetHeight) });
  }

  function startOver() {
    resize.reset();
    // Keep the ratio, fit and format choices for the next image.
    form.reset({ ...form.getValues(), file: null, width: "", height: "" });
  }

  function submit({ file, width, height, fit, format }: ResizerOutput) {
    const body = new FormData();
    body.append("file", file);
    if (width) body.append("width", String(width));
    if (height) body.append("height", String(height));
    if (fit) body.append("fit", fit);
    if (format) body.append("format", format);
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
          <FieldError>{errors.file?.message}</FieldError>
        </>
      )}

      {file && !resize.isPending && !resize.isSuccess && (
        <form noValidate onSubmit={form.handleSubmit(submit)} className="flex flex-col gap-6">
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
                    !lockRatio && Number(width) === preset.width && Number(height) === preset.height
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
              invalid={!!errors.width && !!sizeError}
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
              onClick={() => form.setValue("lockRatio", !lockRatio)}
            >
              {lockRatio ? <Link2 aria-hidden /> : <Link2Off aria-hidden />}
            </Button>
            <NumberField
              label={t("resizer.height")}
              value={height}
              onChange={changeHeight}
              invalid={!!errors.height && !!sizeError}
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
            <Controller
              control={form.control}
              name="fit"
              render={({ field }) => (
                <Segmented
                  label={t("resizer.fit")}
                  value={field.value}
                  onChange={field.onChange}
                  options={FIT_MODES.map((mode) => ({
                    value: mode,
                    label: t(`resizer.fitModes.${mode}`),
                    description: t(`resizer.fitDescriptions.${mode}`),
                  }))}
                />
              )}
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
                options={[
                  { value: KEEP_FORMAT, label: t("common.keepFormat") },
                  ...IMAGE_FORMATS.map((value) => ({ value, label: value.toUpperCase() })),
                ]}
              />
            )}
          />

          <FieldError>{sizeError}</FieldError>

          {resize.isError && <ErrorAlert title={t("resizer.errorTitle")} error={resize.error} />}

          <SubmitButton retry={resize.isError} disabled={!isValid}>
            {t("resizer.submit")}
          </SubmitButton>
        </form>
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
