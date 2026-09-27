"use client";

import { useId, useRef, useState, type DragEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  ArrowLeftRight,
  Check,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  PencilLine,
  RotateCcw,
  Upload,
} from "lucide-react";

import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  ACCEPT_ATTRIBUTE,
  ACCEPTED_EXTENSIONS,
  LANGUAGE_CODES,
  MAX_FILE_SIZE,
  getDownloadHref,
  getFileExtension,
  type LanguageCode,
} from "../constants";
import { useTranslateDocument } from "../hooks/query";
import { getTranslatorErrorMessage } from "../utils";

type Step = "upload" | "languages" | "translating" | "done";

const STEPS: { id: Step; label: string }[] = [
  { id: "upload", label: "steps.upload" },
  { id: "languages", label: "steps.languages" },
  { id: "translating", label: "steps.translate" },
  { id: "done", label: "steps.done" },
];

const MAX_FILE_SIZE_MB = MAX_FILE_SIZE / 1024 / 1024;

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function TranslateWizard() {
  const { t } = useTranslation("translator");
  const translate = useTranslateDocument();

  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [sourceLanguage, setSourceLanguage] = useState<LanguageCode>("id");
  const [targetLanguage, setTargetLanguage] = useState<LanguageCode>("en");

  const step: Step = translate.isSuccess
    ? "done"
    : translate.isPending
      ? "translating"
      : file
        ? "languages"
        : "upload";

  const languageName = (code: LanguageCode) => t(`languages.${code}`);

  function selectFile(selected: File | undefined) {
    if (!selected) return;
    const extension = getFileExtension(selected.name);

    if (!(ACCEPTED_EXTENSIONS as readonly string[]).includes(extension)) {
      setFileError(t("upload.invalidType"));
    } else if (selected.size > MAX_FILE_SIZE) {
      setFileError(t("upload.tooLarge", { size: MAX_FILE_SIZE_MB }));
    } else if (selected.size === 0) {
      setFileError(t("upload.empty"));
    } else {
      setFileError(null);
      setFile(selected);
    }
  }

  function startOver() {
    translate.reset();
    setFile(null);
    setFileError(null);
  }

  function submit() {
    if (!file || sourceLanguage === targetLanguage) return;
    translate.mutate({ file, sourceLanguage, targetLanguage });
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10 sm:py-14">
      <StepIndicator current={step} />

      {step === "upload" && (
        <UploadStep onSelect={selectFile} error={fileError} />
      )}

      {step === "languages" && file && (
        <section aria-labelledby="languages-title" className="flex flex-col gap-6">
          <div>
            <h1 id="languages-title" className="text-2xl font-semibold tracking-tight">
              {t("languageStep.title")}
            </h1>
            <p className="mt-2 text-muted-foreground">
              {t("languageStep.description")}
            </p>
          </div>

          <FileChip file={file}>
            <Button variant="ghost" size="sm" onClick={startOver}>
              {t("languageStep.changeFile")}
            </Button>
          </FileChip>

          <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
            <LanguageSelect
              label={t("languageStep.source")}
              value={sourceLanguage}
              onChange={setSourceLanguage}
              languageName={languageName}
            />
            <Button
              variant="outline"
              size="icon-lg"
              className="justify-self-center rounded-lg"
              aria-label={t("languageStep.swap")}
              onClick={() => {
                setSourceLanguage(targetLanguage);
                setTargetLanguage(sourceLanguage);
              }}
            >
              <ArrowLeftRight aria-hidden />
            </Button>
            <LanguageSelect
              label={t("languageStep.target")}
              value={targetLanguage}
              onChange={setTargetLanguage}
              languageName={languageName}
            />
          </div>

          {sourceLanguage === targetLanguage && (
            <p role="alert" className="text-sm text-destructive">
              {t("languageStep.sameLanguage")}
            </p>
          )}

          {translate.isError && (
            <div
              role="alert"
              className="flex gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
              <div>
                <p className="font-medium">{t("error.title")}</p>
                <p className="mt-1 text-muted-foreground">
                  {getTranslatorErrorMessage(translate.error) ?? t("error.description")}
                </p>
              </div>
            </div>
          )}

          <Button
            size="lg"
            className="h-11 rounded-lg text-base sm:self-start"
            disabled={sourceLanguage === targetLanguage}
            onClick={submit}
          >
            {translate.isError && <RotateCcw aria-hidden />}
            {translate.isError ? t("error.retry") : t("languageStep.submit")}
          </Button>
        </section>
      )}

      {step === "translating" && file && (
        <section
          aria-live="polite"
          className="flex flex-col items-center gap-4 rounded-xl border bg-card px-6 py-14 text-center"
        >
          <Loader2 className="size-10 animate-spin text-brand" aria-hidden />
          <h1 className="text-xl font-semibold tracking-tight">
            {t("translating.title", { fileName: file.name })}
          </h1>
          <p className="max-w-md text-muted-foreground">
            {t("translating.description", {
              source: languageName(sourceLanguage),
              target: languageName(targetLanguage),
            })}
          </p>
        </section>
      )}

      {step === "done" && translate.data && (
        <section aria-labelledby="done-title" className="flex flex-col gap-6">
          <div className="flex flex-col items-center text-center">
            <CheckCircle2 className="size-10 text-brand" aria-hidden />
            <h1 id="done-title" className="mt-3 text-2xl font-semibold tracking-tight">
              {t("done.title")}
            </h1>
            <p className="mt-2 text-muted-foreground">
              {t("done.description", {
                fileName: translate.data.file_name,
                source: languageName(translate.data.source_language),
                target: languageName(translate.data.target_language),
              })}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <ChoiceCard
              href={getDownloadHref(translate.data.document_id)}
              icon={Download}
              title={t("done.download")}
              description={t("done.downloadDescription", {
                type: translate.data.document_type.toUpperCase(),
              })}
            />
            <ChoiceCard
              href={`/translate/${translate.data.document_id}/edit`}
              icon={PencilLine}
              title={t("done.edit")}
              description={t("done.editDescription")}
              internal
            />
          </div>

          <Button variant="ghost" className="self-center" onClick={startOver}>
            <RotateCcw aria-hidden />
            {t("done.another")}
          </Button>
        </section>
      )}
    </div>
  );
}

function StepIndicator({ current }: { current: Step }) {
  const { t } = useTranslation("translator");
  const currentIndex = STEPS.findIndex((s) => s.id === current);

  return (
    <nav aria-label={t("steps.label")}>
      <ol className="flex items-center gap-2 text-xs font-medium sm:text-sm">
        {STEPS.map((s, index) => {
          const complete = index < currentIndex || current === "done";
          const active = index === currentIndex;
          return (
            <li key={s.id} className="flex flex-1 items-center gap-2">
              <span
                aria-current={active ? "step" : undefined}
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-full border text-[11px]",
                  complete && "border-brand bg-brand text-primary-foreground",
                  active && !complete && "border-brand text-brand",
                  !active && !complete && "text-muted-foreground",
                )}
              >
                {complete ? <Check className="size-3.5" aria-hidden /> : index + 1}
              </span>
              <span
                className={cn(
                  "hidden sm:inline",
                  active || complete ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {t(s.label)}
              </span>
              {index < STEPS.length - 1 && (
                <span aria-hidden className="h-px flex-1 bg-border" />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function UploadStep({
  onSelect,
  error,
}: {
  onSelect: (file: File | undefined) => void;
  error: string | null;
}) {
  const { t } = useTranslation("translator");
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    onSelect(event.dataTransfer.files[0]);
  }

  return (
    <section aria-labelledby="upload-title" className="flex flex-col gap-6">
      <div>
        <h1 id="upload-title" className="text-2xl font-semibold tracking-tight">
          {t("upload.title")}
        </h1>
        <p className="mt-2 text-muted-foreground">{t("upload.description")}</p>
      </div>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "flex flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-14 text-center transition-colors",
          dragging ? "border-brand bg-brand-soft/40" : "border-border bg-card",
        )}
      >
        <span className="grid size-12 place-items-center rounded-full bg-brand-soft text-brand">
          <Upload className="size-5" aria-hidden />
        </span>
        <Button
          size="lg"
          className="mt-2 h-11 rounded-lg px-6 text-base"
          onClick={() => inputRef.current?.click()}
        >
          {t("upload.pick")}
        </Button>
        <p className="text-sm text-muted-foreground">{t("upload.drop")}</p>
        <p className="text-xs text-muted-foreground">
          {t("upload.hint", { size: MAX_FILE_SIZE_MB })}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_ATTRIBUTE}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(event) => {
            onSelect(event.target.files?.[0]);
            // Let the same file be picked again after an error.
            event.target.value = "";
          }}
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}

function FileChip({ file, children }: { file: File; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
        <FileText className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{file.name}</p>
        <p className="text-xs text-muted-foreground">
          {getFileExtension(file.name).toUpperCase()} · {formatFileSize(file.size)}
        </p>
      </div>
      {children}
    </div>
  );
}

function LanguageSelect({
  label,
  value,
  onChange,
  languageName,
}: {
  label: string;
  value: LanguageCode;
  onChange: (value: LanguageCode) => void;
  languageName: (code: LanguageCode) => string;
}) {
  const id = useId();

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value as LanguageCode)}
        className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {LANGUAGE_CODES.map((code) => (
          <option key={code} value={code}>
            {languageName(code)}
          </option>
        ))}
      </select>
    </div>
  );
}

function ChoiceCard({
  href,
  icon: Icon,
  title,
  description,
  internal = false,
}: {
  href: string;
  icon: typeof Download;
  title: string;
  description: string;
  internal?: boolean;
}) {
  const className =
    "group flex flex-col gap-3 rounded-xl border bg-card p-5 text-left transition-colors hover:border-brand/50 hover:bg-brand-soft/20 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";
  const content = (
    <>
      <span className="grid size-10 place-items-center rounded-lg bg-brand text-primary-foreground">
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="text-base font-semibold">{title}</span>
      <span className="text-sm text-muted-foreground">{description}</span>
    </>
  );

  return internal ? (
    <Link href={href} className={className}>
      {content}
    </Link>
  ) : (
    <a href={href} download className={className}>
      {content}
    </a>
  );
}
