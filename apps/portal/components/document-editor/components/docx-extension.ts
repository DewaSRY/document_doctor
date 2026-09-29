import { Node, type Extension } from "@tiptap/core";

import type { DocxBorder } from "../type";
import type { DocxMarker, DocxSetup, InlinePart } from "./docx-content";
import { DocxPagination, type PaginationStore } from "./docx-pagination";
import {
  borderCss,
  insetCss,
  markerSpec,
  paragraphCss,
  paragraphStyleOf,
  partSpec,
  pt,
  type DocxStyles,
} from "./docx-style";

/**
 * Nodes of a Word document shown on pages. Only segments hold editable text;
 * paragraphs, tables, cells, text boxes and headers are fixed structure that
 * carries the document's formatting as attributes.
 */

export const DocxParagraph = Node.create<{ docx: DocxStyles }>({
  name: "docxParagraph",
  group: "docxBlock",
  content: "segment*",
  selectable: false,
  draggable: false,

  addOptions() {
    return { docx: null as unknown as DocxStyles };
  },

  addAttributes() {
    return {
      style: { default: null, rendered: false },
      mark: { default: null, rendered: false },
      heading: { default: null, rendered: false },
      marker: { default: null, rendered: false },
      suffix: { default: [], rendered: false },
      tabCount: { default: 0, rendered: false },
      breakBefore: { default: false, rendered: false },
      breakAfter: { default: false, rendered: false },
      section: { default: 0, rendered: false },
      inset: { default: null, rendered: false },
      bodyIndex: { default: null, rendered: false },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-docx-p]" }];
  },

  renderHTML({ node }) {
    const docx = this.options.docx;
    const { paragraph, run } = paragraphStyleOf(node, docx);
    const marker = node.attrs.marker as DocxMarker | null;
    return [
      "div",
      {
        "data-docx-p": "",
        class: "docx-p",
        style: `${paragraphCss(paragraph, run)} ${insetCss(node.attrs.inset)}`,
      },
      ...(marker ? markerSpec(marker) : []),
      ["span", { class: "docx-p-content" }, 0],
      ...(node.attrs.suffix as InlinePart[]).map((part) =>
        partSpec(part, docx),
      ),
    ];
  },
});

export const DocxTable = Node.create({
  name: "docxTable",
  group: "docxBlock",
  content: "docxRow+",
  isolating: true,
  selectable: false,
  draggable: false,

  addAttributes() {
    return {
      columns: { default: [], rendered: false },
      rows: { default: [], rendered: false },
      section: { default: 0, rendered: false },
      inset: { default: null, rendered: false },
      bodyIndex: { default: null, rendered: false },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-docx-table]" }];
  },

  renderHTML({ node }) {
    const columns = (node.attrs.columns as number[]).map(pt).join(" ");
    const rows = (node.attrs.rows as (number | null)[])
      .map((height) => (height ? `minmax(${pt(height)}, auto)` : "auto"))
      .join(" ");
    return [
      "div",
      {
        "data-docx-table": "",
        class: "docx-table",
        style: `grid-template-columns: ${columns}; grid-template-rows: ${rows}; ${insetCss(node.attrs.inset)}`,
      },
      0,
    ];
  },
});

export const DocxRow = Node.create({
  name: "docxRow",
  content: "docxCell*",
  selectable: false,

  addAttributes() {
    return { header: { default: false, rendered: false } };
  },

  parseHTML() {
    return [{ tag: "div[data-docx-row]" }];
  },

  renderHTML() {
    return ["div", { "data-docx-row": "", class: "docx-row" }, 0];
  },
});

export const DocxCell = Node.create({
  name: "docxCell",
  content: "docxBlock*",
  isolating: true,
  selectable: false,

  addAttributes() {
    return {
      row: { default: 0, rendered: false },
      col: { default: 0, rendered: false },
      span: { default: 1, rendered: false },
      rowSpan: { default: 1, rendered: false },
      shading: { default: null, rendered: false },
      valign: { default: "top", rendered: false },
      margin: {
        default: { top: 0, right: 5.4, bottom: 0, left: 5.4 },
        rendered: false,
      },
      borders: { default: {}, rendered: false },
      last: { default: { right: false, bottom: false }, rendered: false },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-docx-cell]" }];
  },

  renderHTML({ node }) {
    const { row, col, span, rowSpan, shading, valign, margin, last } =
      node.attrs;
    const borders = node.attrs.borders as Record<string, DocxBorder | null>;
    // Neighbouring cells share an edge; each cell draws its top and left one.
    const edges =
      borderCss("top", borders.top) +
      borderCss("left", borders.left) +
      (last.right ? borderCss("right", borders.right) : "") +
      (last.bottom ? borderCss("bottom", borders.bottom) : "");
    return [
      "div",
      {
        "data-docx-cell": "",
        class: "docx-cell",
        style:
          `grid-column: ${col + 1} / span ${span}; grid-row: ${row + 1} / span ${rowSpan}; ` +
          `padding: ${pt(margin.top)} ${pt(margin.right)} ${pt(margin.bottom)} ${pt(margin.left)}; ` +
          `justify-content: ${valign === "center" ? "center" : valign === "bottom" ? "flex-end" : "flex-start"}; ` +
          (shading ? `background-color: ${shading}; ` : "") +
          edges,
      },
      0,
    ];
  },
});

/** A text box, shown in the flow after the paragraph it is anchored to. */
export const DocxFrame = Node.create({
  name: "docxFrame",
  group: "docxBlock",
  content: "docxBlock*",
  isolating: true,
  selectable: false,

  addAttributes() {
    return {
      width: { default: 0, rendered: false },
      height: { default: 0, rendered: false },
      fill: { default: null, rendered: false },
      border: { default: null, rendered: false },
      section: { default: 0, rendered: false },
      inset: { default: null, rendered: false },
      bodyIndex: { default: null, rendered: false },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-docx-frame]" }];
  },

  renderHTML({ node }) {
    const { width, height, fill, border, inset } = node.attrs;
    return [
      "div",
      {
        "data-docx-frame": "",
        class: "docx-frame",
        style:
          (inset ? insetCss(inset) : `width: ${pt(width)};`) +
          ` min-height: ${pt(height)}; padding: ${pt(3.6)} ${pt(7.2)};` +
          (fill ? ` background-color: ${fill};` : "") +
          (border
            ? ` ${borderCss("top", border)}${borderCss("right", border)}${borderCss("bottom", border)}${borderCss("left", border)}`
            : ""),
      },
      0,
    ];
  },
});

/** A header or footer; the pagination places it on its first page and draws copies on the others. */
export const DocxRegion = Node.create({
  name: "docxRegion",
  content: "docxBlock*",
  isolating: true,
  selectable: false,

  addAttributes() {
    return {
      id: { default: "", rendered: false },
      kind: { default: "header", rendered: false },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-docx-region]" }];
  },

  renderHTML({ node }) {
    return [
      "div",
      {
        "data-docx-region": node.attrs.id,
        "data-kind": node.attrs.kind,
        class: "docx-region",
      },
      0,
    ];
  },
});

export function docxExtensions(
  docx: DocxStyles,
  setup: DocxSetup,
  pagination: PaginationStore,
): Extension[] {
  return [
    DocxParagraph.configure({ docx }),
    DocxTable,
    DocxRow,
    DocxCell,
    DocxFrame,
    DocxRegion,
    DocxPagination.configure({ setup, store: pagination, docx }),
  ] as unknown as Extension[];
}
