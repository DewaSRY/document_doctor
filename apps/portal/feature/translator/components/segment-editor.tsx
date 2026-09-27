"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import Document from "@tiptap/extension-document";
import Text from "@tiptap/extension-text";
import { UndoRedo } from "@tiptap/extensions";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import {
  AlertCircle,
  ArrowLeft,
  Columns2,
  Download,
  Loader2,
  Redo2,
  Save,
  Undo2,
} from "lucide-react";

import { Link } from "@/i18n/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import ErrorState from "@/components/ui/error-state";
import { cn } from "@/lib/utils";

import { getDownloadHref } from "../constants";
import { useDocumentSegments, useUpdateDocumentSegments } from "../hooks/query";
import type { DocumentSegments, UpdateSegmentsBody } from "../type";
import { getTranslatorErrorStatus } from "../utils";
import { Segment, readSegmentTexts, segmentsToContent } from "./segment-extension";

type SegmentEdits = UpdateSegmentsBody["segments"];

function changedSegments(
  doc: ProseMirrorNode,
  saved: Map<string, string>,
): SegmentEdits {
  return [...readSegmentTexts(doc)]
    .filter(([key, text]) => saved.get(key) !== text)
    .map(([key, translated_text]) => ({ key, translated_text }));
}

export function SegmentEditor({ documentId }: { documentId: string }) {
  const { t } = useTranslation("translator");
  const segments = useDocumentSegments(documentId);

  if (segments.isPending) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 py-24 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" aria-hidden />
        {t("editor.loading")}
      </div>
    );
  }

  if (segments.isError) {
    const notFound = getTranslatorErrorStatus(segments.error) === 404;
    return (
      <div className="flex flex-1 flex-col items-center py-16">
        <ErrorState
          icon={AlertCircle}
          title={t(notFound ? "editor.notFoundTitle" : "editor.loadErrorTitle")}
          description={t(
            notFound ? "editor.notFoundDescription" : "editor.loadErrorDescription",
          )}
          className="max-w-md flex-none"
        />
        {notFound ? (
          <Link href="/translate" className={cn(buttonVariants(), "h-9 rounded-lg")}>
            {t("editor.translateAgain")}
          </Link>
        ) : (
          <Button className="h-9 rounded-lg" onClick={() => segments.refetch()}>
            {t("error.retry")}
          </Button>
        )}
      </div>
    );
  }

  return <LoadedEditor key={segments.data.document_id} document={segments.data} />;
}

function LoadedEditor({ document }: { document: DocumentSegments }) {
  const { t } = useTranslation("translator");
  const update = useUpdateDocumentSegments(document.document_id);
  const downloadHref = getDownloadHref(document.document_id);

  // Translations as last saved on the service; edits are diffed against it.
  const saved = useRef(
    new Map(document.segments.map((s) => [s.key, s.translated_text])),
  );
  const [changes, setChanges] = useState<SegmentEdits>([]);
  const [showSource, setShowSource] = useState(true);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      Document.extend({ content: "segment+" }),
      Text,
      Segment,
      UndoRedo,
    ],
    content: segmentsToContent(document.segments),
    editorProps: {
      attributes: {
        class: "outline-none",
        "aria-label": t("editor.translation"),
      },
    },
    onUpdate: ({ editor }) =>
      setChanges(changedSegments(editor.state.doc, saved.current)),
  });

  const history = useEditorState({
    editor,
    selector: ({ editor }) => ({
      canUndo: editor?.can().undo() ?? false,
      canRedo: editor?.can().redo() ?? false,
    }),
  });

  const hasChanges = changes.length > 0;

  useEffect(() => {
    if (!hasChanges) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasChanges]);

  async function save() {
    if (!editor || !hasChanges) return;
    const sent = changes;
    await update.mutateAsync({ segments: sent });
    for (const { key, translated_text } of sent) {
      saved.current.set(key, translated_text);
    }
    // The user may have kept typing while the request was in flight.
    setChanges(changedSegments(editor.state.doc, saved.current));
  }

  async function saveAndDownload() {
    try {
      await save();
      window.location.assign(downloadHref);
    } catch {
      // update.isError shows the message.
    }
  }

  const languagePair = t("editor.languagePair", {
    source: t(`languages.${document.source_language}`),
    target: t(`languages.${document.target_language}`),
  });

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href="/translate"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {t("editor.back")}
          </Link>
          <h1 className="mt-1 truncate text-xl font-semibold tracking-tight">
            {document.file_name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {languagePair} · {document.document_type.toUpperCase()}
          </p>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">{t("editor.help")}</p>

      <div className="sticky top-16 z-30 flex flex-wrap items-center gap-2 rounded-lg border bg-background/95 p-2 backdrop-blur">
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("editor.undo")}
          disabled={!history?.canUndo}
          onClick={() => editor?.chain().focus().undo().run()}
        >
          <Undo2 aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("editor.redo")}
          disabled={!history?.canRedo}
          onClick={() => editor?.chain().focus().redo().run()}
        >
          <Redo2 aria-hidden />
        </Button>
        <Button
          variant="ghost"
          aria-pressed={showSource}
          onClick={() => setShowSource((value) => !value)}
        >
          <Columns2 aria-hidden />
          {t(showSource ? "editor.hideOriginal" : "editor.showOriginal")}
        </Button>

        <span
          aria-live="polite"
          className="ml-auto px-2 text-xs text-muted-foreground"
        >
          {hasChanges
            ? t("editor.unsaved", { count: changes.length })
            : t("editor.saved")}
        </span>

        <Button
          variant="outline"
          disabled={!hasChanges || update.isPending}
          onClick={() => save().catch(() => {})}
        >
          {update.isPending ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : (
            <Save aria-hidden />
          )}
          {update.isPending ? t("editor.saving") : t("editor.save")}
        </Button>
        {hasChanges ? (
          <Button disabled={update.isPending} onClick={saveAndDownload}>
            <Download aria-hidden />
            {t("editor.saveAndDownload")}
          </Button>
        ) : (
          <a href={downloadHref} download className={buttonVariants()}>
            <Download aria-hidden />
            {t("editor.download")}
          </a>
        )}
      </div>

      {update.isError && (
        <p role="alert" className="text-sm text-destructive">
          {t("editor.saveError")}
        </p>
      )}

      <div
        data-show-source={showSource}
        className="group/editor overflow-hidden rounded-xl border bg-card"
      >
        <div
          aria-hidden
          className="hidden border-b bg-muted/50 px-4 py-2 text-xs font-medium tracking-wide text-muted-foreground uppercase group-data-[show-source=true]/editor:md:grid md:grid-cols-2 md:gap-x-6 sm:px-6"
        >
          <span>{t("editor.original")}</span>
          <span>{t("editor.translation")}</span>
        </div>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
