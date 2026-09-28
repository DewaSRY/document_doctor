"use client";

import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  ArrowLeftRight,
  Check,
  CheckCircle2,
  Download,
  Loader2,
  PencilLine,
  RotateCcw,
} from "lucide-react";

import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  FieldError,
  FileDropzone,
  SelectField,
  useFileValidator,
} from "@/components/file-tools";
import { FileChip } from "@/components/file-chip";
import { useLeaveGuard } from "@/components/leave-guard";
import { zodResolverTranslate } from "@/lib/form";
import { cn } from "@/lib/utils";

import {
  ACCEPT_ATTRIBUTE,
  LANGUAGE_CODES,
  MAX_FILE_SIZE,
  getDownloadHref,
  type LanguageCode,
} from "../constants";
import { useTranslateDocument } from "../hooks/query";
import {
  translateFileSchema,
  translateSchema,
  type TranslateOutput,
  type TranslateValues,
} from "../schema";
import { getTranslatorErrorMessage } from "../utils";

type Step = "upload" | "languages" | "translating" | "done";

const STEPS: { id: Step; label: string }[] = [
  { id: "upload", label: "steps.upload" },
  { id: "languages", label: "steps.languages" },
  { id: "translating", label: "steps.translate" },
  { id: "done", label: "steps.done" },
];

const MAX_FILE_SIZE_MB = MAX_FILE_SIZE / 1024 / 1024;

export function TranslateWizard() {
  const { t } = useTranslation("translator");
  const translate = useTranslateDocument();
  const validate = useFileValidator(translateFileSchema, "translator");

  const form = useForm<TranslateValues, unknown, TranslateOutput>({
    resolver: zodResolverTranslate(translateSchema, t),
    defaultValues: { file: null, sourceLanguage: "id", targetLanguage: "en" },
    mode: "onChange",
  });
  useLeaveGuard(form.formState.isDirty && !translate.isSuccess);
  const [file, sourceLanguage, targetLanguage] = useWatch({
    control: form.control,
    name: ["file", "sourceLanguage", "targetLanguage"],
  });
  const { errors } = form.formState;

  const step: Step = translate.isSuccess
    ? "done"
    : translate.isPending
      ? "translating"
      : file
        ? "languages"
        : "upload";

  const languageName = (code: LanguageCode) => t(`languages.${code}`);
  const languageOptions = LANGUAGE_CODES.map((code) => ({
    value: code,
    label: languageName(code),
  }));

  function selectFile(selected: File | undefined) {
    if (!selected) return;
    const error = validate(selected);
    if (error) return form.setError("file", { message: error });
    form.clearErrors("file");
    form.setValue("file", selected, { shouldDirty: true });
  }

  /** The languages are checked together: they must differ. */
  function setLanguages(languages: { sourceLanguage?: LanguageCode; targetLanguage?: LanguageCode }) {
    if (languages.sourceLanguage) form.setValue("sourceLanguage", languages.sourceLanguage);
    if (languages.targetLanguage) form.setValue("targetLanguage", languages.targetLanguage);
    void form.trigger(["sourceLanguage", "targetLanguage"]);
  }

  function startOver() {
    translate.reset();
    // Keep the chosen languages for the next document.
    form.reset({ ...form.getValues(), file: null });
  }

  function submit(values: TranslateOutput) {
    translate.mutate(values);
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 pt-6 pb-12 sm:pt-8 sm:pb-16">
      <StepIndicator current={step} />

      {step === "upload" && (
        <UploadStep onSelect={selectFile} error={errors.file?.message} />
      )}

      {step === "languages" && file && (
        <form
          noValidate
          aria-labelledby="languages-title"
          onSubmit={form.handleSubmit(submit)}
          className="flex flex-col gap-6"
        >
          <div>
            <h1 id="languages-title" className="text-2xl font-semibold tracking-tight">
              {t("languageStep.title")}
            </h1>
            <p className="mt-2 text-muted-foreground">
              {t("languageStep.description")}
            </p>
          </div>

          <FileChip file={file} preview defaultPreviewOpen>
            <Button variant="ghost" size="sm" onClick={startOver}>
              {t("languageStep.changeFile")}
            </Button>
          </FileChip>

          <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
            <Controller
              control={form.control}
              name="sourceLanguage"
              render={({ field }) => (
                <SelectField
                  label={t("languageStep.source")}
                  value={field.value}
                  options={languageOptions}
                  onChange={(value) => setLanguages({ sourceLanguage: value })}
                />
              )}
            />
            <Button
              variant="outline"
              size="icon-lg"
              className="justify-self-center rounded-lg"
              aria-label={t("languageStep.swap")}
              onClick={() =>
                setLanguages({ sourceLanguage: targetLanguage, targetLanguage: sourceLanguage })
              }
            >
              <ArrowLeftRight aria-hidden />
            </Button>
            <Controller
              control={form.control}
              name="targetLanguage"
              render={({ field }) => (
                <SelectField
                  label={t("languageStep.target")}
                  value={field.value}
                  options={languageOptions}
                  onChange={(value) => setLanguages({ targetLanguage: value })}
                />
              )}
            />
          </div>

          <FieldError>{errors.targetLanguage?.message}</FieldError>

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
            type="submit"
            size="lg"
            className="h-11 rounded-lg text-base sm:self-start"
            disabled={!!errors.targetLanguage}
          >
            {translate.isError && <RotateCcw aria-hidden />}
            {translate.isError ? t("error.retry") : t("languageStep.submit")}
          </Button>
        </form>
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
  error?: string;
}) {
  const { t } = useTranslation("translator");

  return (
    <section aria-labelledby="upload-title" className="flex flex-col gap-6">
      <div>
        <h1 id="upload-title" className="text-2xl font-semibold tracking-tight">
          {t("upload.title")}
        </h1>
        <p className="mt-2 text-muted-foreground">{t("upload.description")}</p>
      </div>

      <FileDropzone
        accept={ACCEPT_ATTRIBUTE}
        hint={t("upload.hint", { size: MAX_FILE_SIZE_MB })}
        pickLabel={t("upload.pick")}
        dropLabel={t("upload.drop")}
        onFiles={(files) => onSelect(files[0])}
      />

      <FieldError>{error}</FieldError>
    </section>
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
