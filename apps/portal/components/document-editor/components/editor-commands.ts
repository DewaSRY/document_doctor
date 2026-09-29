import { Extension, type Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { EditorState } from "@tiptap/pm/state";

import type { HeadingKind, InsertedTextKind, SegmentLayout, SegmentStyle, TextAlign } from "../type";
import { effectiveStyle, paragraphStyleOf, type DocxStyles } from "./docx-style";
import {
  HEADING_KINDS,
  applyKind,
  changeLevel,
  insertDivider,
  insertPageBreak,
  insertTable,
  insertedParagraphAt,
  setInsertedAlign,
  setKind,
} from "./insert-extension";
import { findActiveSegment, selectedSegments } from "./segment-extension";
import { resolveStyle } from "./segment-style";

/** How the document is edited: PDF pages, Word pages, or plain blocks (no layout). */
export type EditorMode = "pdf" | "docx" | "blocks";

export const MIN_FONT_SIZE = 4;
export const MAX_FONT_SIZE = 96;
/** One indent step: half an inch, like Word and Google Docs. */
const INDENT_STEP = 36;

/** What the formatting controls show for the segment holding the cursor. */
export interface ActiveFormat {
  key: string;
  family: string | null;
  fontSize: number | null;
  align: TextAlign | null;
  heading: HeadingKind | null;
  lineSpacing: number | null;
  spaceBefore: number | null;
  spaceAfter: number | null;
  indentLeft: number | null;
  color: string | null;
  hasStyle: boolean;
  isEdited: boolean;
  isEmpty: boolean;
  source: string;
  /** In a block the user added (DOCX): no segment, font or spacing of its own. */
  inserted: boolean;
  /** The kind of that block. */
  kind: InsertedTextKind | null;
}

function segmentFormat(
  node: ProseMirrorNode,
  parent: ProseMirrorNode | null,
  docx: DocxStyles | null,
): Pick<ActiveFormat, "family" | "fontSize" | "align" | "heading" | "lineSpacing" | "spaceBefore" | "spaceAfter" | "indentLeft" | "color"> {
  const layout = node.attrs.layout as SegmentLayout | null;
  if (layout) {
    const style = resolveStyle(layout, node.attrs.style);
    return {
      family: style.family,
      fontSize: style.font_size,
      align: style.align,
      heading: null,
      lineSpacing: null,
      spaceBefore: null,
      spaceAfter: null,
      indentLeft: null,
      color: style.color,
    };
  }
  if (docx && node.attrs.run && parent?.type.name === "docxParagraph") {
    const { paragraph } = paragraphStyleOf(parent, docx);
    const { run } = effectiveStyle(docx, paragraph, node.attrs.run, node.attrs.style);
    const style = node.attrs.style as SegmentStyle | null;
    return {
      family: run.family,
      fontSize: run.size,
      align: paragraph.align,
      heading: style?.heading ?? parent.attrs.heading ?? "normal",
      lineSpacing: paragraph.line.rule === "auto" ? paragraph.line.value : null,
      spaceBefore: paragraph.space_before,
      spaceAfter: paragraph.space_after,
      indentLeft: paragraph.indent_left,
      color: run.color,
    };
  }
  return {
    family: null,
    fontSize: null,
    align: null,
    heading: null,
    lineSpacing: null,
    spaceBefore: null,
    spaceAfter: null,
    indentLeft: null,
    color: null,
  };
}

export function activeFormat(state: EditorState, docx: DocxStyles | null): ActiveFormat | null {
  const found = findActiveSegment(state);
  if (!found) {
    const inserted = insertedParagraphAt(state);
    if (!inserted) return null;
    const { kind, align } = inserted.node.attrs as { kind: InsertedTextKind; align: TextAlign | null };
    return {
      key: "",
      family: null,
      fontSize: null,
      align: align ?? "left",
      heading: (HEADING_KINDS as string[]).includes(kind) ? (kind as HeadingKind) : null,
      lineSpacing: null,
      spaceBefore: null,
      spaceAfter: null,
      indentLeft: null,
      color: null,
      hasStyle: false,
      isEdited: false,
      isEmpty: inserted.node.content.size === 0,
      source: "",
      inserted: true,
      kind,
    };
  }
  const { node, pos } = found;
  const parent = state.doc.resolve(pos).parent;
  return {
    key: node.attrs.key,
    ...segmentFormat(node, parent, docx),
    hasStyle: node.attrs.style !== null,
    isEdited: node.textContent !== node.attrs.initial,
    isEmpty: node.content.size === 0,
    source: node.attrs.source,
    inserted: false,
    kind: null,
  };
}

/** Every editing action, for the toolbar, the menus and the keyboard shortcuts. */
export function editorActions(editor: Editor | null, mode: EditorMode, docx: DocxStyles | null) {
  const chain = () => editor!.chain().focus();
  const ready = () => !!editor && !editor.isDestroyed;

  /** Align: the paragraph in a Word document (and the blocks the user added), the segment in a PDF. */
  const setAlign = (align: TextAlign) =>
    ready() &&
    chain()
      .command(({ tr, commands }) => {
        const inserted = mode === "docx" && setInsertedAlign(tr, align);
        const segments = mode === "docx" ? commands.setParagraphStyle({ align }) : commands.setSegmentStyle({ align });
        return inserted || segments;
      })
      .run();

  const changeFontSize = (delta: number) => {
    if (!ready()) return false;
    return chain()
      .command(({ state, tr, dispatch }) => {
        const segments = selectedSegments(state);
        if (!segments.length) return false;
        if (dispatch) {
          for (const { node, pos } of segments) {
            const parent = state.doc.resolve(pos).parent;
            const current = segmentFormat(node, parent, docx).fontSize;
            if (current === null) continue;
            const font_size = clampFontSize(Math.round(current + delta));
            tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              style: { ...node.attrs.style, font_size },
            });
          }
        }
        return true;
      })
      .run();
  };

  const indent = (direction: 1 | -1) =>
    ready() &&
    chain()
      .command(({ state, tr, commands }) => {
        if (changeLevel(tr, direction)) return true;
        const found = findActiveSegment(state);
        if (!found) return false;
        const current = segmentFormat(found.node, state.doc.resolve(found.pos).parent, docx).indentLeft ?? 0;
        const next = Math.max(0, (Math.floor(current / INDENT_STEP + 1e-6) + direction) * INDENT_STEP);
        return commands.setParagraphStyle({ indent_left: next });
      })
      .run();

  return {
    undo: () => ready() && chain().undo().run(),
    redo: () => ready() && chain().redo().run(),
    selectAll: () => ready() && chain().selectAll().run(),
    toggleBold: () => ready() && chain().toggleBold().run(),
    toggleItalic: () => ready() && chain().toggleItalic().run(),
    toggleUnderline: () => ready() && chain().toggleUnderline().run(),
    toggleStrike: () => ready() && chain().toggleStrike().run(),
    setColor: (color: string | null) =>
      ready() && (color ? chain().setColor(color).run() : chain().unsetColor().run()),
    setHighlight: (color: string | null) =>
      ready() && (color ? chain().setHighlight({ color }).run() : chain().unsetHighlight().run()),
    setFamily: (family: string) => ready() && chain().setSegmentStyle({ family }).run(),
    setFontSize: (size: number) =>
      ready() && chain().setSegmentStyle({ font_size: clampFontSize(size) }).run(),
    changeFontSize,
    setAlign,
    setHeading: (heading: HeadingKind) =>
      ready() &&
      mode === "docx" &&
      chain()
        .command(({ tr, commands }) => {
          const inserted = setKind(tr, heading, false);
          return commands.setHeading(heading) || inserted;
        })
        .run(),
    setLineSpacing: (line_spacing: number) =>
      ready() && mode === "docx" && chain().setParagraphStyle({ line_spacing }).run(),
    setSpaceBefore: (space_before: number) =>
      ready() && mode === "docx" && chain().setParagraphStyle({ space_before }).run(),
    setSpaceAfter: (space_after: number) =>
      ready() && mode === "docx" && chain().setParagraphStyle({ space_after }).run(),
    indent: (direction: 1 | -1) => mode === "docx" && indent(direction),
    clearFormatting: () =>
      ready() &&
      chain()
        .command(({ commands }) => commands.clearFormatting() || commands.unsetAllMarks())
        .run(),
    resetStyle: () => ready() && chain().setSegmentStyle(null).run(),
    insertText: (text: string) =>
      ready() &&
      chain()
        .command(({ state, tr, dispatch }) => {
          if (!findActiveSegment(state) && !insertedParagraphAt(state)) return false;
          if (dispatch) tr.insertText(text);
          return true;
        })
        .run(),
    restore: () => ready() && chain().restoreSegment().run(),
    clearText: () => ready() && chain().setSegmentText("").run(),
    // Blocks the user adds (Word documents only).
    setBlockKind: (kind: InsertedTextKind) => ready() && mode === "docx" && applyKind(editor!, kind),
    insertTable: (rows: number, cols: number) => ready() && mode === "docx" && insertTable(editor!, rows, cols),
    insertDivider: () => ready() && mode === "docx" && insertDivider(editor!),
    insertPageBreak: () => ready() && mode === "docx" && insertPageBreak(editor!),
  };
}

export type EditorActions = ReturnType<typeof editorActions>;

export function clampFontSize(size: number): number {
  return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, Math.round(size * 10) / 10));
}

/**
 * Google Docs' formatting shortcuts: alignment, paragraph styles, font size
 * and indent. (Bold, italic, underline and strike come with their marks.)
 */
export const DocShortcuts = Extension.create<{ mode: EditorMode; docx: DocxStyles | null }>({
  name: "docShortcuts",

  addOptions() {
    return { mode: "blocks", docx: null };
  },

  addKeyboardShortcuts() {
    const actions = () => editorActions(this.editor as unknown as Editor, this.options.mode, this.options.docx);
    const shortcuts: Record<string, () => boolean> = {
      "Mod-Shift-.": () => actions().changeFontSize(1),
      "Mod-Shift-,": () => actions().changeFontSize(-1),
    };
    if (this.options.mode !== "blocks") {
      Object.assign(shortcuts, {
        "Mod-Shift-l": () => actions().setAlign("left"),
        "Mod-Shift-e": () => actions().setAlign("center"),
        "Mod-Shift-r": () => actions().setAlign("right"),
        "Mod-Shift-j": () => actions().setAlign("justify"),
      });
    }
    if (this.options.mode === "docx") {
      Object.assign(shortcuts, {
        "Mod-Alt-0": () => actions().setHeading("normal"),
        ...Object.fromEntries(
          [1, 2, 3, 4, 5, 6].map((level) => [`Mod-Alt-${level}`, () => actions().setHeading(`h${level}` as HeadingKind)]),
        ),
        "Mod-]": () => actions().indent(1),
        "Mod-[": () => actions().indent(-1),
      });
    }
    return shortcuts;
  },
});
