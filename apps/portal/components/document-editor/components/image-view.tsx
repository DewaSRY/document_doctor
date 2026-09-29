"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useTranslation } from "react-i18next";
import { AlignCenter, AlignLeft, AlignRight, Loader2, Trash } from "lucide-react";

import { cn } from "@/lib/utils";

import type { DocxSetup } from "./docx-content";
import { pt, type DocxStyles } from "./docx-style";

const MIN_WIDTH = 24;
const ALIGNS = [
  { value: "left", icon: AlignLeft, label: "alignLeft" },
  { value: "center", icon: AlignCenter, label: "alignCenter" },
  { value: "right", icon: AlignRight, label: "alignRight" },
] as const;

/**
 * An image the user added: placed on its own line like Word's inline
 * pictures, resized from its corner (keeping its proportions) and aligned
 * from the bar shown when it is selected.
 */
export function ImageView({ node, selected, updateAttributes, deleteNode, extension, editor }: NodeViewProps) {
  const { t } = useTranslation("editor");
  const { docx, setup } = extension.options as { docx: DocxStyles; setup: DocxSetup };
  const { src, preview, width, height, align, alt, section } = node.attrs as {
    src: string | null;
    preview: string | null;
    width: number;
    height: number;
    align: "left" | "center" | "right";
    alt: string;
    section: number | null;
  };
  const { page, margin } = setup.sections[section ?? 0] ?? setup.sections[0];
  const textWidth = page.width - margin.left - margin.right;
  const frameRef = useRef<HTMLSpanElement>(null);
  const [draft, setDraft] = useState<number | null>(null);
  const shown = draft ?? width;
  const ratio = height / width;
  const editable = editor.isEditable;

  function startResize(event: ReactPointerEvent<HTMLSpanElement>) {
    event.preventDefault();
    event.stopPropagation();
    const frame = frameRef.current;
    if (!frame) return;
    // CSS px per point: the canvas' zoom.
    const zoom = frame.getBoundingClientRect().width / width || 4 / 3;
    const startX = event.clientX;
    const direction = align === "right" ? -1 : align === "center" ? 2 : 1;
    let next = width;
    const move = (e: PointerEvent) => {
      next = Math.round(Math.min(textWidth, Math.max(MIN_WIDTH, width + ((e.clientX - startX) * direction) / zoom)));
      setDraft(next);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setDraft(null);
      if (next !== width) updateAttributes({ width: next, height: Math.round(next * ratio * 10) / 10 });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  return (
    <NodeViewWrapper
      data-ins-image=""
      className="ins-block ins-image"
      style={{
        marginLeft: pt(margin.left),
        width: pt(textWidth),
        textAlign: align,
      }}
    >
      <span
        ref={frameRef}
        data-drag-handle=""
        className={cn("ins-image-frame", selected && "is-selected")}
        style={{ width: pt(shown), height: pt(shown * ratio) }}
      >
        {src || preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- served by the document's media route
          <img src={src ? docx.mediaHref(src) : preview!} alt={alt} draggable={false} />
        ) : null}
        {!src && (
          <span className="ins-image-uploading">
            <Loader2 className="size-5 animate-spin" aria-hidden />
            <span className="sr-only">{t("blocks.uploading")}</span>
          </span>
        )}
        {selected && editable && (
          <>
            <span
              role="slider"
              aria-label={t("blocks.resizeImage")}
              aria-valuenow={Math.round(shown)}
              className="ins-image-resize"
              onPointerDown={startResize}
            />
            <span className="ins-image-bar" contentEditable={false}>
              {ALIGNS.map(({ value, icon: Icon, label }) => (
                <button
                  key={value}
                  type="button"
                  title={t(label)}
                  aria-label={t(label)}
                  aria-pressed={align === value}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => updateAttributes({ align: value })}
                  className={cn(align === value && "is-on")}
                >
                  <Icon className="size-3.5" aria-hidden />
                </button>
              ))}
              <span aria-hidden className="mx-0.5 h-4 w-px bg-white/25" />
              <button
                type="button"
                title={t("blocks.delete")}
                aria-label={t("blocks.delete")}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => deleteNode()}
              >
                <Trash className="size-3.5" aria-hidden />
              </button>
            </span>
          </>
        )}
      </span>
    </NodeViewWrapper>
  );
}
