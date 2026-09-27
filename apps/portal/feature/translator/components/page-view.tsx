"use client";

import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useTranslation } from "react-i18next";

import { getPageImageHref } from "../constants";
import { usePdfView } from "./pdf-view-context";

/** A PDF page: the original page with its translatable text removed, and the
 *  editable translations placed on top where the rebuilt PDF will have them. */
export function PageView({ node }: NodeViewProps) {
  const { t } = useTranslation("translator");
  const { documentId, pageCount, zoom, imageScale, compare } = usePdfView();
  const { number, width, height } = node.attrs as {
    number: number;
    width: number;
    height: number;
  };
  const sheet = { width: width * zoom, height: height * zoom };

  return (
    <NodeViewWrapper
      data-page={number}
      className="flex scroll-mt-32 flex-col items-center gap-2"
    >
      <div className="flex items-start gap-6">
        {compare && (
          <div
            contentEditable={false}
            style={sheet}
            className="relative shrink-0 bg-white shadow-md ring-1 ring-black/10 select-none"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- a rendered PDF page, not an optimisable asset */}
            <img
              src={getPageImageHref(documentId, number, { scale: imageScale, original: true })}
              alt={t("editor.originalPage", { page: number + 1 })}
              draggable={false}
              loading="lazy"
              className="pointer-events-none absolute inset-0 size-full"
            />
            <span className="absolute -top-6 left-0 text-xs font-medium text-muted-foreground">
              {t("editor.original")}
            </span>
          </div>
        )}

        <div
          style={sheet}
          className="relative shrink-0 bg-white shadow-md ring-1 ring-black/10"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- a rendered PDF page, not an optimisable asset */}
          <img
            contentEditable={false}
            src={getPageImageHref(documentId, number, { scale: imageScale })}
            alt=""
            draggable={false}
            loading={number < 2 ? "eager" : "lazy"}
            className="pointer-events-none absolute inset-0 size-full select-none"
          />
          <NodeViewContent className="absolute inset-0" />
          {compare && (
            <span
              contentEditable={false}
              className="absolute -top-6 left-0 text-xs font-medium text-muted-foreground select-none"
            >
              {t("editor.translation")}
            </span>
          )}
        </div>
      </div>

      <span contentEditable={false} className="text-xs text-muted-foreground select-none">
        {t("editor.pageOf", { page: number + 1, count: pageCount })}
      </span>
    </NodeViewWrapper>
  );
}
