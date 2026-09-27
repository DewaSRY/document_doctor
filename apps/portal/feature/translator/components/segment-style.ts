import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { Transaction } from "@tiptap/pm/state";

import type { FontFamily, SegmentLayout, SegmentStyle } from "../type";

/** Browser fonts with the metrics of the PDF base fonts the service writes with. */
export const FONT_STACKS: Record<FontFamily, string> = {
  Helvetica: 'Helvetica, Arial, "Liberation Sans", sans-serif',
  Times: '"Times New Roman", Times, "Liberation Serif", serif',
  Courier: '"Courier New", Courier, "Liberation Mono", monospace',
};

export const FONT_FAMILIES = Object.keys(FONT_STACKS) as FontFamily[];

/** 1pt is 4/3 CSS px, so 100% zoom shows the page at its printed size. */
export const PX_PER_PT = 4 / 3;

/** The style a PDF segment is written with: its detected style plus overrides. */
export function resolveStyle(
  layout: SegmentLayout,
  style: SegmentStyle | null | undefined,
): Required<SegmentStyle> {
  return {
    bold: style?.bold ?? layout.bold,
    italic: style?.italic ?? layout.italic,
    font_size: style?.font_size ?? layout.font_size,
    color: style?.color ?? layout.color,
    align: style?.align ?? layout.align,
    family: style?.family ?? layout.family,
  };
}

/** Replace the whole text of a segment node at `pos`. */
export function replaceSegmentText(
  tr: Transaction,
  pos: number,
  node: ProseMirrorNode,
  text: string,
): Transaction {
  const from = pos + 1;
  const to = pos + node.nodeSize - 1;
  return text
    ? tr.replaceWith(from, to, tr.doc.type.schema.text(text))
    : tr.delete(from, to);
}
