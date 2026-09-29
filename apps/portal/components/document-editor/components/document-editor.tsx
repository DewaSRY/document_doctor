"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import Document from "@tiptap/extension-document";
import Text from "@tiptap/extension-text";
import { Dropcursor, UndoRedo } from "@tiptap/extensions";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Download,
  FileText,
  Info,
  Link2,
  Loader2,
  Printer,
  Save,
  type LucideIcon,
} from "lucide-react";

import { Link, useRouter } from "@/i18n/navigation";
import { useLeaveGuard } from "@/components/leave-guard";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import type {
  DocumentLayout,
  DocxLayout,
  EditorDocument,
  InsertedBlock,
  InsertedTextKind,
  PdfLayout,
  SegmentEdit,
  UploadedImage,
} from "../type";
import { BlockHandle } from "./block-handle";
import { BubbleToolbar, TableToolbar } from "./bubble-toolbar";
import { DocxCanvas } from "./docx-canvas";
import { docxToContent, type DocxSetup } from "./docx-content";
import { docxExtensions } from "./docx-extension";
import { PaginationStore } from "./docx-pagination";
import type { DocxStyles } from "./docx-style";
import {
  DocShortcuts,
  activeFormat,
  editorActions,
  type EditorMode,
} from "./editor-commands";
import {
  EditorToolbar,
  MAX_ZOOM,
  MIN_ZOOM,
  type ZoomControls,
} from "./editor-toolbar";
import { FindBar } from "./find-bar";
import { FORMAT_MARKS, sameRuns } from "./format-marks";
import { countInsertionChanges, readInsertions } from "./insert-content";
import {
  HEADING_KINDS,
  IMAGE_TYPES,
  insertExtensions,
  insertImages,
  Latest,
  SlashKeys,
} from "./insert-extension";
import { MenuBar } from "./menu-bar";
import {
  FitStore,
  PdfViewContext,
  type PageImageHref,
  type PdfViewSettings,
} from "./pdf-view-context";
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
import { SlashMenu } from "./slash-menu";
import { StatusBar } from "./status-bar";

function changedSegments(
  doc: ProseMirrorNode,
  saved: Map<string, SegmentValue>,
): SegmentEdit[] {
  return [...readSegments(doc)]
    .filter(([key, value]) => {
      const before = saved.get(key);
      return (
        !before ||
        before.text !== value.text ||
        !sameStyle(before.style, value.style) ||
        !sameRuns(before.runs, value.runs)
      );
    })
    .map(([key, value]) => ({
      key,
      translated_text: value.text,
      style: value.style,
      runs: value.runs,
    }));
}

/** The inserted blocks, one string each, and how many differ from those last saved. */
function insertionKeys(doc: ProseMirrorNode): { blocks: InsertedBlock[]; keys: string[] } {
  const blocks = readInsertions(doc);
  return { blocks, keys: blocks.map((block) => JSON.stringify(block)) };
}

/** Text the reader reads: translations and the paragraphs the user added. */
function isCountedText(node: ProseMirrorNode): boolean {
  return node.type.name === "segment" || node.type.name === "insParagraph";
}

/** Room around the pages in the canvas, in px (both sides). */
const CANVAS_PADDING = 64;
const COMPARE_GAP = 24;

/** The zoom (in %) at which the widest page, or two side by side, fills `width` px. */
function fitPercent(
  pageWidths: number[],
  width: number,
  sideBySide: boolean,
): number {
  const widest = Math.max(...pageWidths);
  const columns = sideBySide ? 2 : 1;
  const available = width - CANVAS_PADDING - (sideBySide ? COMPARE_GAP : 0);
  return Math.floor((available / (widest * PX_PER_PT * columns)) * 100);
}

function countWords(doc: ProseMirrorNode): number {
  const segmenter =
    typeof Intl !== "undefined" && "Segmenter" in Intl
      ? new Intl.Segmenter(undefined, { granularity: "word" })
      : null;
  let words = 0;
  doc.descendants((node) => {
    if (!isCountedText(node)) return true;
    const text = node.textContent;
    if (segmenter) {
      for (const part of segmenter.segment(text)) if (part.isWordLike) words++;
    } else {
      words += text.split(/\s+/).filter(Boolean).length;
    }
    return false;
  });
  return words;
}

function isPdfLayout(layout: DocumentLayout | undefined): layout is PdfLayout {
  return !!layout && "pages" in layout;
}

function isDocxLayout(
  layout: DocumentLayout | undefined,
): layout is DocxLayout {
  return !!layout && "sections" in layout;
}

interface Prepared {
  mode: EditorMode;
  content: ReturnType<typeof segmentsToContent>;
  pageWidths: number[];
  pdfLayout: PdfLayout | null;
  docx: DocxStyles | null;
  setup: DocxSetup | null;
  fonts: string[];
}

function prepare(
  document: EditorDocument,
  layout: DocumentLayout | undefined,
  hrefs: Pick<DocumentEditorProps, "pageImageHref" | "mediaHref">,
): Prepared {
  const empty = {
    pageWidths: [],
    pdfLayout: null,
    docx: null,
    setup: null,
    fonts: [],
  };
  if (
    document.document_type === "pdf" &&
    isPdfLayout(layout) &&
    hrefs.pageImageHref
  ) {
    const content = segmentsToContent(document.segments, layout.pages);
    if (content.content?.[0]?.type === "page") {
      return {
        ...empty,
        mode: "pdf",
        content,
        pageWidths: layout.pages.map((page) => page.width),
        pdfLayout: layout,
      };
    }
  }
  const { mediaHref } = hrefs;
  if (document.document_type === "docx" && isDocxLayout(layout) && mediaHref) {
    const converted = docxToContent(layout, document.segments, document.insertions);
    if (converted) {
      return {
        mode: "docx",
        content: converted.content,
        pageWidths: layout.sections.map((section) => section.page.width),
        pdfLayout: null,
        docx: {
          styles: layout.styles,
          runStyles: layout.run_styles,
          defaultTab: layout.default_tab,
          mediaHref,
        },
        setup: converted.setup,
        fonts: [...new Set(layout.run_styles.map((run) => run.family))],
      };
    }
  }
  return {
    ...empty,
    mode: "blocks",
    content: segmentsToContent(document.segments),
  };
}

export interface DocumentDetail {
  icon: LucideIcon;
  label: string;
  value: string;
}

export interface DocumentEditorProps {
  document: EditorDocument;
  /** Page geometry. Without it (or without the href its format needs) the
   *  document is edited as blocks. The schema is fixed when the editor
   *  mounts: give it a new `key` when the layout arrives. */
  layout?: DocumentLayout;
  /** Stores the edits, and the blocks added to a Word document when they
   *  changed (all of them, in order). The editor keeps them unsaved when it rejects. */
  onSave: (edits: SegmentEdit[], insertions?: InsertedBlock[]) => Promise<unknown>;
  /** Stores an image to add to a Word document; without it images can't be added. */
  onUploadImage?: (file: File) => Promise<UploadedImage>;
  /** The image of a PDF page; needed to edit a PDF on its pages. */
  pageImageHref?: PageImageHref;
  /** An image of a Word document, by its part name; needed to edit a DOCX on pages. */
  mediaHref?: (name: string) => string;
  /** The edited file; without it there is no download. */
  downloadHref?: string;
  /** Where the back button and File › Close lead. */
  backHref: string;
  /** Shown next to the title, e.g. the language pair. */
  badge?: string;
  /** Rows under the title of a document edited as blocks. */
  details?: DocumentDetail[];
  /** Hint shown above a document edited as blocks. */
  help?: ReactNode;
  /** The layout failed to load: offers to try again. */
  layoutFailed?: boolean;
  onRetryLayout?: () => void;
}

/** A Google Docs–like editor of a document's segments: a PDF drawn on its
 *  pages, a DOCX laid out on pages, or, without a layout, plain blocks. A
 *  Word document can also be given new blocks, as in Notion: text, headings,
 *  lists, to-dos, quotes, code, tables, images, dividers and page breaks. */
export function DocumentEditor({
  document,
  layout,
  onSave,
  onUploadImage,
  pageImageHref,
  mediaHref,
  downloadHref,
  backHref,
  badge,
  details = [],
  help,
  layoutFailed = false,
  onRetryLayout,
}: DocumentEditorProps) {
  const { t } = useTranslation("editor");
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  const prepared = useMemo(
    () => prepare(document, layout, { pageImageHref, mediaHref }),
    [document, layout, pageImageHref, mediaHref],
  );
  const { mode, content, docx, setup } = prepared;
  const paged = mode !== "blocks";
  const pages = prepared.pdfLayout?.pages ?? [];

  // Translations, styles and formatting as last saved on the service; edits are diffed against it.
  const saved = useRef(
    new Map<string, SegmentValue>(
      document.segments.map((s) => [
        s.key,
        {
          text: s.translated_text,
          style: s.style ?? null,
          runs: s.runs?.length ? s.runs : null,
        },
      ]),
    ),
  );
  const [changes, setChanges] = useState<SegmentEdit[]>([]);
  // The inserted blocks as last saved, and how many differ now.
  const savedInsertions = useRef<string[]>(
    (document.insertions ?? []).map((block) => JSON.stringify(block)),
  );
  const [insertionChanges, setInsertionChanges] = useState(0);
  const [uploadFailed, setUploadFailed] = useState(false);
  const imageInput = useRef<HTMLInputElement>(null);
  const [uploader] = useState(() => new Latest<[File], Promise<UploadedImage>>());
  useEffect(() => uploader.set(onUploadImage));
  const [slashKeys] = useState(() => new SlashKeys());
  const [findOpen, setFindOpen] = useState(false);
  const [wordCountOpen, setWordCountOpen] = useState(false);
  const [words, setWords] = useState(0);
  const [linkCopied, setLinkCopied] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);

  // Open at the printed size, or smaller when the page is wider than the screen.
  const [zoomPercent, setZoomPercentState] = useState(() =>
    paged
      ? Math.max(
          MIN_ZOOM,
          Math.min(
            100,
            fitPercent(prepared.pageWidths, window.innerWidth, false),
          ),
        )
      : 100,
  );
  const [compare, setCompare] = useState(false);
  const [showBoxes, setShowBoxes] = useState(false);
  const [showSource, setShowSource] = useState(false);
  const [fits] = useState(() => new FitStore());
  const [pagination] = useState(() => new PaginationStore());
  // Keeps the page scaled to fit the viewport (no horizontal overflow) until
  // the user picks a zoom level themselves.
  const autoFit = useRef(paged);
  const [pixelRatio] = useState(() => window.devicePixelRatio || 1);
  const canvasRef = useRef<HTMLDivElement>(null);
  const pagedDocx = useSyncExternalStore(
    pagination.subscribe,
    pagination.get,
    pagination.get,
  );

  const canInsert = mode === "docx" && !!docx && !!setup;
  const [extensions] = useState(() => [
    Document.extend({
      content:
        mode === "pdf"
          ? "page+"
          : mode === "docx"
            ? "docxRegion* (docxBlock | insertedBlock)+"
            : "segment+",
    }),
    Text,
    Page,
    Segment.configure({ docx }),
    ...FORMAT_MARKS,
    UndoRedo,
    Search,
    DocShortcuts.configure({ mode, docx }),
    ...(mode === "docx" && docx && setup
      ? [
          ...docxExtensions(docx, setup, pagination),
          ...insertExtensions({
            docx,
            setup,
            upload: onUploadImage ? uploader.call : null,
            onError: () => setUploadFailed(true),
            placeholder: (kind: InsertedTextKind, focused: boolean) =>
              kind === "normal"
                ? focused
                  ? t("blocks.placeholder")
                  : ""
                : (HEADING_KINDS as string[]).includes(kind)
                  ? t(`headings.${kind}`)
                  : focused
                    ? t(`blocks.placeholders.${kind}`)
                    : "",
            slashKeys,
          }),
          Dropcursor.configure({ color: "#1a73e8", width: 2 }),
        ]
      : []),
  ]);

  const wordTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    content,
    editorProps: {
      attributes: {
        class: cn(
          "outline-none",
          mode === "pdf" &&
            "mx-auto flex w-max min-w-full flex-col items-center gap-12",
          mode === "docx" && "docx-body",
        ),
        style: setup
          ? `padding-top: calc(${setup.sections[0].margin.top} * var(--z));`
          : "",
        "aria-label": t("translation"),
        spellcheck: "true",
        lang: document.target_language,
      },
    },
    onCreate: ({ editor }) => setWords(countWords(editor.state.doc)),
    onUpdate: ({ editor }) => {
      setChanges(changedSegments(editor.state.doc, saved.current));
      if (canInsert) {
        setInsertionChanges(
          countInsertionChanges(savedInsertions.current, insertionKeys(editor.state.doc).keys),
        );
      }
      clearTimeout(wordTimer.current);
      wordTimer.current = setTimeout(
        () => setWords(countWords(editor.state.doc)),
        400,
      );
    },
  });

  const actions = useMemo(
    () => editorActions(editor, mode, docx),
    [editor, mode, docx],
  );
  const activeSource = useEditorState({
    editor,
    selector: ({ editor }) =>
      editor ? (activeFormat(editor.state, docx)?.source ?? null) : null,
  });

  const changeCount = changes.length + insertionChanges;
  const hasChanges = changeCount > 0;

  useLeaveGuard(hasChanges);

  function pickImage() {
    imageInput.current?.click();
  }

  async function save() {
    if (!editor || !hasChanges) return;
    const sent = changes;
    const inserted = canInsert && insertionChanges > 0 ? insertionKeys(editor.state.doc) : null;
    setSaving(true);
    setSaveFailed(false);
    try {
      await onSave(sent, inserted?.blocks);
    } catch (error) {
      setSaveFailed(true);
      throw error;
    } finally {
      setSaving(false);
    }
    for (const { key, translated_text, style, runs } of sent) {
      saved.current.set(key, {
        text: translated_text,
        style: style ?? null,
        runs: runs ?? null,
      });
    }
    if (inserted) savedInsertions.current = inserted.keys;
    // The user may have kept typing while the request was in flight.
    setChanges(changedSegments(editor.state.doc, saved.current));
    if (canInsert) {
      setInsertionChanges(
        countInsertionChanges(savedInsertions.current, insertionKeys(editor.state.doc).keys),
      );
    }
  }

  async function saveAndDownload() {
    if (!downloadHref) return;
    try {
      await save();
      window.location.assign(downloadHref);
    } catch {
      // saveFailed shows the message.
    }
  }

  function print() {
    if (printing) return;
    setFindOpen(false);
    setPrinting(true);
  }

  // Print at the printed size, without gaps between the pages, once the pages
  // are laid out again for it.
  useEffect(() => {
    if (!printing) return;
    const timer = setTimeout(() => {
      window.print();
      setPrinting(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [printing]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // The clipboard is not available (e.g. an insecure context).
    }
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === "s" && !event.shiftKey) {
        event.preventDefault();
        if (!saving) save().catch(() => {});
      } else if (key === "f" || (key === "h" && event.shiftKey)) {
        event.preventDefault();
        setFindOpen(true);
      } else if (key === "p" && !event.shiftKey) {
        event.preventDefault();
        print();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  // The page at the top of the screen, for the status bar.
  useEffect(() => {
    if (!paged) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const sheets = canvasRef.current?.querySelectorAll<HTMLElement>(
          "[data-sheet], [data-page]",
        );
        if (!sheets?.length) return;
        const line = window.innerHeight / 3;
        let index = 0;
        sheets.forEach((sheet, i) => {
          if (sheet.getBoundingClientRect().top <= line) index = i;
        });
        setCurrentPage(index);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, [paged]);

  function setZoomPercent(percent: number) {
    autoFit.current = false;
    setZoomPercentState(
      Math.round(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, percent))),
    );
  }

  function fitWidthPercent(sideBySide: boolean): number {
    const width =
      canvasRef.current?.parentElement?.clientWidth ?? window.innerWidth;
    return fitPercent(prepared.pageWidths, width, sideBySide);
  }

  // Rescale on viewport changes (rotating a device, resizing the window) so
  // the page keeps its A4 proportions without overflowing the screen.
  useEffect(() => {
    if (!paged) return;
    let frame = 0;
    const onResize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!autoFit.current) return;
        const fit = fitWidthPercent(mode === "pdf" && compare);
        setZoomPercentState(Math.max(MIN_ZOOM, Math.min(100, fit)));
      });
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
    };
  }, [paged, mode, compare]);

  function fitWidth() {
    setZoomPercent(fitWidthPercent(mode === "pdf" && compare));
  }

  const zoomControls: ZoomControls = { zoomPercent, setZoomPercent, fitWidth };

  const zoom = printing ? PX_PER_PT : (zoomPercent / 100) * PX_PER_PT;
  const pdfView: PdfViewSettings = {
    pageImageHref: pageImageHref ?? (() => ""),
    pageCount: pages.length,
    zoom,
    imageScale: Math.min(4, Math.max(1, Math.ceil(zoom * pixelRatio))),
    compare: compare && !printing,
    showBoxes: showBoxes && !printing,
    showSource,
    fits,
    printing,
  };

  const pdfControls =
    mode === "pdf"
      ? {
          compare,
          setCompare: (value: boolean) => {
            setCompare(value);
            // Keep both pages on screen when they no longer fit.
            if (value)
              setZoomPercent(Math.min(zoomPercent, fitWidthPercent(true)));
          },
          showBoxes,
          setShowBoxes,
          showSource,
          setShowSource,
          fits,
        }
      : undefined;

  const pageCount =
    mode === "pdf" ? pages.length : Math.max(1, pagedDocx.pages.length);
  const firstPage = setup?.sections[0].page ?? pages[0];

  return (
    <div className="flex w-full flex-1 flex-col">
      {printing && firstPage && (
        <style>{`@page { size: ${firstPage.width}pt ${firstPage.height}pt; margin: 0; }`}</style>
      )}
      <div className="sticky top-16 z-30 bg-background print:hidden">
        <div className="flex items-start gap-2 px-3 pt-2 sm:px-4">
          <Link
            href={backHref}
            aria-label={t("back")}
            title={t("back")}
            className="mt-1 inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden />
          </Link>
          <span
            aria-hidden
            className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary"
          >
            <FileText className="size-4.5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <h1 className="truncate text-[1.05rem] leading-6 font-medium">
                {document.file_name}
              </h1>
              {badge && (
                <span className="hidden shrink-0 rounded-full border border-border/70 px-2 py-px text-xs text-muted-foreground md:inline">
                  {badge}
                </span>
              )}
              <span
                aria-live="polite"
                className="hidden shrink-0 items-center gap-1.5 px-1 text-xs text-muted-foreground sm:inline-flex"
              >
                {saving ? (
                  <Loader2 className="size-3 animate-spin" aria-hidden />
                ) : hasChanges ? (
                  <span
                    className="size-1.5 rounded-full bg-amber-500"
                    aria-hidden
                  />
                ) : (
                  <Check className="size-3" aria-hidden />
                )}
                {saving
                  ? t("saving")
                  : hasChanges
                    ? t("unsaved", { count: changeCount })
                    : t("saved")}
              </span>
            </div>
            <MenuBar
              mode={mode}
              actions={actions}
              canSave={hasChanges && !saving}
              onSave={() => save().catch(() => {})}
              onDownload={
                !downloadHref
                  ? undefined
                  : hasChanges
                    ? saveAndDownload
                    : () => window.location.assign(downloadHref)
              }
              onPrint={print}
              onBack={() => router.push(backHref)}
              onFind={() => setFindOpen(true)}
              onWordCount={() => setWordCountOpen(true)}
              onCopyLink={copyLink}
              zoom={zoomControls}
              showSource={showSource}
              onToggleSource={() => setShowSource((value) => !value)}
              pdf={pdfControls}
              onInsertImage={canInsert && onUploadImage ? pickImage : undefined}
            />
          </div>

          <div className="mt-1 flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("save")}
              title={t("saveShortcut")}
              disabled={!hasChanges || saving}
              onClick={() => save().catch(() => {})}
            >
              <Save aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("print")}
              title={t("printShortcut")}
              onClick={print}
              className="hidden sm:inline-flex"
            >
              <Printer aria-hidden />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={copyLink}
              className="hidden rounded-full md:inline-flex"
            >
              {linkCopied ? <Check aria-hidden /> : <Link2 aria-hidden />}
              {linkCopied ? t("linkCopied") : t("copyLink")}
            </Button>
            {!downloadHref ? null : hasChanges ? (
              <Button
                size="sm"
                className="rounded-full"
                disabled={saving}
                onClick={saveAndDownload}
              >
                <Download aria-hidden />
                {t("saveAndDownload")}
              </Button>
            ) : (
              <a
                href={downloadHref}
                download
                className={cn(buttonVariants({ size: "sm" }), "rounded-full")}
              >
                <Download aria-hidden />
                {t("download")}
              </a>
            )}
          </div>
        </div>

        <EditorToolbar
          editor={editor}
          mode={mode}
          docx={docx}
          actions={actions}
          findOpen={findOpen}
          onToggleFind={() => setFindOpen((open) => !open)}
          onPrint={print}
          zoom={zoomControls}
          documentFonts={prepared.fonts}
          showSource={showSource}
          onToggleSource={() => setShowSource((value) => !value)}
          pdf={pdfControls}
          onInsertImage={canInsert && onUploadImage ? pickImage : undefined}
        >
          {findOpen && editor && (
            <FindBar editor={editor} onClose={() => setFindOpen(false)} />
          )}
        </EditorToolbar>

        {showSource && mode !== "pdf" && (
          <p className="flex items-baseline gap-2 border-y border-border/60 bg-muted/40 px-4 py-1.5 text-sm">
            <span className="shrink-0 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {t("original")}
            </span>
            <span className="line-clamp-2 text-foreground/80">
              {activeSource ?? t("sourceHint")}
            </span>
          </p>
        )}

        {layoutFailed && onRetryLayout && (
          <p
            role="alert"
            className="flex items-center gap-2 border-b border-amber-500/20 bg-amber-500/5 px-4 py-1.5 text-sm text-amber-700 dark:text-amber-400"
          >
            <AlertCircle className="size-4 shrink-0" aria-hidden />
            <span className="flex-1">{t("layoutError")}</span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 rounded-full"
              onClick={onRetryLayout}
            >
              {t("retry")}
            </Button>
          </p>
        )}

        {uploadFailed && (
          <p
            role="alert"
            className="flex items-center gap-2 border-b border-destructive/20 bg-destructive/5 px-4 py-1.5 text-sm text-destructive"
          >
            <span className="flex-1">{t("blocks.uploadError")}</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 rounded-full"
              onClick={() => setUploadFailed(false)}
            >
              {t("blocks.dismiss")}
            </Button>
          </p>
        )}

        {saveFailed && (
          <p
            role="alert"
            className="border-b border-destructive/20 bg-destructive/5 px-4 py-1.5 text-sm text-destructive"
          >
            {t("saveError")}
          </p>
        )}
        <div className="h-px bg-border/60" />
      </div>

      {mode === "pdf" ? (
        <PdfViewContext.Provider value={pdfView}>
          <div
            ref={canvasRef}
            data-printing={printing || undefined}
            className="flex-1 overflow-x-auto bg-muted/60 px-8 py-10 dark:bg-muted/30 print:overflow-visible print:bg-transparent print:p-0"
          >
            <EditorContent editor={editor} />
          </div>
        </PdfViewContext.Provider>
      ) : mode === "docx" && setup ? (
        <div className="flex-1 overflow-x-auto bg-muted/60 px-8 py-8 dark:bg-muted/30 print:overflow-visible print:bg-transparent print:p-0">
          <DocxCanvas
            editor={editor}
            store={pagination}
            setup={setup}
            zoom={zoom}
            printing={printing}
            canvasRef={canvasRef}
          >
            {canInsert && !printing && <BlockHandle editor={editor} containerRef={canvasRef} />}
          </DocxCanvas>
          {canInsert && editor && (
            <>
              <BubbleToolbar editor={editor} actions={actions} />
              <TableToolbar editor={editor} />
              <SlashMenu editor={editor} slashKeys={slashKeys} onPickImage={pickImage} />
              <input
                ref={imageInput}
                type="file"
                accept={IMAGE_TYPES.join(",")}
                multiple
                hidden
                onChange={(event) => {
                  const files = [...(event.target.files ?? [])];
                  event.target.value = "";
                  if (files.length) {
                    setUploadFailed(false);
                    void insertImages(editor, files);
                  }
                }}
              />
            </>
          )}
        </div>
      ) : (
        <article className="mx-auto w-full max-w-3xl px-10 pt-12 pb-32 sm:px-16">
          <h2 className="text-3xl font-bold tracking-tight break-words sm:text-4xl">
            {document.file_name}
          </h2>

          <dl className="mt-5 grid grid-cols-[8rem_1fr] gap-y-1.5 text-sm">
            {details.map(({ icon: Icon, label, value }) => (
              <div key={label} className="contents">
                <dt className="flex items-center gap-2 text-muted-foreground">
                  <Icon className="size-4" aria-hidden />
                  {label}
                </dt>
                <dd>{value}</dd>
              </div>
            ))}
            <dt className="flex items-center gap-2 text-muted-foreground">
              <FileText className="size-4" aria-hidden />
              {t("fileType")}
            </dt>
            <dd>{document.document_type.toUpperCase()}</dd>
          </dl>

          <p className="mt-5 flex gap-2 rounded-sm bg-muted/50 px-3 py-2.5 text-sm text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            {help ?? t("help")}
          </p>

          <div className="mt-6 border-t border-border/60 pt-6">
            <EditorContent editor={editor} />
          </div>
        </article>
      )}

      <StatusBar
        page={paged ? Math.min(currentPage, Math.max(0, pageCount - 1)) : null}
        pageCount={pageCount}
        words={words}
        onWordCount={() => setWordCountOpen(true)}
        zoom={paged ? zoomControls : null}
      />

      <WordCountDialog
        open={wordCountOpen}
        onOpenChange={setWordCountOpen}
        document={document}
        doc={editor?.state.doc ?? null}
        pageCount={paged ? pageCount : null}
      />
    </div>
  );
}

function WordCountDialog({
  open,
  onOpenChange,
  document,
  doc,
  pageCount,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: EditorDocument;
  doc: ProseMirrorNode | null;
  pageCount: number | null;
}) {
  const { t } = useTranslation("editor");
  const counts = useMemo(() => {
    if (!open || !doc) return null;
    let characters = 0;
    let noSpaces = 0;
    doc.descendants((node) => {
      if (!isCountedText(node)) return true;
      characters += [...node.textContent].length;
      noSpaces += [...node.textContent.replace(/\s/g, "")].length;
      return false;
    });
    const source = document.segments.reduce(
      (sum, segment) => sum + [...segment.source_text].length,
      0,
    );
    return {
      words: countWords(doc),
      characters,
      noSpaces,
      source,
      segments: document.segments.length,
    };
  }, [open, doc, document.segments]);

  const rows: [string, number | null][] = counts
    ? [
        [t("wordCount.pages"), pageCount],
        [t("wordCount.wordsLabel"), counts.words],
        [t("wordCount.characters"), counts.characters],
        [t("wordCount.charactersNoSpaces"), counts.noSpaces],
        [t("wordCount.sourceCharacters"), counts.source],
        [t("wordCount.segments"), counts.segments],
      ]
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("wordCount.title")}</DialogTitle>
          <DialogDescription>
            {t("wordCount.description")}
          </DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-[1fr_auto] gap-y-2 text-sm">
          {rows
            .filter(([, value]) => value !== null)
            .map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="text-right font-medium tabular-nums">
                  {value?.toLocaleString()}
                </dd>
              </div>
            ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
