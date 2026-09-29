"use client";

import { useEffect, useSyncExternalStore, type CSSProperties, type ReactNode, type RefObject } from "react";
import { EditorContent, type Editor } from "@tiptap/react";

import { cn } from "@/lib/utils";

import { documentFontVariables } from "../document-fonts";
import type { DocxSetup } from "./docx-content";
import type { PaginationStore } from "./docx-pagination";

/** Space between sheets on screen, in px. */
export const PAGE_GAP = 20;

/**
 * A Word document on pages: white sheets the size of the document's pages,
 * copies of the headers and footers, and the editor laid over them. The
 * pagination (docx-pagination.ts) decides where each page starts.
 */
export function DocxCanvas({
  editor,
  store,
  setup,
  zoom,
  printing,
  canvasRef,
  children,
}: {
  editor: Editor | null;
  store: PaginationStore;
  setup: DocxSetup;
  /** CSS px per point. */
  zoom: number;
  printing: boolean;
  canvasRef: RefObject<HTMLDivElement | null>;
  /** Drawn over the pages, positioned in the canvas (e.g. the block handle). */
  children?: ReactNode;
}) {
  const snapshot = useSyncExternalStore(store.subscribe, store.get, store.get);

  useEffect(() => {
    store.configure(zoom, printing ? 0 : PAGE_GAP);
  }, [store, zoom, printing]);

  const widest = Math.max(...setup.sections.map((section) => section.page.width)) * zoom;
  const first = setup.sections[0];
  const pages = snapshot.pages.length
    ? snapshot.pages
    : [{ top: 0, width: first.page.width * zoom, height: first.page.height * zoom }];
  const height = snapshot.height || first.page.height * zoom;

  return (
    <div
      ref={canvasRef}
      data-printing={printing || undefined}
      className={cn("docx-canvas relative mx-auto", documentFontVariables)}
      style={
        {
          "--z": `${zoom}px`,
          "--page-count": `"${pages.length}"`,
          width: snapshot.width || widest,
          minHeight: height,
        } as CSSProperties
      }
    >
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0" style={{ height }}>
        {pages.map((page, index) => (
          <div
            key={index}
            data-sheet={index}
            className="docx-sheet absolute left-0 bg-white"
            style={{ top: page.top, width: page.width, height: page.height }}
          />
        ))}
        {snapshot.copies.map((copy) => (
          <div
            key={`${copy.id}-${copy.page}`}
            className="docx-region docx-region-copy"
            style={
              {
                top: copy.top,
                left: copy.left,
                width: copy.width,
                "--page-number": `"${copy.page + 1}"`,
              } as CSSProperties
            }
            dangerouslySetInnerHTML={{ __html: copy.html }}
          />
        ))}
      </div>
      <EditorContent editor={editor} className="relative" />
      {children}
    </div>
  );
}
