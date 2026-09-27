"use client";

import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useTranslation } from "react-i18next";

/** A segment as a row: the original text (read-only) next to the editable
 *  translation. The editor container toggles the original column with
 *  `data-show-source`. */
export function SegmentView({ node }: NodeViewProps) {
  const { t } = useTranslation("translator");
  const isEmpty = node.content.size === 0;

  return (
    <NodeViewWrapper className="grid gap-x-6 gap-y-1.5 border-b border-border/70 px-4 py-3 last:border-b-0 group-data-[show-source=true]/editor:md:grid-cols-2 sm:px-6">
      <div
        contentEditable={false}
        className="hidden text-sm leading-relaxed text-muted-foreground select-text group-data-[show-source=true]/editor:block"
      >
        {node.attrs.source}
      </div>
      <div className="relative">
        <NodeViewContent
          className="min-h-6 rounded-sm text-sm leading-relaxed whitespace-pre-wrap outline-none"
        />
        {isEmpty && (
          <p
            contentEditable={false}
            className="pointer-events-none absolute inset-0 text-sm text-muted-foreground/70 italic select-none"
          >
            {t("editor.emptySegment")}
          </p>
        )}
      </div>
    </NodeViewWrapper>
  );
}
