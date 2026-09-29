import type { JSONContent } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

import type {
  InsertedBlock,
  InsertedTextKind,
  RunStyle,
  SegmentRun,
} from "../type";
import { PLAIN_RUN, nodeToRuns, runsToContent } from "./format-marks";

/**
 * Blocks a user adds to a Word document, as editor content and back. Unlike
 * segments they are free to be added, split, moved and removed: the service
 * writes them into the rebuilt file after the element of the original body
 * that precedes them (see docx_insertions.py).
 */

/** Node types of inserted content; the structure lock ignores them. */
export const INSERTED_NODES = new Set([
  "insParagraph",
  "insImage",
  "insDivider",
  "insPageBreak",
  "table",
  "tableRow",
  "tableCell",
  "tableHeader",
]);

export function isInserted(node: ProseMirrorNode): boolean {
  return INSERTED_NODES.has(node.type.name);
}

export const LIST_KINDS: InsertedTextKind[] = ["bullet", "numbered", "todo"];
export const MAX_LEVEL = 4;

function runsContent(runs: SegmentRun[]): JSONContent[] {
  return runsToContent(runs.map((run) => run.text).join(""), runs, PLAIN_RUN);
}

/** A cell's paragraphs, or a top-level paragraph when `section` is set. */
export function paragraphContent(
  kind: InsertedTextKind,
  runs: SegmentRun[],
  attrs: { section: number | null; align?: string | null; level?: number; checked?: boolean },
): JSONContent {
  const content = runsContent(runs);
  return {
    type: "insParagraph",
    attrs: {
      kind,
      align: attrs.align ?? null,
      level: attrs.level ?? 0,
      checked: attrs.checked ?? false,
      section: attrs.section,
    },
    ...(content.length ? { content } : {}),
  };
}

/** An empty table of `rows` × `cols`, its first row a header. */
export function tableContent(rows: number, cols: number, section: number): JSONContent {
  return {
    type: "table",
    attrs: { section },
    content: Array.from({ length: rows }, (_, row) => ({
      type: "tableRow",
      content: Array.from({ length: cols }, () => ({
        type: row === 0 ? "tableHeader" : "tableCell",
        content: [paragraphContent("normal", [], { section: null })],
      })),
    })),
  };
}

export function insertedBlockContent(block: InsertedBlock, section: number): JSONContent {
  switch (block.type) {
    case "paragraph":
      return paragraphContent(block.kind, block.runs, {
        section,
        align: block.align,
        level: block.level,
        checked: block.checked,
      });
    case "table":
      return {
        type: "table",
        attrs: { section },
        content: block.rows.map((row, index) => ({
          type: "tableRow",
          content: row.cells.map((cell) => ({
            type: block.header_row && index === 0 ? "tableHeader" : "tableCell",
            content: (cell.paragraphs.length ? cell.paragraphs : [[]]).map((runs) =>
              paragraphContent("normal", runs, { section: null }),
            ),
          })),
        })),
      };
    case "image":
      return {
        type: "insImage",
        attrs: {
          src: block.src,
          width: block.width,
          height: block.height,
          align: block.align,
          alt: block.alt,
          section,
        },
      };
    case "divider":
      return { type: "insDivider", attrs: { section } };
    case "page_break":
      return { type: "insPageBreak", attrs: { section } };
  }
}

/**
 * The body with the inserted blocks in place: each goes after every block of
 * the original body up to its anchor, before the first one past it.
 */
export function placeInsertions(body: JSONContent[], blocks: InsertedBlock[]): JSONContent[] {
  if (!blocks.length) return body;
  const pending = blocks
    .map((block, order) => ({ block, order }))
    .sort((a, b) => a.block.after - b.block.after || a.order - b.order);
  const result: JSONContent[] = [];
  let next = 0;
  let section = (body[0]?.attrs?.section as number | undefined) ?? 0;
  for (const node of body) {
    const index = (node.attrs?.bodyIndex as number | null | undefined) ?? Infinity;
    while (next < pending.length && pending[next].block.after < index) {
      result.push(insertedBlockContent(pending[next++].block, section));
    }
    result.push(node);
    section = (node.attrs?.section as number | undefined) ?? section;
  }
  while (next < pending.length) {
    result.push(insertedBlockContent(pending[next++].block, section));
  }
  return result;
}

/** Only what differs from plain text: the paragraph's style shows through the rest. */
function compactRuns(node: ProseMirrorNode): SegmentRun[] {
  return nodeToRuns(node).map(({ text, style }) => {
    const compact: RunStyle = {};
    for (const name of ["bold", "italic", "underline", "strike"] as const) {
      if (style?.[name]) compact[name] = true;
    }
    if (style?.color) compact.color = style.color;
    if (style?.highlight) compact.highlight = style.highlight;
    return Object.keys(compact).length ? { text, style: compact } : { text };
  });
}

/** The inserted blocks of the editor's document, in order, each with its anchor. */
export function readInsertions(doc: ProseMirrorNode): InsertedBlock[] {
  const blocks: InsertedBlock[] = [];
  let after = -1;
  doc.forEach((node) => {
    const name = node.type.name;
    if (name === "docxRegion") return;
    if (!isInserted(node)) {
      const index = node.attrs.bodyIndex as number | null | undefined;
      if (typeof index === "number") after = Math.max(after, index);
      return;
    }
    switch (name) {
      case "insParagraph": {
        const { kind, align, level, checked } = node.attrs;
        blocks.push({
          type: "paragraph",
          after,
          kind,
          runs: compactRuns(node),
          ...(align ? { align } : {}),
          ...(LIST_KINDS.includes(kind) && level ? { level } : {}),
          ...(kind === "todo" && checked ? { checked: true } : {}),
        });
        break;
      }
      case "table": {
        const table: InsertedBlock & { type: "table" } = {
          type: "table",
          after,
          header_row: node.firstChild?.firstChild?.type.name === "tableHeader",
          rows: [],
        };
        node.forEach((row) => {
          const cells: { paragraphs: SegmentRun[][] }[] = [];
          row.forEach((cell) => {
            const paragraphs: SegmentRun[][] = [];
            cell.forEach((paragraph) => paragraphs.push(compactRuns(paragraph)));
            cells.push({ paragraphs });
          });
          if (cells.length) table.rows.push({ cells });
        });
        if (table.rows.length) blocks.push(table);
        break;
      }
      case "insImage": {
        const { src, width, height, align, alt } = node.attrs;
        // Still uploading: saved once it has a name.
        if (src) blocks.push({ type: "image", after, src, width, height, align, alt: alt ?? "" });
        break;
      }
      case "insDivider":
        blocks.push({ type: "divider", after });
        break;
      case "insPageBreak":
        blocks.push({ type: "page_break", after });
        break;
    }
  });
  return blocks;
}

/** How many blocks were added, removed or changed: the larger of the two, so
 *  editing a block counts once. */
export function countInsertionChanges(saved: string[], current: string[]): number {
  const remaining = new Map<string, number>();
  for (const key of saved) remaining.set(key, (remaining.get(key) ?? 0) + 1);
  let added = 0;
  for (const key of current) {
    const count = remaining.get(key) ?? 0;
    if (count) remaining.set(key, count - 1);
    else added++;
  }
  let removed = 0;
  for (const count of remaining.values()) removed += count;
  const moved = added === 0 && removed === 0 && saved.join("\n") !== current.join("\n") ? 1 : 0;
  return Math.max(added, removed, moved);
}
