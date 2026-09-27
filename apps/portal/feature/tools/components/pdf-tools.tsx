"use client";

import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowDown, ArrowUp, Combine, FileText, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { FILE_TOOL_MAX_SIZE, MAX_MERGE_FILES, PDF_ACCEPT, PDF_EXTENSIONS } from "../constants";
import { useFileTool, usePdfInfo } from "../hooks/query";
import { fileStem } from "../utils";
import {
  ErrorAlert,
  FieldError,
  FileChip,
  FileDropzone,
  FileResult,
  Processing,
  Segmented,
  SubmitButton,
  ToolIntro,
  useFileValidator,
} from "./shared";

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

type QueuedFile = { id: string; file: File };

function MergePdfs() {
  const { t } = useTranslation("tools");
  const merge = useFileTool("pdf-merge");
  const validate = useFileValidator({
    extensions: PDF_EXTENSIONS,
    maxSize: FILE_TOOL_MAX_SIZE,
    typeError: t("common.pdfType"),
  });

  const [files, setFiles] = useState<QueuedFile[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);

  function addFiles(picked: File[]) {
    const errors = picked.map(validate).filter(Boolean);
    const valid = picked.filter((file) => !validate(file));
    const room = MAX_MERGE_FILES - files.length;

    setFileError(
      errors[0] ?? (valid.length > room ? t("pdf.merge.tooMany", { count: MAX_MERGE_FILES }) : null),
    );
    setFiles((current) => [
      ...current,
      ...valid.slice(0, room).map((file) => ({ id: crypto.randomUUID(), file })),
    ]);
  }

  function move(index: number, offset: number) {
    setFiles((current) => {
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(index + offset, 0, item);
      return next;
    });
  }

  function startOver() {
    merge.reset();
    setFiles([]);
    setFileError(null);
  }

  function submit() {
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
    <section className="flex flex-col gap-6">
      <p className="text-muted-foreground">{t("pdf.merge.intro")}</p>

      {files.length > 0 && (
        <ol className="flex flex-col gap-2" aria-label={t("pdf.merge.order")}>
          {files.map(({ id, file }, index) => (
            <li key={id}>
              <FileChip file={file} icon={FileText}>
                <span className="text-xs font-medium text-muted-foreground tabular-nums">
                  {index + 1}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("pdf.merge.moveUp", { name: file.name })}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("pdf.merge.moveDown", { name: file.name })}
                  disabled={index === files.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("pdf.merge.remove", { name: file.name })}
                  onClick={() => setFiles((current) => current.filter((item) => item.id !== id))}
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
          hint={t("pdf.merge.hint", { size: MAX_SIZE_MB, count: MAX_MERGE_FILES })}
          onFiles={addFiles}
        />
      )}
      <FieldError>{fileError}</FieldError>

      {files.length === 1 && <p className="text-sm text-muted-foreground">{t("pdf.merge.needTwo")}</p>}

      {merge.isError && <ErrorAlert title={t("pdf.merge.errorTitle")} error={merge.error} />}

      {files.length > 0 && (
        <SubmitButton retry={merge.isError} disabled={files.length < 2} onClick={submit}>
          {t("pdf.merge.submit", { count: files.length })}
        </SubmitButton>
      )}
    </section>
  );
}

type SplitMode = "every" | "ranges";

function SplitPdf() {
  const { t } = useTranslation("tools");
  const split = useFileTool("pdf-split");
  const info = usePdfInfo();
  const validate = useFileValidator({
    extensions: PDF_EXTENSIONS,
    maxSize: FILE_TOOL_MAX_SIZE,
    typeError: t("common.pdfType"),
  });
  const rangesId = useId();
  const singleId = useId();

  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [mode, setMode] = useState<SplitMode>("ranges");
  const [ranges, setRanges] = useState("");
  const [singleFile, setSingleFile] = useState(false);

  const pageCount = info.data?.page_count;

  function selectFile([selected]: File[]) {
    if (!selected) return;
    const error = validate(selected);
    setFileError(error);
    if (error) return;
    setFile(selected);
    info.mutate(selected);
  }

  function startOver() {
    split.reset();
    info.reset();
    setFile(null);
    setFileError(null);
    setRanges("");
  }

  function submit() {
    if (!file) return;
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
        <FieldError>{fileError}</FieldError>
      </section>
    );
  }

  if (split.isPending) {
    return <Processing title={t("pdf.split.processing", { fileName: file.name })} description={t("common.processing")} />;
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
    <section className="flex flex-col gap-6">
      <FileChip file={file}>
        {pageCount !== undefined && (
          <span className="text-xs text-muted-foreground">{t("pdf.split.pages", { count: pageCount })}</span>
        )}
        <Button variant="ghost" size="sm" onClick={startOver}>
          {t("common.changeFile")}
        </Button>
      </FileChip>

      {info.isError && <ErrorAlert title={t("pdf.split.readError")} error={info.error} />}

      {!info.isError && (
        <>
          <Segmented
            label={t("pdf.split.how")}
            value={mode}
            onChange={setMode}
            options={[
              { value: "ranges", label: t("pdf.split.modes.ranges"), description: t("pdf.split.modeDescriptions.ranges") },
              { value: "every", label: t("pdf.split.modes.every"), description: t("pdf.split.modeDescriptions.every") },
            ]}
          />

          {mode === "ranges" && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor={rangesId} className="text-sm font-medium">
                  {t("pdf.split.ranges")}
                </label>
                <input
                  id={rangesId}
                  value={ranges}
                  onChange={(event) => setRanges(event.target.value)}
                  placeholder={t("pdf.split.rangesPlaceholder")}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
                <p className="text-xs text-muted-foreground">
                  {pageCount
                    ? t("pdf.split.rangesHintCount", { count: pageCount })
                    : t("pdf.split.rangesHint")}
                </p>
              </div>
              <label htmlFor={singleId} className="flex items-start gap-2.5 text-sm">
                <input
                  id={singleId}
                  type="checkbox"
                  checked={singleFile}
                  onChange={(event) => setSingleFile(event.target.checked)}
                  className="mt-0.5 size-4 accent-brand"
                />
                <span>
                  <span className="font-medium">{t("pdf.split.singleFile")}</span>
                  <span className="block text-muted-foreground">{t("pdf.split.singleFileDescription")}</span>
                </span>
              </label>
            </div>
          )}

          {split.isError && <ErrorAlert title={t("pdf.split.errorTitle")} error={split.error} />}

          <SubmitButton
            retry={split.isError}
            disabled={mode === "ranges" && !ranges.trim()}
            onClick={submit}
          >
            {t("pdf.split.submit")}
          </SubmitButton>
        </>
      )}
    </section>
  );
}
