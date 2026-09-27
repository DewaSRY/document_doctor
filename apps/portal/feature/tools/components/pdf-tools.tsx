"use client";

import { useId } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { ArrowDown, ArrowUp, Combine, FileText, X } from "lucide-react";

import {
  ErrorAlert,
  FieldError,
  FileDropzone,
  FileResult,
  Processing,
  Segmented,
  SubmitButton,
  ToolIntro,
  useFileValidator,
} from "@/components/file-tools";
import { FileChip } from "@/components/file-chip";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { zodResolverTranslate } from "@/lib/form";

import { FILE_TOOL_MAX_SIZE, MAX_MERGE_FILES, PDF_ACCEPT } from "../constants";
import { useFileTool, usePdfInfo } from "../hooks/query";
import {
  mergeSchema,
  pdfFileSchema,
  splitSchema,
  type MergeOutput,
  type MergeValues,
  type SplitOutput,
  type SplitValues,
} from "../schema";
import { fileStem } from "../utils";

const MAX_SIZE_MB = FILE_TOOL_MAX_SIZE / 1024 / 1024;

type PdfMode = "merge" | "split";

export function PdfTools({ defaultMode = "merge" }: { defaultMode?: PdfMode }) {
  const { t } = useTranslation("tools");

  return (
    <div className="flex flex-col gap-8">
      <ToolIntro
        icon={Combine}
        category={t("categories.fileTools")}
        title={t("pdf.title")}
        description={t("pdf.description")}
      />

      <Tabs defaultValue={defaultMode} className="gap-6">
        <TabsList className="w-full sm:w-fit">
          <TabsTrigger value="merge" className="px-4">
            {t("pdf.merge.tab")}
          </TabsTrigger>
          <TabsTrigger value="split" className="px-4">
            {t("pdf.split.tab")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="merge" className="text-base">
          <MergePdfs />
        </TabsContent>
        <TabsContent value="split" className="text-base">
          <SplitPdf />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MergePdfs() {
  const { t } = useTranslation("tools");
  const merge = useFileTool("pdf-merge");
  const validate = useFileValidator(pdfFileSchema);

  const form = useForm<MergeValues, unknown, MergeOutput>({
    resolver: zodResolverTranslate(mergeSchema, t),
    defaultValues: { files: [] },
  });
  // Each queued file gets a stable `id` from useFieldArray, for keys and reordering.
  const { fields: files, append, move, remove } = useFieldArray({
    control: form.control,
    name: "files",
  });
  const fileError = form.formState.errors.files?.message;

  function addFiles(picked: File[]) {
    const errors = picked.map(validate).filter(Boolean);
    const valid = picked.filter((file) => !validate(file));
    const room = MAX_MERGE_FILES - files.length;

    const error =
      errors[0] ?? (valid.length > room ? t("pdf.merge.tooMany", { count: MAX_MERGE_FILES }) : null);
    append(valid.slice(0, room).map((file) => ({ file })));
    // After append, which would otherwise rewrite the field's errors.
    if (error) form.setError("files", { message: error });
    else form.clearErrors("files");
  }

  function startOver() {
    merge.reset();
    form.reset();
  }

  function submit({ files }: MergeOutput) {
    const body = new FormData();
    for (const { file } of files) body.append("files", file);
    merge.mutate({ body, fallbackName: "merged.pdf" });
  }

  if (merge.isPending) {
    return (
      <Processing
        title={t("pdf.merge.processing", { count: files.length })}
        description={t("common.processing")}
      />
    );
  }

  if (merge.data) {
    return (
      <FileResult
        blob={merge.data.blob}
        fileName={merge.data.fileName}
        title={t("pdf.merge.doneTitle")}
        description={t("pdf.merge.doneDescription", { count: files.length })}
        onReset={startOver}
        resetLabel={t("pdf.merge.another")}
      />
    );
  }

  return (
    <form noValidate onSubmit={form.handleSubmit(submit)} className="flex flex-col gap-6">
      <p className="text-muted-foreground">{t("pdf.merge.intro")}</p>

      {files.length > 0 && (
        <ol className="flex flex-col gap-2" aria-label={t("pdf.merge.order")}>
          {files.map(({ id, file }, index) => (
            <li key={id}>
              <FileChip
                file={file}
                icon={FileText}
                preview
                defaultPreviewOpen={false}
              >
                <span className="text-xs font-medium text-muted-foreground tabular-nums">
                  {index + 1}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("pdf.merge.moveUp", { name: file.name })}
                  disabled={index === 0}
                  onClick={() => move(index, index - 1)}
                >
                  <ArrowUp aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("pdf.merge.moveDown", { name: file.name })}
                  disabled={index === files.length - 1}
                  onClick={() => move(index, index + 1)}
                >
                  <ArrowDown aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("pdf.merge.remove", { name: file.name })}
                  onClick={() => remove(index)}
                >
                  <X aria-hidden />
                </Button>
              </FileChip>
            </li>
          ))}
        </ol>
      )}

      {files.length < MAX_MERGE_FILES && (
        <FileDropzone
          accept={PDF_ACCEPT}
          multiple
          compact={files.length > 0}
          hint={t("pdf.merge.hint", {
            size: MAX_SIZE_MB,
            count: MAX_MERGE_FILES,
          })}
          onFiles={addFiles}
        />
      )}
      <FieldError>{fileError}</FieldError>

      {files.length === 1 && (
        <p className="text-sm text-muted-foreground">
          {t("pdf.merge.needTwo")}
        </p>
      )}

      {merge.isError && (
        <ErrorAlert title={t("pdf.merge.errorTitle")} error={merge.error} />
      )}

      {files.length > 0 && (
        <SubmitButton retry={merge.isError} disabled={files.length < 2}>
          {t("pdf.merge.submit", { count: files.length })}
        </SubmitButton>
      )}
    </form>
  );
}

function SplitPdf() {
  const { t } = useTranslation("tools");
  const split = useFileTool("pdf-split");
  const info = usePdfInfo();
  const validate = useFileValidator(pdfFileSchema);
  const rangesId = useId();
  const singleId = useId();

  const form = useForm<SplitValues, unknown, SplitOutput>({
    resolver: zodResolverTranslate(splitSchema, t),
    defaultValues: { file: null, mode: "ranges", ranges: "", singleFile: false },
    mode: "onChange",
  });
  const [file, mode] = useWatch({ control: form.control, name: ["file", "mode"] });
  const { errors, isValid } = form.formState;

  const pageCount = info.data?.page_count;

  function selectFile([selected]: File[]) {
    if (!selected) return;
    const error = validate(selected);
    if (error) return form.setError("file", { message: error });
    form.clearErrors("file");
    form.setValue("file", selected, { shouldValidate: true });
    info.mutate(selected);
  }

  function startOver() {
    split.reset();
    info.reset();
    // Keep the split mode and single-file choice for the next PDF.
    form.reset({ ...form.getValues(), file: null, ranges: "" });
  }

  function submit({ file, mode, ranges, singleFile }: SplitOutput) {
    const body = new FormData();
    body.append("file", file);
    if (mode === "ranges") {
      body.append("ranges", ranges);
      body.append("single_file", String(singleFile));
    }
    split.mutate({ body, fallbackName: `${fileStem(file.name)}_pages.zip` });
  }

  if (!file) {
    return (
      <section className="flex flex-col gap-6">
        <p className="text-muted-foreground">{t("pdf.split.intro")}</p>
        <FileDropzone
          accept={PDF_ACCEPT}
          hint={t("common.pdfHint", { size: MAX_SIZE_MB })}
          onFiles={selectFile}
        />
        <FieldError>{errors.file?.message}</FieldError>
      </section>
    );
  }

  if (split.isPending) {
    return (
      <Processing
        title={t("pdf.split.processing", { fileName: file.name })}
        description={t("common.processing")}
      />
    );
  }

  if (split.data) {
    const zipped = split.data.fileName.endsWith(".zip");
    return (
      <FileResult
        blob={split.data.blob}
        fileName={split.data.fileName}
        title={t("pdf.split.doneTitle")}
        description={zipped ? t("pdf.split.doneZip") : t("pdf.split.donePdf")}
        onReset={startOver}
        resetLabel={t("pdf.split.another")}
      />
    );
  }

  return (
    <form noValidate onSubmit={form.handleSubmit(submit)} className="flex flex-col gap-6">
      <FileChip file={file} preview>
        {pageCount !== undefined && (
          <span className="text-xs text-muted-foreground">
            {t("pdf.split.pages", { count: pageCount })}
          </span>
        )}
        <Button variant="ghost" size="sm" onClick={startOver}>
          {t("common.changeFile")}
        </Button>
      </FileChip>

      {info.isError && (
        <ErrorAlert title={t("pdf.split.readError")} error={info.error} />
      )}

      {!info.isError && (
        <>
          <Controller
            control={form.control}
            name="mode"
            render={({ field }) => (
              <Segmented
                label={t("pdf.split.how")}
                value={field.value}
                onChange={field.onChange}
                options={[
                  {
                    value: "ranges",
                    label: t("pdf.split.modes.ranges"),
                    description: t("pdf.split.modeDescriptions.ranges"),
                  },
                  {
                    value: "every",
                    label: t("pdf.split.modes.every"),
                    description: t("pdf.split.modeDescriptions.every"),
                  },
                ]}
              />
            )}
          />

          {mode === "ranges" && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor={rangesId} className="text-sm font-medium">
                  {t("pdf.split.ranges")}
                </label>
                <input
                  id={rangesId}
                  {...form.register("ranges")}
                  aria-invalid={!!errors.ranges || undefined}
                  placeholder={t("pdf.split.rangesPlaceholder")}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
                <p className="text-xs text-muted-foreground">
                  {pageCount
                    ? t("pdf.split.rangesHintCount", { count: pageCount })
                    : t("pdf.split.rangesHint")}
                </p>
              </div>
              <label
                htmlFor={singleId}
                className="flex items-start gap-2.5 text-sm"
              >
                <input
                  id={singleId}
                  type="checkbox"
                  {...form.register("singleFile")}
                  className="mt-0.5 size-4 accent-brand"
                />
                <span>
                  <span className="font-medium">
                    {t("pdf.split.singleFile")}
                  </span>
                  <span className="block text-muted-foreground">
                    {t("pdf.split.singleFileDescription")}
                  </span>
                </span>
              </label>
            </div>
          )}

          {split.isError && (
            <ErrorAlert title={t("pdf.split.errorTitle")} error={split.error} />
          )}

          <SubmitButton retry={split.isError} disabled={!isValid}>
            {t("pdf.split.submit")}
          </SubmitButton>
        </>
      )}
    </form>
  );
}
