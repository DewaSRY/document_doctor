import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { Transaction } from "@tiptap/pm/state";

import type { FontFamily, SegmentLayout, SegmentStyle, TextAlign } from "../type";
import { PLAIN_RUN, type BaseRun } from "./format-marks";

/** Browser fonts with the metrics of the PDF base fonts the service writes with. */
export const FONT_STACKS: Record<FontFamily, string> = {
  Helvetica: 'Helvetica, Arial, "Liberation Sans", sans-serif',
  Times: '"Times New Roman", Times, "Liberation Serif", serif',
  Courier: '"Courier New", Courier, "Liberation Mono", monospace',
};

export const FONT_FAMILIES = Object.keys(FONT_STACKS) as FontFamily[];

/** 1pt is 4/3 CSS px, so 100% zoom shows the page at its printed size. */
export const PX_PER_PT = 4 / 3;

export interface ResolvedPdfStyle {
  bold: boolean;
  italic: boolean;
  font_size: number;
  color: string;
  align: TextAlign;
  family: FontFamily;
}

/** The style a PDF segment is written with: its detected style plus overrides. */
export function resolveStyle(
  layout: SegmentLayout,
  style: SegmentStyle | null | undefined,
): ResolvedPdfStyle {
  const family = style?.family;
  return {
    bold: style?.bold ?? layout.bold,
    italic: style?.italic ?? layout.italic,
    font_size: style?.font_size ?? layout.font_size,
    color: style?.color ?? layout.color,
    align: style?.align ?? layout.align,
    family: family && family in FONT_STACKS ? (family as FontFamily) : layout.family,
  };
}

/** Replace the whole text of a segment node at `pos`, in the document's formatting. */
export function replaceSegmentText(
  tr: Transaction,
  pos: number,
  node: ProseMirrorNode,
  text: string,
): Transaction {
  const from = pos + 1;
  const to = pos + node.nodeSize - 1;
  if (!text) return tr.delete(from, to);
  const { schema } = tr.doc.type;
  const base: BaseRun = node.attrs.base ?? PLAIN_RUN;
  const marks = (["bold", "italic", "underline", "strike"] as const)
    .filter((name) => base[name] && schema.marks[name])
    .map((name) => schema.marks[name].create());
  return tr.replaceWith(from, to, schema.text(text, marks));
}
