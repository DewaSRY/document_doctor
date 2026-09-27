import { Node, mergeAttributes, type JSONContent } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, type EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { ReactNodeViewRenderer } from "@tiptap/react";

import type {
  DocumentSegment,
  PageLayout,
  SegmentLayout,
  SegmentStyle,
} from "../type";
import { PageView } from "./page-view";
import { replaceSegmentText, resolveStyle } from "./segment-style";
import { SegmentView } from "./segment-view";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    segment: {
      /** Merge style overrides into the selected segments; null resets them. */
      setSegmentStyle: (patch: SegmentStyle | null) => ReturnType;
      toggleSegmentStyle: (name: "bold" | "italic") => ReturnType;
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
 * One translatable segment of the document (a DOCX paragraph or a PDF line
 * group). The service rebuilds the file by segment key, so segments may be
 * edited but never split, merged, added or removed: any transaction that
 * changes the list of keys is dropped. PDF segments carry their `layout`.
 */
export const Segment = Node.create({
  name: "segment",
  group: "block",
  content: "text*",
  marks: "",
  defining: true,

  addAttributes() {
    return {
      key: { default: null, rendered: false },
      source: { default: "", rendered: false },
      // The service's translation when the editor opened, for "restore".
      initial: { default: "", rendered: false },
      style: { default: null, rendered: false },
      layout: { default: null, rendered: false },
    };
  },

  parseHTML() {
    return [{ tag: "p[data-segment-key]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "p",
      mergeAttributes(HTMLAttributes, { "data-segment-key": node.attrs.key }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(SegmentView, {
      // Re-render when the cursor enters or leaves the segment, not only when it changes.
      update: ({ oldNode, newNode, oldDecorations, newDecorations, updateProps }) => {
        if (newNode.type !== oldNode.type) return false;
        if (newNode !== oldNode || isActive(oldDecorations) !== isActive(newDecorations)) {
          updateProps();
        }
        return true;
      },
    });
  },

  addCommands() {
    return {
      setSegmentStyle:
        (patch) =>
        ({ tr, state, dispatch }) => {
          const { from, to } = state.selection;
          let found = false;
          state.doc.nodesBetween(from, to, (node, pos) => {
            if (node.type.name !== "segment") return true;
            if (!node.attrs.layout) return false;
            found = true;
            if (dispatch) {
              const style = patch ? cleanStyle({ ...node.attrs.style, ...patch }) : null;
              tr.setNodeMarkup(pos, undefined, { ...node.attrs, style });
            }
            return false;
          });
          return found;
        },
      toggleSegmentStyle:
        (name) =>
        ({ state, commands }) => {
          const found = findActiveSegment(state);
          if (!found?.node.attrs.layout) return false;
          const current = resolveStyle(found.node.attrs.layout, found.node.attrs.style)[name];
          return commands.setSegmentStyle({ [name]: !current });
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
      "Mod-b": () => this.editor.commands.toggleSegmentStyle("bold"),
      "Mod-i": () => this.editor.commands.toggleSegmentStyle("italic"),
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        filterTransaction: (tr, state) =>
          !tr.docChanged || sameStructure(tr.doc, state.doc),
        props: {
          // Paste as plain text on one line, so it lands inside one segment.
          handlePaste: (view, event) => {
            const text = event.clipboardData?.getData("text/plain");
            if (text === undefined) return false;
            view.dispatch(
              view.state.tr.insertText(text.replace(/\s*[\r\n]+\s*/g, " ")),
            );
            return true;
          },
          handleDrop: () => true,
        },
      }),
      // Marks the segment holding the cursor, for its node view.
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
                {},
                { active: true },
              ),
            ]);
          },
        },
      }),
    ];
  },
});

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

function cleanStyle(style: SegmentStyle): SegmentStyle | null {
  const entries = Object.entries(style).filter(([, value]) => value !== undefined);
  return entries.length ? (Object.fromEntries(entries) as SegmentStyle) : null;
}

/** Pages and segment keys, in order: what a transaction may not change. */
function structure(doc: ProseMirrorNode): string[] {
  const items: string[] = [];
  doc.descendants((node) => {
    if (node.type.name === "page") items.push(`page:${node.attrs.number}`);
    if (node.type.name === "segment") {
      items.push(node.attrs.key);
      return false;
    }
    return true;
  });
  return items;
}

function sameStructure(a: ProseMirrorNode, b: ProseMirrorNode): boolean {
  const itemsA = structure(a);
  const itemsB = structure(b);
  return (
    itemsA.length === itemsB.length &&
    itemsA.every((item, index) => item === itemsB[index])
  );
}

function segmentContent(
  segment: DocumentSegment,
  layout: SegmentLayout | null,
): JSONContent {
  return {
    type: "segment",
    attrs: {
      key: segment.key,
      source: segment.source_text,
      initial: segment.translated_text,
      style: segment.style ?? null,
      layout,
    },
    content: segment.translated_text
      ? [{ type: "text", text: segment.translated_text }]
      : [],
  };
}

/**
 * Editor content: a page per PDF page with its segments placed on it, or,
 * without a layout (DOCX, or a layout that doesn't match), one block per segment.
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
}

/** Current translated text and style overrides of every segment, by key. */
export function readSegments(doc: ProseMirrorNode): Map<string, SegmentValue> {
  const values = new Map<string, SegmentValue>();
  doc.descendants((node) => {
    if (node.type.name !== "segment") return true;
    values.set(node.attrs.key, { text: node.textContent, style: node.attrs.style });
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
