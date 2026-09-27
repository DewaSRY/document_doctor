import { Node, mergeAttributes, type JSONContent } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin } from "@tiptap/pm/state";
import { ReactNodeViewRenderer } from "@tiptap/react";

import type { DocumentSegment } from "../type";
import { SegmentView } from "./segment-view";

/**
 * One translatable segment of the document (a DOCX paragraph or a PDF line
 * group). The service rebuilds the file by segment key, so segments may be
 * edited but never split, merged, added or removed: any transaction that
 * changes the list of keys is dropped.
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
    return ReactNodeViewRenderer(SegmentView);
  },

  addKeyboardShortcuts() {
    // A new line would need a new segment the document doesn't have.
    const swallow = () => true;
    return { Enter: swallow, "Shift-Enter": swallow, "Mod-Enter": swallow };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        filterTransaction: (tr, state) =>
          !tr.docChanged || sameSegmentKeys(tr.doc, state.doc),
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
    ];
  },
});

function segmentKeys(doc: ProseMirrorNode): string[] {
  const keys: string[] = [];
  doc.forEach((node) => keys.push(node.attrs.key));
  return keys;
}

function sameSegmentKeys(a: ProseMirrorNode, b: ProseMirrorNode): boolean {
  if (a.childCount !== b.childCount) return false;
  const keysA = segmentKeys(a);
  const keysB = segmentKeys(b);
  return keysA.every((key, index) => key === keysB[index]);
}

export function segmentsToContent(segments: DocumentSegment[]): JSONContent {
  return {
    type: "doc",
    content: segments.map((segment) => ({
      type: "segment",
      attrs: { key: segment.key, source: segment.source_text },
      content: segment.translated_text
        ? [{ type: "text", text: segment.translated_text }]
        : [],
    })),
  };
}

/** Current translated text of every segment, by key. */
export function readSegmentTexts(doc: ProseMirrorNode): Map<string, string> {
  const texts = new Map<string, string>();
  doc.forEach((node) => texts.set(node.attrs.key, node.textContent));
  return texts;
}
