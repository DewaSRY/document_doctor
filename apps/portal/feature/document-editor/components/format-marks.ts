import type { JSONContent } from "@tiptap/core";
import Bold from "@tiptap/extension-bold";
import Highlight from "@tiptap/extension-highlight";
import Italic from "@tiptap/extension-italic";
import Strike from "@tiptap/extension-strike";
import { Color, TextStyle } from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

import type { RunStyle, SegmentRun } from "../type";

/**
 * Inline formatting of a segment's text: bold, italic, underline, strike,
 * colour and highlight. It is saved as the segment's `runs`, which the
 * service writes into the rebuilt file.
 */
export const FORMAT_MARKS = [
  Bold,
  Italic,
  Underline,
  // Google Docs' shortcut; Mod-Shift-s is the browser's "Save as".
  Strike.extend({
    addKeyboardShortcuts() {
      return { "Alt-Shift-5": () => this.editor.commands.toggleStrike() };
    },
  }),
  TextStyle,
  Color,
  Highlight.configure({ multicolor: true }),
];

/** The toggles a segment's text has in the document, before any edit. */
export interface BaseRun {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
}

export const PLAIN_RUN: BaseRun = { bold: false, italic: false, underline: false, strike: false };

type Mark = NonNullable<JSONContent["marks"]>[number];

function marksOf(style: RunStyle): Mark[] {
  const marks: Mark[] = [];
  if (style.bold) marks.push({ type: "bold" });
  if (style.italic) marks.push({ type: "italic" });
  if (style.underline) marks.push({ type: "underline" });
  if (style.strike) marks.push({ type: "strike" });
  if (style.color) marks.push({ type: "textStyle", attrs: { color: style.color } });
  if (style.highlight) marks.push({ type: "highlight", attrs: { color: style.highlight } });
  return marks;
}

/** Editor content of a segment: its saved runs, or its text in the base formatting. */
export function runsToContent(
  text: string,
  runs: SegmentRun[] | undefined | null,
  base: BaseRun,
): JSONContent[] {
  const parts: SegmentRun[] =
    runs?.length && runs.map((run) => run.text).join("") === text ? runs : [{ text, style: base }];
  return parts
    .filter((run) => run.text)
    .map((run) => {
      const marks = marksOf(run.style ?? {});
      return marks.length
        ? { type: "text", text: run.text, marks }
        : { type: "text", text: run.text };
    });
}

/** The formatting of every range of a segment's text, with each toggle explicit. */
export function nodeToRuns(node: ProseMirrorNode): SegmentRun[] {
  const runs: SegmentRun[] = [];
  node.forEach((child) => {
    if (!child.isText || !child.text) return;
    const style: RunStyle = { bold: false, italic: false, underline: false, strike: false };
    for (const mark of child.marks) {
      const name = mark.type.name;
      if (name === "bold" || name === "italic" || name === "underline" || name === "strike") {
        style[name] = true;
      } else if (name === "textStyle" && mark.attrs.color) {
        style.color = normalizeColor(mark.attrs.color);
      } else if (name === "highlight" && mark.attrs.color) {
        style.highlight = normalizeColor(mark.attrs.color);
      }
    }
    const last = runs.at(-1);
    if (last && sameRunStyle(last.style, style)) last.text += child.text;
    else runs.push({ text: child.text, style });
  });
  return runs;
}

/** Runs to save: null when the whole text keeps the base formatting. */
export function normalizeRuns(runs: SegmentRun[], base: BaseRun): SegmentRun[] | null {
  const uniform = runs.every(
    ({ style = {} }) =>
      !!style.bold === base.bold &&
      !!style.italic === base.italic &&
      !!style.underline === base.underline &&
      !!style.strike === base.strike &&
      !style.color &&
      !style.highlight,
  );
  return uniform ? null : runs;
}

export function sameRunStyle(a: RunStyle | undefined, b: RunStyle | undefined): boolean {
  return (
    !!a?.bold === !!b?.bold &&
    !!a?.italic === !!b?.italic &&
    !!a?.underline === !!b?.underline &&
    !!a?.strike === !!b?.strike &&
    (a?.color ?? null) === (b?.color ?? null) &&
    (a?.highlight ?? null) === (b?.highlight ?? null)
  );
}

export function sameRuns(
  a: SegmentRun[] | null | undefined,
  b: SegmentRun[] | null | undefined,
): boolean {
  if (!a?.length || !b?.length) return !a?.length && !b?.length;
  return (
    a.length === b.length &&
    a.every((run, index) => run.text === b[index].text && sameRunStyle(run.style, b[index].style))
  );
}

/** `#rrggbb` for the colours the pickers and the browser produce. */
export function normalizeColor(value: string): string | undefined {
  if (value === "transparent") return value;
  const hex = value.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(hex)) return hex;
  if (/^#[0-9a-f]{3}$/.test(hex)) return `#${[...hex.slice(1)].map((c) => c + c).join("")}`;
  const rgb = hex.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgb) {
    return `#${rgb
      .slice(1, 4)
      .map((n) => Number(n).toString(16).padStart(2, "0"))
      .join("")}`;
  }
  return undefined;
}
