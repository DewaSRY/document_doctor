import { Node, mergeAttributes, type JSONContent } from "@tiptap/core";
import type { DOMOutputSpec, Mark, Node as ProseMirrorNode, Schema } from "@tiptap/pm/model";
import {
  Plugin,
  PluginKey,
  TextSelection,
  type EditorState,
  type Transaction,
} from "@tiptap/pm/state";
import { AddMarkStep, RemoveMarkStep, ReplaceStep } from "@tiptap/pm/transform";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { ReactNodeViewRenderer } from "@tiptap/react";

import type {
  DocumentSegment,
  DocxParagraphStyle,
  DocxRunStyle,
  HeadingKind,
  PageLayout,
  SegmentLayout,
  SegmentRun,
  SegmentStyle,
} from "../type";
import type { InlinePart } from "./docx-content";
import {
  HEADING_FALLBACKS,
  effectiveStyle,
  partSpec,
  runCss,
  type DocxStyles,
} from "./docx-style";
import {
  PLAIN_RUN,
  nodeToRuns,
  normalizeRuns,
  runsToContent,
  type BaseRun,
} from "./format-marks";
import { PageView } from "./page-view";
import { replaceSegmentText, resolveStyle } from "./segment-style";
import { SegmentView } from "./segment-view";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    segment: {
      /** Merge style overrides into the selected segments; null resets them. */
      setSegmentStyle: (patch: SegmentStyle | null) => ReturnType;
      /** Merge paragraph overrides into every segment of the selected paragraphs. */
      setParagraphStyle: (patch: SegmentStyle) => ReturnType;
      /** Apply a paragraph style, resetting the text formatting to the style's. */
      setHeading: (heading: HeadingKind) => ReturnType;
      /** Remove colour and highlight and reset the toggles to the document's. */
      clearFormatting: () => ReturnType;
      /** Replace the whole text of the segment holding the cursor. */
      setSegmentText: (text: string) => ReturnType;
      restoreSegment: () => ReturnType;
    };
  }
}

/** One page of a PDF: its rendered background, with its segments drawn on top. */
export const Page = Node.create({
  name: "page",
  content: "segment*",
  isolating: true,

  addAttributes() {
    return {
      number: { default: 0, rendered: false },
      width: { default: 595, rendered: false },
      height: { default: 842, rendered: false },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-page]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-page": node.attrs.number }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(PageView);
  },
});

const activeSegmentKey = new PluginKey<DecorationSet>("activeSegment");

/**
 * One translatable segment of the document (a piece of a DOCX paragraph or a
 * PDF line group). The service rebuilds the file by segment key, so segments
 * may be edited and formatted but never split, merged, added or removed: any
 * transaction that changes the document's structure is dropped.
 *
 * PDF segments carry their `layout`; DOCX segments on pages their `run` (the
 * formatting in the file) and `prefix` (fixed content before them), and are
 * drawn inline in their paragraph.
 */
export const Segment = Node.create<{ docx: DocxStyles | null }>({
  name: "segment",
  group: "block",
  content: "text*",
  marks: "_",
  defining: true,

  addOptions() {
    return { docx: null };
  },

  addAttributes() {
    return {
      key: { default: null, rendered: false },
      source: { default: "", rendered: false },
      // The service's translation when the editor opened, for "restore".
      initial: { default: "", rendered: false },
      style: { default: null, rendered: false },
      // Bold, italic, underline and strike of the text in the document.
      base: { default: PLAIN_RUN, rendered: false },
      layout: { default: null, rendered: false },
      run: { default: null, rendered: false },
      prefix: { default: [], rendered: false },
    };
  },

  parseHTML() {
    return [{ tag: "[data-segment-key]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const docx = this.options.docx;
    if (docx && node.attrs.run) return docxSegmentSpec(node, docx);
    return ["p", mergeAttributes(HTMLAttributes, { "data-segment-key": node.attrs.key }), 0];
  },

  addNodeView() {
    const react = ReactNodeViewRenderer(SegmentView, {
      // Re-render when the cursor enters or leaves the segment, not only when it changes.
      update: ({ oldNode, newNode, oldDecorations, newDecorations, updateProps }) => {
        if (newNode.type !== oldNode.type) return false;
        if (newNode !== oldNode || isActive(oldDecorations) !== isActive(newDecorations)) {
          updateProps();
        }
        return true;
      },
    });
    // DOCX segments are plain DOM (renderHTML): there can be thousands of them.
    return (props) => (props.node.attrs.run ? (null as unknown as ReturnType<typeof react>) : react(props));
  },

  addCommands() {
    return {
      setSegmentStyle:
        (patch) =>
        ({ tr, state, dispatch }) => {
          const segments = selectedSegments(state);
          if (dispatch) {
            for (const { node, pos } of segments) {
              const style = patch ? cleanStyle({ ...node.attrs.style, ...patch }) : null;
              tr.setNodeMarkup(pos, undefined, { ...node.attrs, style });
            }
          }
          return segments.length > 0;
        },
      setParagraphStyle:
        (patch) =>
        ({ tr, state, dispatch }) => {
          const segments = selectedParagraphSegments(state);
          if (dispatch) {
            for (const { node, pos } of segments) {
              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                style: cleanStyle({ ...node.attrs.style, ...patch }),
              });
            }
          }
          return segments.length > 0;
        },
      setHeading:
        (heading) =>
        ({ tr, state, dispatch }) => {
          const segments = selectedParagraphSegments(state);
          const docx = this.options.docx;
          if (!docx || !segments.length) return false;
          if (dispatch) {
            for (const { node, pos } of segments) {
              const style = cleanStyle({
                ...node.attrs.style,
                heading,
                family: undefined,
                font_size: undefined,
                color: undefined,
              });
              tr.setNodeMarkup(pos, undefined, { ...node.attrs, style });
              // The text takes the style's own formatting, as in Word.
              const run = headingRun(docx, heading, node.attrs.run as DocxRunStyle);
              setToggles(tr, pos + 1, pos + node.nodeSize - 1, {
                bold: run.bold,
                italic: run.italic,
                underline: run.underline,
                strike: run.strike,
              });
            }
          }
          return true;
        },
      clearFormatting:
        () =>
        ({ tr, state, dispatch }) => {
          const { from, to, empty } = state.selection;
          const segments = selectedSegments(state);
          if (!segments.length) return false;
          if (dispatch) {
            for (const { node, pos } of segments) {
              const start = empty ? pos + 1 : Math.max(from, pos + 1);
              const end = empty ? pos + node.nodeSize - 1 : Math.min(to, pos + node.nodeSize - 1);
              if (end > start) setToggles(tr, start, end, node.attrs.base, true);
              if (empty || (start === pos + 1 && end === pos + node.nodeSize - 1)) {
                const style = cleanStyle({
                  ...node.attrs.style,
                  bold: undefined,
                  italic: undefined,
                  color: undefined,
                  family: undefined,
                  font_size: undefined,
                });
                tr.setNodeMarkup(pos, undefined, { ...node.attrs, style });
              }
            }
            tr.setStoredMarks([]);
          }
          return true;
        },
      setSegmentText:
        (text) =>
        ({ tr, state, dispatch }) => {
          const found = findActiveSegment(state);
          if (!found) return false;
          if (dispatch) replaceSegmentText(tr, found.pos, found.node, text);
          return true;
        },
      restoreSegment:
        () =>
        ({ state, commands }) => {
          const found = findActiveSegment(state);
          if (!found) return false;
          return commands.setSegmentText(found.node.attrs.initial);
        },
    };
  },

  addKeyboardShortcuts() {
    // A new line would need a new segment the document doesn't have.
    const swallow = () => true;
    return {
      Enter: swallow,
      "Shift-Enter": swallow,
      "Mod-Enter": swallow,
      "Mod-\\": () => this.editor.commands.clearFormatting(),
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        filterTransaction: (tr, state) => !tr.docChanged || keepsStructure(tr, state.doc),
        props: {
          // Paste as plain text on one line, so it lands inside one segment.
          handlePaste: (view, event) => {
            const text = event.clipboardData?.getData("text/plain");
            if (text === undefined) return false;
            const tr = view.state.tr;
            const at = deleteAcrossSegments(tr);
            tr.insertText(text.replace(/\s*[\r\n]+\s*/g, " "), at);
            view.dispatch(tr.scrollIntoView());
            return true;
          },
          // Typing over a selection of several segments replaces the text of each.
          handleTextInput: (view, _from, _to, text) => {
            if (!spansSegments(view.state)) return false;
            const tr = view.state.tr;
            const at = deleteAcrossSegments(tr);
            view.dispatch(tr.insertText(text, at).scrollIntoView());
            return true;
          },
          handleKeyDown: (view, event) => {
            if ((event.key === "Backspace" || event.key === "Delete") && spansSegments(view.state)) {
              const tr = view.state.tr;
              deleteAcrossSegments(tr);
              view.dispatch(tr.scrollIntoView());
              return true;
            }
            return false;
          },
          handleDOMEvents: {
            cut: (view, event) => {
              if (!spansSegments(view.state) || !event.clipboardData) return false;
              const { from, to } = view.state.selection;
              event.clipboardData.setData("text/plain", view.state.doc.textBetween(from, to, "\n", " "));
              event.preventDefault();
              const tr = view.state.tr;
              deleteAcrossSegments(tr);
              view.dispatch(tr.scrollIntoView().setMeta("uiEvent", "cut"));
              return true;
            },
          },
          handleDrop: () => true,
        },
      }),
      // Marks the segment holding the cursor, for its node view and styles.
      new Plugin({
        key: activeSegmentKey,
        props: {
          decorations: (state) => {
            const found = findActiveSegment(state);
            if (!found) return DecorationSet.empty;
            return DecorationSet.create(state.doc, [
              Decoration.node(
                found.pos,
                found.pos + found.node.nodeSize,
                { class: "is-active" },
                { active: true },
              ),
            ]);
          },
        },
      }),
    ];
  },
});

// ---------------------------------------------------------------- DOCX rendering

function headingRun(docx: DocxStyles, heading: HeadingKind, run: DocxRunStyle): DocxRunStyle {
  const named = docx.styles[heading];
  if (named) return docx.runStyles[named.run] ?? run;
  if (heading === "normal") return run;
  const fallback = HEADING_FALLBACKS[heading];
  return { ...run, size: fallback.size, bold: fallback.bold, italic: false };
}

function docxSegmentSpec(node: ProseMirrorNode, docx: DocxStyles): DOMOutputSpec {
  const { run } = effectiveStyle(docx, EMPTY_PARAGRAPH_STYLE, node.attrs.run, node.attrs.style);
  const empty = node.content.size === 0;
  const text: DOMOutputSpec = [
    "span",
    {
      class: empty ? "docx-seg-text is-empty" : "docx-seg-text",
      style: runCss(run),
      ...(empty ? { "data-placeholder": node.attrs.source } : {}),
    },
    0,
  ];
  return [
    "span",
    { class: "docx-seg", "data-segment-key": node.attrs.key },
    ...(node.attrs.prefix as InlinePart[]).map((part) => partSpec(part, docx)),
    text,
  ];
}

// Only the run of a segment's style matters for its text; the paragraph is its parent's.
const EMPTY_PARAGRAPH_STYLE: DocxParagraphStyle = {
  align: "left",
  indent_left: 0,
  indent_right: 0,
  indent_first: 0,
  space_before: 0,
  space_after: 0,
  line: { rule: "auto", value: 1 },
  contextual: false,
  shading: null,
  borders: null,
  tabs: [],
};

// ---------------------------------------------------------------- selection helpers

function isActive(decorations: readonly Decoration[]): boolean {
  return decorations.some((decoration) => decoration.spec.active);
}

export function findActiveSegment(
  state: EditorState,
): { node: ProseMirrorNode; pos: number } | null {
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (node.type.name === "segment") return { node, pos: $from.before(depth) };
  }
  return null;
}

/** Segments the selection touches, or the one holding the cursor. */
export function selectedSegments(
  state: EditorState,
): { node: ProseMirrorNode; pos: number }[] {
  const { from, to, empty } = state.selection;
  if (empty) {
    const found = findActiveSegment(state);
    return found ? [found] : [];
  }
  const segments: { node: ProseMirrorNode; pos: number }[] = [];
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (node.type.name !== "segment") return true;
    // A selection that only touches the end of a segment does not select it.
    if (pos + node.nodeSize - 1 > from && pos + 1 < to) segments.push({ node, pos });
    return false;
  });
  return segments;
}

/** Every segment of the paragraphs the selection touches (a PDF segment is its own paragraph). */
function selectedParagraphSegments(
  state: EditorState,
): { node: ProseMirrorNode; pos: number }[] {
  const result = new Map<number, ProseMirrorNode>();
  for (const { node, pos } of selectedSegments(state)) {
    const $pos = state.doc.resolve(pos);
    const parent = $pos.parent;
    if (parent.type.name !== "docxParagraph") {
      result.set(pos, node);
      continue;
    }
    const start = $pos.start();
    parent.forEach((child, offset) => result.set(start + offset, child));
  }
  return [...result].map(([pos, node]) => ({ node, pos }));
}

function spansSegments(state: EditorState): boolean {
  const { $from, $to, empty } = state.selection;
  if (empty) return false;
  return !($from.sameParent($to) && $from.parent.type.name === "segment");
}

/**
 * Delete the selected text of every segment the selection spans, keeping the
 * segments. Returns where the cursor ends up: the start of the selection in
 * the first segment.
 */
function deleteAcrossSegments(tr: Transaction): number {
  const { from, to } = tr.selection;
  const ranges: [number, number][] = [];
  tr.doc.nodesBetween(from, to, (node, pos) => {
    if (node.type.name !== "segment") return true;
    const start = Math.max(from, pos + 1);
    const end = Math.min(to, pos + node.nodeSize - 1);
    if (end >= start) ranges.push([start, end]);
    return false;
  });
  if (!ranges.length) return from;
  for (const [start, end] of [...ranges].reverse()) {
    if (end > start) tr.delete(start, end);
  }
  const at = ranges[0][0];
  tr.setSelection(TextSelection.create(tr.doc, at));
  return at;
}

function markOf(schema: Schema, name: "bold" | "italic" | "underline" | "strike"): Mark {
  return schema.marks[name].create();
}

/** Set bold, italic, underline and strike over a range; optionally drop colour and highlight. */
function setToggles(tr: Transaction, from: number, to: number, toggles: BaseRun, clearColors = false) {
  const { schema } = tr.doc.type;
  for (const name of ["bold", "italic", "underline", "strike"] as const) {
    if (!schema.marks[name]) continue;
    if (toggles[name]) tr.addMark(from, to, markOf(schema, name));
    else tr.removeMark(from, to, schema.marks[name]);
  }
  if (clearColors) {
    if (schema.marks.textStyle) tr.removeMark(from, to, schema.marks.textStyle);
    if (schema.marks.highlight) tr.removeMark(from, to, schema.marks.highlight);
  }
}

function cleanStyle(style: SegmentStyle): SegmentStyle | null {
  const entries = Object.entries(style).filter(([, value]) => value !== undefined);
  return entries.length ? (Object.fromEntries(entries) as SegmentStyle) : null;
}

// ---------------------------------------------------------------- structure lock

/** Typing, deleting and formatting inside one segment cannot change the structure. */
function onlyEditsText(tr: Transaction): boolean {
  return tr.steps.every((step, index) => {
    if (step instanceof AddMarkStep || step instanceof RemoveMarkStep) return true;
    if (!(step instanceof ReplaceStep)) return false;
    let inline = true;
    step.slice.content.forEach((node) => {
      if (!node.isInline) inline = false;
    });
    if (!inline || step.slice.openStart || step.slice.openEnd) return false;
    const doc = tr.docs[index];
    const $from = doc.resolve(step.from);
    const $to = doc.resolve(step.to);
    return $from.sameParent($to) && $from.parent.type.name === "segment";
  });
}

/** Every node but text, in order, with segment keys: what a transaction may not change. */
function structure(doc: ProseMirrorNode): string[] {
  const items: string[] = [];
  doc.descendants((node) => {
    if (node.isText) return false;
    items.push(node.type.name === "segment" ? node.attrs.key : node.type.name);
    return node.type.name !== "segment";
  });
  return items;
}

function keepsStructure(tr: Transaction, before: ProseMirrorNode): boolean {
  if (onlyEditsText(tr)) return true;
  const itemsA = structure(tr.doc);
  const itemsB = structure(before);
  return (
    itemsA.length === itemsB.length &&
    itemsA.every((item, index) => item === itemsB[index])
  );
}

// ---------------------------------------------------------------- content

function segmentContent(
  segment: DocumentSegment,
  layout: SegmentLayout | null,
): JSONContent {
  const base: BaseRun = layout
    ? {
        ...PLAIN_RUN,
        bold: resolveStyle(layout, segment.style).bold,
        italic: resolveStyle(layout, segment.style).italic,
      }
    : PLAIN_RUN;
  return {
    type: "segment",
    attrs: {
      key: segment.key,
      source: segment.source_text,
      initial: segment.translated_text,
      style: segment.style ?? null,
      base,
      layout,
    },
    content: runsToContent(segment.translated_text, segment.runs, base),
  };
}

/**
 * Editor content: a page per PDF page with its segments placed on it, or,
 * without a layout (a layout that doesn't match), one block per segment.
 */
export function segmentsToContent(
  segments: DocumentSegment[],
  pages?: PageLayout[],
): JSONContent {
  const byKey = new Map(segments.map((segment) => [segment.key, segment]));
  const placed = pages?.flatMap((page) => page.segments.map((s) => s.key));
  const matches =
    placed !== undefined &&
    placed.length === segments.length &&
    placed.every((key) => byKey.has(key));

  if (!pages || !matches) {
    return {
      type: "doc",
      content: segments.map((segment) => segmentContent(segment, null)),
    };
  }

  return {
    type: "doc",
    content: pages.map((page) => ({
      type: "page",
      attrs: { number: page.page, width: page.width, height: page.height },
      content: page.segments.map((layout) =>
        segmentContent(byKey.get(layout.key)!, layout),
      ),
    })),
  };
}

export interface SegmentValue {
  text: string;
  style: SegmentStyle | null;
  /** Null when the text keeps its formatting in the document. */
  runs: SegmentRun[] | null;
}

/** Current translated text, style overrides and formatting of every segment, by key. */
export function readSegments(doc: ProseMirrorNode): Map<string, SegmentValue> {
  const values = new Map<string, SegmentValue>();
  doc.descendants((node) => {
    if (node.type.name !== "segment") return true;
    values.set(node.attrs.key, {
      text: node.textContent,
      style: node.attrs.style,
      runs: normalizeRuns(nodeToRuns(node), node.attrs.base ?? PLAIN_RUN),
    });
    return false;
  });
  return values;
}

export function sameStyle(
  a: SegmentStyle | null | undefined,
  b: SegmentStyle | null | undefined,
): boolean {
  const keys = new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})]);
  return [...keys].every(
    (key) =>
      (a as Record<string, unknown> | null)?.[key] ===
      (b as Record<string, unknown> | null)?.[key],
  );
}
