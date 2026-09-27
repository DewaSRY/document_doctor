"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { EditorContent, useEditor } from "@tiptap/react";
import Document from "@tiptap/extension-document";
import Text from "@tiptap/extension-text";
import { UndoRedo } from "@tiptap/extensions";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Download,
  FileText,
  Info,
  Languages,
  Loader2,
  Save,
} from "lucide-react";

import { Link } from "@/i18n/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import ErrorState from "@/components/ui/error-state";
import { cn } from "@/lib/utils";

import { getDownloadHref } from "../constants";
import {
  useDocumentLayout,
  useDocumentSegments,
  useUpdateDocumentSegments,
} from "../hooks/query";
import type {
  DocumentLayout,
  DocumentSegments,
  PageLayout,
  UpdateSegmentsBody,
} from "../type";
import { getTranslatorErrorStatus } from "../utils";
import { EditorToolbar, MAX_ZOOM, MIN_ZOOM } from "./editor-toolbar";
import { FindBar } from "./find-bar";
import { FitStore, PdfViewContext, type PdfViewSettings } from "./pdf-view-context";
import { Search } from "./search-extension";
import {
  Page,
  Segment,
  readSegments,
  sameStyle,
  segmentsToContent,
  type SegmentValue,
} from "./segment-extension";
import { PX_PER_PT } from "./segment-style";

type SegmentEdits = UpdateSegmentsBody["segments"];

function changedSegments(
  doc: ProseMirrorNode,
  saved: Map<string, SegmentValue>,
): SegmentEdits {
  return [...readSegments(doc)]
    .filter(([key, value]) => {
      const before = saved.get(key);
      return !before || before.text !== value.text || !sameStyle(before.style, value.style);
    })
    .map(([key, value]) => ({ key, translated_text: value.text, style: value.style }));
}

/** Room around the pages in the PDF canvas, in px (both sides). */
const CANVAS_PADDING = 64;
const COMPARE_GAP = 24;

/** The zoom (in %) at which the widest page, or two side by side, fills `width` px. */
function fitPercent(pages: PageLayout[], width: number, sideBySide: boolean): number {
  const widest = Math.max(...pages.map((page) => page.width));
  const columns = sideBySide ? 2 : 1;
  const available = width - CANVAS_PADDING - (sideBySide ? COMPARE_GAP : 0);
  return Math.floor((available / (widest * PX_PER_PT * columns)) * 100);
}

export function SegmentEditor({ documentId }: { documentId: string }) {
  const { t } = useTranslation("translator");
  const segments = useDocumentSegments(documentId);
  const isPdf = segments.data?.document_type === "pdf";
  // Without a layout (it failed to load) a PDF is edited as blocks, like a DOCX.
  const layout = useDocumentLayout(documentId, isPdf);

  if (segments.isPending || (isPdf && layout.isPending)) {
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

  return (
    <LoadedEditor
      key={segments.data.document_id}
      document={segments.data}
      layout={isPdf ? layout.data : undefined}
    />
  );
}

function LoadedEditor({
  document,
  layout,
}: {
  document: DocumentSegments;
  layout?: DocumentLayout;
}) {
  const { t } = useTranslation("translator");
  const update = useUpdateDocumentSegments(document.document_id);
  const downloadHref = getDownloadHref(document.document_id);

  const content = useMemo(
    () => segmentsToContent(document.segments, layout?.pages),
    [document.segments, layout],
  );
  const paged = content.content?.[0]?.type === "page";
  const pages = paged ? layout!.pages : [];

  // Translations and styles as last saved on the service; edits are diffed against it.
  const saved = useRef(
    new Map<string, SegmentValue>(
      document.segments.map((s) => [s.key, { text: s.translated_text, style: s.style ?? null }]),
    ),
  );
  const [changes, setChanges] = useState<SegmentEdits>([]);
  const [findOpen, setFindOpen] = useState(false);

  // Open at the printed size, or smaller when the page is wider than the screen.
  const [zoomPercent, setZoomPercentState] = useState(() =>
    paged
      ? Math.max(MIN_ZOOM, Math.min(100, fitPercent(pages, window.innerWidth, false)))
      : 100,
  );
  const [compare, setCompare] = useState(false);
  const [showBoxes, setShowBoxes] = useState(false);
  const [showSource, setShowSource] = useState(false);
  const [fits] = useState(() => new FitStore());
  const [pixelRatio] = useState(() => window.devicePixelRatio || 1);
  const canvasRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      Document.extend({ content: paged ? "page+" : "segment+" }),
      Text,
      Page,
      Segment,
      UndoRedo,
      Search,
    ],
    content,
    editorProps: {
      attributes: {
        class: paged
          ? "mx-auto flex w-max min-w-full flex-col items-center gap-12 outline-none"
          : "outline-none",
        "aria-label": t("editor.translation"),
      },
    },
    onUpdate: ({ editor }) =>
      setChanges(changedSegments(editor.state.doc, saved.current)),
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
    for (const { key, translated_text, style } of sent) {
      saved.current.set(key, { text: translated_text, style: style ?? null });
    }
    // The user may have kept typing while the request was in flight.
    setChanges(changedSegments(editor.state.doc, saved.current));
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === "s") {
        event.preventDefault();
        if (!update.isPending) save().catch(() => {});
      } else if (key === "f") {
        event.preventDefault();
        setFindOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  async function saveAndDownload() {
    try {
      await save();
      window.location.assign(downloadHref);
    } catch {
      // update.isError shows the message.
    }
  }

  function setZoomPercent(percent: number) {
    setZoomPercentState(Math.round(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, percent))));
  }

  function fitWidthPercent(sideBySide: boolean): number {
    return fitPercent(pages, canvasRef.current?.clientWidth ?? window.innerWidth, sideBySide);
  }

  function goToPage(page: number) {
    canvasRef.current
      ?.querySelector(`[data-page="${page}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const zoom = (zoomPercent / 100) * PX_PER_PT;
  const pdfView: PdfViewSettings = {
    documentId: document.document_id,
    pageCount: pages.length,
    zoom,
    imageScale: Math.min(4, Math.max(1, Math.ceil(zoom * pixelRatio))),
    compare,
    showBoxes,
    showSource,
    fits,
  };

  const languagePair = t("editor.languagePair", {
    source: t(`languages.${document.source_language}`),
    target: t(`languages.${document.target_language}`),
  });

  return (
    <div className="flex w-full flex-1 flex-col">
      <div className="sticky top-16 z-30">
        <div className="flex h-11 items-center gap-1 border-b border-border/60 bg-background/95 px-3 backdrop-blur sm:px-4">
          <nav className="flex min-w-0 items-center gap-1 text-sm">
            <Link
              href="/translate"
              className="inline-flex shrink-0 items-center gap-1 rounded-xs px-1.5 py-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ArrowLeft className="size-4" aria-hidden />
              {t("editor.back")}
            </Link>
            <span aria-hidden className="text-muted-foreground/50">/</span>
            <span className="truncate px-1.5 font-medium">{document.file_name}</span>
            {paged && (
              <span className="hidden shrink-0 text-xs text-muted-foreground lg:inline">
                {languagePair}
              </span>
            )}
          </nav>

          <span
            aria-live="polite"
            className="ml-auto hidden shrink-0 items-center gap-1.5 px-2 text-xs text-muted-foreground sm:inline-flex"
          >
            {update.isPending ? (
              <Loader2 className="size-3 animate-spin" aria-hidden />
            ) : hasChanges ? (
              <span className="size-1.5 rounded-full bg-amber-500" aria-hidden />
            ) : (
              <Check className="size-3" aria-hidden />
            )}
            {update.isPending
              ? t("editor.saving")
              : hasChanges
                ? t("editor.unsaved", { count: changes.length })
                : t("editor.saved")}
          </span>

          <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:ml-0">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("editor.save")}
              title={t("editor.saveShortcut")}
              disabled={!hasChanges || update.isPending}
              onClick={() => save().catch(() => {})}
            >
              <Save aria-hidden />
            </Button>
            <span aria-hidden className="mx-1 h-4 w-px bg-border" />
            {hasChanges ? (
              <Button size="sm" disabled={update.isPending} onClick={saveAndDownload}>
                <Download aria-hidden />
                {t("editor.saveAndDownload")}
              </Button>
            ) : (
              <a href={downloadHref} download className={buttonVariants({ size: "sm" })}>
                <Download aria-hidden />
                {t("editor.download")}
              </a>
            )}
          </div>
        </div>

        <EditorToolbar
          editor={editor}
          findOpen={findOpen}
          onToggleFind={() => setFindOpen((open) => !open)}
          pdf={
            paged
              ? {
                  zoomPercent,
                  setZoomPercent,
                  fitWidth: () => setZoomPercent(fitWidthPercent(compare)),
                  compare,
                  setCompare: (value) => {
                    setCompare(value);
                    // Keep both pages on screen when they no longer fit.
                    if (value) setZoomPercent(Math.min(zoomPercent, fitWidthPercent(true)));
                  },
                  showBoxes,
                  setShowBoxes,
                  showSource,
                  setShowSource,
                  pageCount: pages.length,
                  goToPage,
                  fits,
                }
              : undefined
          }
        >
          {findOpen && editor && (
            <FindBar editor={editor} onClose={() => setFindOpen(false)} />
          )}
        </EditorToolbar>

        {update.isError && (
          <p
            role="alert"
            className="border-b border-destructive/20 bg-destructive/5 px-4 py-1.5 text-sm text-destructive"
          >
            {t("editor.saveError")}
          </p>
        )}
      </div>

      {paged ? (
        <PdfViewContext.Provider value={pdfView}>
          <div
            ref={canvasRef}
            className="flex-1 overflow-x-auto bg-muted/60 px-8 py-10 dark:bg-muted/30"
          >
            <EditorContent editor={editor} />
          </div>
        </PdfViewContext.Provider>
      ) : (
        <article className="mx-auto w-full max-w-3xl px-10 pt-12 pb-32 sm:px-16">
          <h1 className="text-3xl font-bold tracking-tight break-words sm:text-4xl">
            {document.file_name}
          </h1>

          <dl className="mt-5 grid grid-cols-[8rem_1fr] gap-y-1.5 text-sm">
            <dt className="flex items-center gap-2 text-muted-foreground">
              <Languages className="size-4" aria-hidden />
              {t("editor.languages")}
            </dt>
            <dd>{languagePair}</dd>
            <dt className="flex items-center gap-2 text-muted-foreground">
              <FileText className="size-4" aria-hidden />
              {t("editor.fileType")}
            </dt>
            <dd>{document.document_type.toUpperCase()}</dd>
          </dl>

          <p className="mt-5 flex gap-2 rounded-sm bg-muted/50 px-3 py-2.5 text-sm text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            {t("editor.help")}
          </p>

          <div className="mt-6 border-t border-border/60 pt-6">
            <EditorContent editor={editor} />
          </div>
        </article>
      )}
    </div>
  );
}
