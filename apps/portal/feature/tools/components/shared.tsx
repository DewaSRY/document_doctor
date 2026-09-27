"use client";

import { useEffect, useId, useRef, useState, type DragEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  RotateCcw,
  Upload,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { getFileExtension } from "../constants";
import { formatFileSize, getToolErrorMessage, saveBlob } from "../utils";

/** Checks a picked file against a tool's rules; returns an error text or null. */
export function useFileValidator({
  extensions,
  maxSize,
  typeError,
}: {
  extensions: readonly string[];
  maxSize: number;
  typeError: string;
}) {
  const { t } = useTranslation("tools");

  return (file: File): string | null => {
    if (!extensions.includes(getFileExtension(file.name))) return typeError;
    if (file.size > maxSize) {
      return t("common.tooLarge", { name: file.name, size: maxSize / 1024 / 1024 });
    }
    if (file.size === 0) return t("common.empty", { name: file.name });
    return null;
  };
}

export function ToolIntro({
  icon: Icon,
  category,
  title,
  description,
}: {
  icon: LucideIcon;
  category: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-brand text-primary-foreground">
        <Icon className="size-5" aria-hidden />
      </span>
      <div>
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {category}
        </p>
        <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

export function FileDropzone({
  accept,
  hint,
  multiple = false,
  compact = false,
  onFiles,
}: {
  accept: string;
  hint: string;
  multiple?: boolean;
  compact?: boolean;
  onFiles: (files: File[]) => void;
}) {
  const { t } = useTranslation("tools");
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    const files = [...event.dataTransfer.files];
    onFiles(multiple ? files : files.slice(0, 1));
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={cn(
        "flex flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 text-center transition-colors",
        compact ? "py-6" : "py-14",
        dragging ? "border-brand bg-brand-soft/40" : "border-border bg-card",
      )}
    >
      {!compact && (
        <span className="grid size-12 place-items-center rounded-full bg-brand-soft text-brand">
          <Upload className="size-5" aria-hidden />
        </span>
      )}
      <Button
        size="lg"
        variant={compact ? "outline" : "default"}
        className={cn("rounded-lg px-6", !compact && "mt-2 h-11 text-base")}
        onClick={() => inputRef.current?.click()}
      >
        {compact && <Upload aria-hidden />}
        {multiple ? t("common.pickMany") : t("common.pick")}
      </Button>
      <p className="text-sm text-muted-foreground">
        {multiple ? t("common.dropMany") : t("common.drop")}
      </p>
      <p className="text-xs text-muted-foreground">{hint}</p>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          onFiles([...(event.target.files ?? [])]);
          // Let the same file be picked again after an error.
          event.target.value = "";
        }}
      />
    </div>
  );
}

export function FileChip({
  file,
  icon: Icon = FileText,
  children,
}: {
  file: File;
  icon?: LucideIcon;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-5" aria-hidden />
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

/** Read-only look at a picked PDF or DOCX, so the user can check it's the right file. */
export function DocumentPreview({ file }: { file: File }) {
  const { t } = useTranslation("tools");
  const isPdf = getFileExtension(file.name) === "pdf";
  const containerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [status, setStatus] = useState<{ file: File; failed: boolean } | null>(null);

  useEffect(() => {
    const frame = frameRef.current;
    if (!isPdf || !frame) return;
    const url = URL.createObjectURL(file);
    frame.src = `${url}#view=FitH`;
    return () => URL.revokeObjectURL(url);
  }, [file, isPdf]);

  useEffect(() => {
    const container = containerRef.current;
    if (isPdf || !container) return;
    let active = true;
    container.replaceChildren();
    // Loaded on demand: only DOCX previews need it.
    import("docx-preview")
      .then(({ renderAsync }) =>
        renderAsync(file, container, undefined, {
          className: "docx-preview",
          inWrapper: true,
          ignoreLastRenderedPageBreak: false,
        }),
      )
      .then(
        () => active && setStatus({ file, failed: false }),
        () => active && setStatus({ file, failed: true }),
      );
    return () => {
      active = false;
    };
  }, [file, isPdf]);

  const label = t("common.previewAlt", { name: file.name });
  // A state left over from an earlier file is never used for the current one.
  const current = status?.file === file ? status : null;

  if (isPdf) {
    return (
      <iframe ref={frameRef} title={label} className="h-[32rem] w-full rounded-lg border bg-muted" />
    );
  }

  return (
    <div className="relative h-[32rem] overflow-auto rounded-lg border bg-muted">
      {!current && (
        <div className="absolute inset-0 grid place-items-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
        </div>
      )}
      {current?.failed && (
        <p className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-muted-foreground">
          {t("common.previewError")}
        </p>
      )}
      <div ref={containerRef} role="document" aria-label={label} />
    </div>
  );
}

export function FieldError({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      {children}
    </p>
  );
}

export function ErrorAlert({ title, error }: { title: string; error: unknown }) {
  const { t } = useTranslation("tools");

  return (
    <div
      role="alert"
      className="flex gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
      <div>
        <p className="font-medium">{title}</p>
        <p className="mt-1 text-muted-foreground">
          {getToolErrorMessage(error) ?? t("common.errorDescription")}
        </p>
      </div>
    </div>
  );
}

export function Processing({ title, description }: { title: string; description: string }) {
  return (
    <section
      aria-live="polite"
      className="flex flex-col items-center gap-4 rounded-xl border bg-card px-6 py-14 text-center"
    >
      <Loader2 className="size-10 animate-spin text-brand" aria-hidden />
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <p className="max-w-md text-muted-foreground">{description}</p>
    </section>
  );
}

/** Success state of a file tool: what was made, a download button, extras. */
export function FileResult({
  blob,
  fileName,
  title,
  description,
  onReset,
  resetLabel,
  children,
}: {
  blob: Blob;
  fileName: string;
  title: string;
  description?: string;
  onReset: () => void;
  resetLabel: string;
  children?: ReactNode;
}) {
  const { t } = useTranslation("tools");

  return (
    <section aria-live="polite" className="flex flex-col gap-6">
      <div className="flex flex-col items-center text-center">
        <CheckCircle2 className="size-10 text-brand" aria-hidden />
        <h2 className="mt-3 text-2xl font-semibold tracking-tight">{title}</h2>
        {description && <p className="mt-2 text-muted-foreground">{description}</p>}
      </div>

      {children}

      <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
          <FileText className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{fileName}</p>
          <p className="text-xs text-muted-foreground">{formatFileSize(blob.size)}</p>
        </div>
        <Button className="h-9 rounded-lg px-4" onClick={() => saveBlob(blob, fileName)}>
          <Download aria-hidden />
          {t("common.download")}
        </Button>
      </div>

      <Button variant="ghost" className="self-center" onClick={onReset}>
        <RotateCcw aria-hidden />
        {resetLabel}
      </Button>
    </section>
  );
}

export function SubmitButton({
  onClick,
  disabled,
  retry,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  retry?: boolean;
  children: ReactNode;
}) {
  const { t } = useTranslation("tools");

  return (
    <Button
      size="lg"
      className="h-11 rounded-lg text-base sm:self-start"
      disabled={disabled}
      onClick={onClick}
    >
      {retry && <RotateCcw aria-hidden />}
      {retry ? t("common.retry") : children}
    </Button>
  );
}

/** A small single-choice button group (radio semantics). */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; description?: string }[];
  onChange: (value: T) => void;
}) {
  const id = useId();

  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend id={id} className="mb-1.5 text-sm font-medium">
        {label}
      </legend>
      <div role="radiogroup" aria-labelledby={id} className="grid gap-2 sm:grid-flow-col sm:auto-cols-fr">
        {options.map((option) => {
          const checked = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={checked}
              onClick={() => onChange(option.value)}
              className={cn(
                "flex flex-col rounded-lg border px-3 py-2 text-left text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                checked
                  ? "border-brand bg-brand-soft/40 text-foreground"
                  : "bg-background text-muted-foreground hover:border-brand/40 hover:text-foreground",
              )}
            >
              <span className="font-medium">{option.label}</span>
              {option.description && (
                <span className="mt-0.5 text-xs text-muted-foreground">{option.description}</span>
              )}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
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
        onChange={(event) => onChange(event.target.value as T)}
        className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  suffix,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  suffix?: string;
  placeholder?: string;
}) {
  const id = useId();

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="flex h-10 items-center rounded-lg border border-input bg-background focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className="h-full w-full min-w-0 bg-transparent px-3 text-sm outline-none"
        />
        {suffix && <span className="pr-3 text-xs text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}
