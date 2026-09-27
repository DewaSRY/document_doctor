"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useTranslation } from "react-i18next";
import { Copy, Eraser, Eye, EyeOff, GripVertical, RotateCcw } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import type { SegmentLayout } from "../type";
import { usePdfView } from "./pdf-view-context";
import { FONT_STACKS, replaceSegmentText, resolveStyle } from "./segment-style";

export function SegmentView(props: NodeViewProps) {
  return props.node.attrs.layout ? (
    <PdfSegmentView {...props} />
  ) : (
    <BlockSegmentView {...props} />
  );
}

/** Smallest font scale tried before the text is left to overflow. */
const MIN_FIT = 0.3;

/**
 * A PDF segment, positioned and styled like the service writes it: the box
 * starts so the first baseline lands on the original one, and a translation
 * that is too long for its box is shrunk to fit.
 */
function PdfSegmentView({ node, decorations }: NodeViewProps) {
  const { t } = useTranslation("translator");
  const { zoom, showBoxes, showSource, fits } = usePdfView();
  const layout = node.attrs.layout as SegmentLayout;
  const style = resolveStyle(layout, node.attrs.style);
  const boxRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(1);

  const isEmpty = node.content.size === 0;
  const isEdited = node.textContent !== node.attrs.initial || node.attrs.style !== null;
  const isActive = decorations.some((decoration) => decoration.spec.active);

  const size = style.font_size;
  const [x0, , x1, y1] = layout.rect;
  const top = layout.baseline - size * layout.baseline_ratio;
  // The original number of lines always fits at the original size.
  const height =
    Math.max(y1, top + size * layout.line_height * layout.line_count + 0.5) - top;
  const fittedTop = layout.baseline - size * fit * layout.baseline_ratio;
  const indent = style.align === "left" || style.align === "justify" ? layout.text_indent : 0;

  useLayoutEffect(() => {
    const box = boxRef.current;
    const content = box?.querySelector<HTMLElement>("[data-node-view-content]");
    if (!box || !content) return;
    const limit = height * zoom + 0.5;
    let scale = 1;
    box.style.setProperty("--fit", "1");
    while (scale > MIN_FIT && content.scrollHeight > limit) {
      scale = Math.round((scale - 0.05) * 100) / 100;
      box.style.setProperty("--fit", String(scale));
    }
    setFit(scale);
    fits.set(node.attrs.key, scale);
    // node.content changes with the text and with its formatting.
  }, [node.content, size, style.family, height, zoom, fits, node.attrs.key]);

  const typography: CSSProperties = {
    fontFamily: FONT_STACKS[style.family],
    fontSize: `calc(${size * zoom}px * var(--fit, 1))`,
    lineHeight: layout.line_height,
    color: style.color,
    // Bold and italic are marks on the text (see format-marks.ts).
    fontWeight: 400,
    fontStyle: "normal",
    textAlign: style.align,
    textIndent: `calc(${indent * zoom}px * var(--fit, 1))`,
  };

  return (
    <NodeViewWrapper
      ref={boxRef}
      data-segment-key={node.attrs.key}
      style={
        {
          left: x0 * zoom,
          top: fittedTop * zoom,
          width: (x1 - x0) * zoom,
          height: height * zoom,
          "--fit": fit,
          ...typography,
        } as CSSProperties
      }
      className={cn(
        // With boxes shown, the outline is the area the translation may fill.
        "absolute outline-1 -outline-offset-1 outline-transparent outline-dashed",
        showBoxes && "outline-sky-500/50",
        showBoxes && isEdited && "outline-amber-500/70",
        showBoxes && fit < 1 && "outline-rose-500/70",
        isActive && "z-10",
      )}
    >
      {/* Hover and focus outline the text itself; the original shows just under it. */}
      <div className="relative">
        <NodeViewContent
          className={cn(
            "relative min-h-lh rounded-[1px] wrap-break-word whitespace-pre-wrap outline-1 outline-offset-1 outline-transparent transition-[outline-color] hover:outline-sky-500/60",
            isActive &&
              "in-[.ProseMirror-focused]:outline-primary in-[.ProseMirror-focused]:hover:outline-primary",
          )}
        />
        {isEmpty && (
          <p
            contentEditable={false}
            title={t("editor.emptySegment")}
            className="pointer-events-none absolute inset-0 opacity-40 select-none"
          >
            {node.attrs.source}
          </p>
        )}
        {isActive && showSource && (
          <div
            contentEditable={false}
            style={{ textIndent: 0 }}
            className="absolute top-full left-0 z-20 mt-1.5 w-max max-w-[min(28rem,80vw)] rounded-md border bg-popover px-3 py-2 text-left font-sans text-xs leading-5 font-normal text-popover-foreground not-italic shadow-lg select-text"
          >
            <span className="mb-0.5 block text-[0.65rem] font-medium tracking-wide text-muted-foreground uppercase">
              {t("editor.original")}
            </span>
            {node.attrs.source}
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}

/** A segment as a Notion-style block: only the translation is shown, with a
 *  hover handle whose menu can reveal the original or reset the text. */
function BlockSegmentView({ node, editor, getPos, decorations }: NodeViewProps) {
  const { t } = useTranslation("translator");
  const [showSource, setShowSource] = useState(false);
  const text = node.textContent;
  const isEmpty = node.content.size === 0;
  const isEdited = text !== node.attrs.initial;
  const isActive = decorations.some((decoration) => decoration.spec.active);

  function replaceText(value: string) {
    const pos = getPos();
    if (pos === undefined) return;
    editor
      .chain()
      .focus()
      .command(({ tr }) => {
        replaceSegmentText(tr, pos, node, value);
        return true;
      })
      .run();
  }

  return (
    <NodeViewWrapper
      className={cn(
        "group/block relative -mx-2 rounded-sm px-2 py-1 transition-colors hover:bg-muted/40",
        isActive && "bg-muted/40",
      )}
    >
      <div
        contentEditable={false}
        className="absolute top-1 -left-7 opacity-0 transition-opacity group-hover/block:opacity-100 has-data-popup-open:opacity-100 focus-within:opacity-100"
      >
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={t("editor.blockMenu")}
            title={t("editor.blockMenu")}
            className="flex size-6 cursor-pointer items-center justify-center rounded-xs text-muted-foreground/70 outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 data-popup-open:bg-muted"
          >
            <GripVertical className="size-4" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="left" className="w-56">
            <DropdownMenuItem onClick={() => setShowSource((value) => !value)}>
              {showSource ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
              {t(showSource ? "editor.hideOriginal" : "editor.showOriginal")}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!isEdited}
              onClick={() => replaceText(node.attrs.initial)}
            >
              <RotateCcw aria-hidden />
              {t("editor.restore")}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={isEmpty}
              onClick={() => navigator.clipboard?.writeText(text)}
            >
              <Copy aria-hidden />
              {t("editor.copy")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              disabled={isEmpty}
              onClick={() => replaceText("")}
            >
              <Eraser aria-hidden />
              {t("editor.clear")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="relative">
        <NodeViewContent className="min-h-7 text-base leading-7 whitespace-pre-wrap outline-none" />
        {isEmpty && (
          <p
            contentEditable={false}
            className="pointer-events-none absolute inset-0 text-base leading-7 text-muted-foreground/60 select-none"
          >
            {t("editor.emptySegment")}
          </p>
        )}
        {isEdited && (
          <span
            contentEditable={false}
            title={t("editor.edited")}
            className="absolute top-2.5 -right-4 size-1.5 rounded-full bg-primary/70"
          />
        )}
      </div>

      {showSource && (
        <div
          contentEditable={false}
          className="mt-1 mb-1 border-l-2 border-border pl-3 text-sm leading-6 text-muted-foreground select-text"
        >
          <span className="mb-0.5 block text-xs font-medium tracking-wide uppercase">
            {t("editor.original")}
          </span>
          {node.attrs.source}
        </div>
      )}
    </NodeViewWrapper>
  );
}
