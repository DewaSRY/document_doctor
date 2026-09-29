import type { JSONContent } from "@tiptap/core";

import type {
  DocumentSegment,
  DocxAnchor,
  DocxBlock,
  DocxLayout,
  DocxParagraph,
  DocxRunStyle,
  DocxSection,
  InsertedBlock,
} from "../type";
import { runsToContent, type BaseRun } from "./format-marks";
import { placeInsertions } from "./insert-content";

/** Content of a paragraph that is not translated, as a node attribute. */
export type InlinePart =
  | { type: "text"; text: string; run: DocxRunStyle }
  | { type: "field"; field: "page" | "pages"; run: DocxRunStyle }
  | { type: "tab"; index: number }
  | { type: "break" }
  | {
      type: "image";
      src: string | null;
      width: number;
      height: number;
      alt: string;
      /** Paragraph-relative placement of a floating image. */
      float: {
        mode: "left" | "right" | "absolute";
        x: number;
        y: number;
        behind: boolean;
      } | null;
    };

export interface DocxMarker {
  text: string;
  run: DocxRunStyle;
  /** Index of the tab after the marker, if it is followed by one. */
  tab: number | null;
  space: boolean;
}

/** Horizontal place of a top-level block on its page. */
export interface Inset {
  left: number;
  width: number;
}

/** Page geometry the pagination needs, per section. */
export interface DocxSetup {
  sections: Pick<
    DocxSection,
    "page" | "margin" | "break" | "title_page" | "header" | "footer"
  >[];
  regions: { id: string; kind: "header" | "footer" }[];
  defaultTab: number;
}

export function baseRunOf(run: DocxRunStyle): BaseRun {
  return {
    bold: run.bold,
    italic: run.italic,
    underline: run.underline,
    strike: run.strike,
  };
}

/**
 * Editor content of a Word document: its headers and footers (placed on the
 * pages by the pagination), then the body, with each translatable piece of
 * text a segment, and the blocks the user added in their places. Returns null
 * when a segment would be missing, so the caller can fall back to editing blocks.
 */
export function docxToContent(
  layout: DocxLayout,
  segments: DocumentSegment[],
  insertions: InsertedBlock[] = [],
): { content: JSONContent; setup: DocxSetup } | null {
  const byKey = new Map(segments.map((segment) => [segment.key, segment]));
  const placed = new Set<string>();
  const runs = layout.run_styles;
  const run = (index: number) => runs[index] ?? runs[0];

  function segmentNode(
    key: string,
    runStyle: DocxRunStyle,
    prefix: InlinePart[],
  ): JSONContent | null {
    const segment = byKey.get(key);
    if (!segment || placed.has(key)) return null;
    placed.add(key);
    const base = baseRunOf(runStyle);
    return {
      type: "segment",
      attrs: {
        key,
        source: segment.source_text,
        initial: segment.translated_text,
        style: segment.style ?? null,
        run: runStyle,
        base,
        prefix,
      },
      content: runsToContent(segment.translated_text, segment.runs, base),
    };
  }

  function anchor(
    position: DocxAnchor | null,
    margin: { left: number; top: number },
  ) {
    if (!position || position.wrap === "topandbottom") return null;
    const { x, y } = position;
    if (
      (position.wrap === "square" ||
        position.wrap === "tight" ||
        position.wrap === "through") &&
      x.align
    ) {
      if (x.align === "right" || x.align === "outside")
        return { mode: "right" as const, x: 0, y: 0, behind: false };
      if (x.align === "left" || x.align === "inside")
        return { mode: "left" as const, x: 0, y: 0, behind: false };
    }
    // Positions are relative to the page, the margin or the paragraph; the
    // paragraph starts at the left margin.
    const left = x.relative === "page" ? x.offset - margin.left : x.offset;
    const top =
      y.relative === "paragraph" || y.relative === "line"
        ? y.offset
        : y.relative === "page"
          ? y.offset - margin.top
          : y.offset;
    return {
      mode: "absolute" as const,
      x: left,
      y: top,
      behind: position.behind,
    };
  }

  function paragraph(
    block: DocxParagraph,
    inset: Inset | null,
    section: number,
    margin: { left: number; top: number },
  ): JSONContent {
    let tabs = 0;
    let prefix: InlinePart[] = [];
    const content: JSONContent[] = [];

    const marker: DocxMarker | null = block.marker
      ? {
          text: block.marker.text,
          run: run(block.marker.run),
          tab: block.marker.suffix === "tab" ? tabs++ : null,
          space: block.marker.suffix === "space",
        }
      : null;

    for (const part of block.parts) {
      switch (part.type) {
        case "segment": {
          const node = segmentNode(part.key, run(part.run), prefix);
          if (node) {
            content.push(node);
            prefix = [];
          }
          break;
        }
        case "text":
          prefix.push({ type: "text", text: part.text, run: run(part.run) });
          break;
        case "field":
          prefix.push({ type: "field", field: part.field, run: run(part.run) });
          break;
        case "tab":
          prefix.push({ type: "tab", index: tabs++ });
          break;
        case "break":
          prefix.push({ type: "break" });
          break;
        case "image":
          prefix.push({
            type: "image",
            src: part.src,
            width: part.width,
            height: part.height,
            alt: part.alt,
            float: anchor(part.position, margin),
          });
          break;
      }
    }

    return {
      type: "docxParagraph",
      attrs: {
        style: block.style,
        mark: run(block.run),
        heading: block.heading,
        marker,
        suffix: prefix,
        tabCount: tabs,
        breakBefore: block.break_before,
        breakAfter: block.break_after,
        section,
        inset,
      },
      content,
    };
  }

  function blocks(
    items: DocxBlock[],
    inset: Inset | null,
    section: number,
    margin: { left: number; top: number },
  ): JSONContent[] {
    const result: JSONContent[] = [];
    const paragraphs = applyContextualSpacing(items);
    for (const block of paragraphs) {
      if (block.type === "paragraph") {
        result.push(paragraph(block, inset, section, margin));
      } else if (block.type === "table") {
        const width = block.columns.reduce((sum, column) => sum + column, 0);
        const available = inset?.width ?? width;
        const offset =
          block.align === "center"
            ? (available - width) / 2
            : block.align === "right"
              ? available - width
              : block.indent;
        result.push({
          type: "docxTable",
          attrs: {
            columns: block.columns,
            rows: block.rows.map((row) => row.height),
            section,
            inset: {
              left:
                (inset?.left ?? 0) + Math.max(offset, inset ? -inset.left : 0),
              width,
            },
          },
          content: block.rows.map((row, index) => ({
            type: "docxRow",
            attrs: { header: row.header },
            content: row.cells.map((cell) => ({
              type: "docxCell",
              attrs: {
                row: index,
                col: cell.col,
                span: cell.span,
                rowSpan: cell.row_span,
                shading: cell.shading,
                valign: cell.valign,
                margin: cell.margin,
                borders: cell.borders,
                last: {
                  right: cell.col + cell.span >= block.columns.length,
                  bottom: index + cell.row_span >= block.rows.length,
                },
              },
              content: blocks(cell.blocks, null, section, margin),
            })),
          })),
        });
      } else {
        result.push({
          type: "docxFrame",
          attrs: {
            width: block.width,
            height: block.height,
            fill: block.fill,
            border: block.border,
            section,
            inset: inset
              ? {
                  left:
                    inset.left +
                    Math.max(
                      0,
                      Math.min(
                        anchorLeft(block.position, margin),
                        inset.width - block.width,
                      ),
                    ),
                  width: Math.min(block.width, inset.width),
                }
              : null,
          },
          content: blocks(block.blocks, null, section, margin),
        });
      }
    }
    return result;
  }

  const regions: DocxSetup["regions"] = [];
  const kinds = new Map<string, "header" | "footer">();
  for (const section of layout.sections) {
    for (const id of [section.header.default, section.header.first])
      if (id) kinds.set(id, "header");
    for (const id of [section.footer.default, section.footer.first])
      if (id) kinds.set(id, "footer");
  }
  const regionContent: JSONContent[] = [];
  for (const [id, items] of Object.entries(layout.headers)) {
    const kind = kinds.get(id) ?? (id.includes("footer") ? "footer" : "header");
    const section =
      layout.sections.find((s) =>
        [
          s.header.default,
          s.header.first,
          s.footer.default,
          s.footer.first,
        ].includes(id),
      ) ?? layout.sections[0];
    regions.push({ id, kind });
    regionContent.push({
      type: "docxRegion",
      attrs: { id, kind },
      content: blocks(items, null, 0, {
        left: section.margin.left,
        top: section.margin.header,
      }),
    });
  }

  const body: JSONContent[] = [];
  layout.sections.forEach((section, index) => {
    const inset = {
      left: section.margin.left,
      width: section.page.width - section.margin.left - section.margin.right,
    };
    const nodes = blocks(section.blocks, inset, index, {
      left: section.margin.left,
      top: section.margin.top,
    });
    // One node per block: inserted blocks are placed by the body index of the one before them.
    nodes.forEach((node, at) => {
      node.attrs = { ...node.attrs, bodyIndex: section.blocks[at].body_index ?? null };
    });
    body.push(...nodes);
  });
  if (!body.length) return null;

  // Text the layout does not place (it should place all of it) stays editable at the end.
  const last = layout.sections.at(-1)!;
  const lastInset = {
    left: last.margin.left,
    width: last.page.width - last.margin.left - last.margin.right,
  };
  for (const segment of segments) {
    if (placed.has(segment.key)) continue;
    const mark = layout.run_styles[0];
    const node = segmentNode(segment.key, mark, []);
    if (!node) return null;
    body.push({
      type: "docxParagraph",
      attrs: {
        style: EMPTY_PARAGRAPH,
        mark,
        heading: null,
        marker: null,
        suffix: [],
        tabCount: 0,
        breakBefore: false,
        breakAfter: false,
        section: layout.sections.length - 1,
        inset: lastInset,
      },
      content: [node],
    });
  }

  return {
    content: {
      type: "doc",
      content: [...regionContent, ...placeInsertions(body, insertions)],
    },
    setup: {
      sections: layout.sections.map(
        ({ page, margin, break: kind, title_page, header, footer }) => ({
          page,
          margin,
          break: kind,
          title_page,
          header,
          footer,
        }),
      ),
      regions,
      defaultTab: layout.default_tab,
    },
  };
}

function anchorLeft(
  position: DocxAnchor | null,
  margin: { left: number },
): number {
  if (!position) return 0;
  return position.x.relative === "page"
    ? position.x.offset - margin.left
    : position.x.offset;
}

export const EMPTY_PARAGRAPH = {
  align: "left",
  indent_left: 0,
  indent_right: 0,
  indent_first: 0,
  space_before: 0,
  space_after: 8,
  line: { rule: "auto", value: 1.08 },
  contextual: false,
  shading: null,
  borders: null,
  tabs: [],
} as const;

/** Word ignores the spacing between paragraphs of one style that ask for "contextual" spacing. */
function applyContextualSpacing(blocks: DocxBlock[]): DocxBlock[] {
  const result = blocks.map((block) =>
    block.type === "paragraph"
      ? { ...block, style: { ...block.style } }
      : block,
  );
  for (let index = 1; index < result.length; index++) {
    const previous = result[index - 1];
    const current = result[index];
    if (
      previous.type !== "paragraph" ||
      current.type !== "paragraph" ||
      previous.style_id !== current.style_id
    ) {
      continue;
    }
    if (current.style.contextual) current.style.space_before = 0;
    if (previous.style.contextual) previous.style.space_after = 0;
  }
  return result;
}
