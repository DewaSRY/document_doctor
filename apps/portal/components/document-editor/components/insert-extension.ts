import { Extension, Node, type Editor, type JSONContent } from "@tiptap/core";
import { Table, TableCell, TableHeader, TableRow, TableView, type TableOptions } from "@tiptap/extension-table";
import type { Node as ProseMirrorNode, NodeType } from "@tiptap/pm/model";
import {
  NodeSelection,
  Plugin,
  PluginKey,
  Selection,
  TextSelection,
  type EditorState,
  type Transaction,
} from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import { ReactNodeViewRenderer } from "@tiptap/react";

import type { DocxParagraphStyle, DocxRunStyle, HeadingKind, InsertedTextKind, UploadedImage } from "../type";
import { EMPTY_PARAGRAPH, type DocxSetup } from "./docx-content";
import { effectiveStyle, fontStack, insetCss, lineHeight, pt, type DocxStyles } from "./docx-style";
import { ImageView } from "./image-view";
import { deleteAcrossSegments } from "./segment-extension";
import { LIST_KINDS, MAX_LEVEL, isInserted, paragraphContent, tableContent } from "./insert-content";

/**
 * Editing of the blocks a user adds to a Word document, like Notion's: Enter
 * starts a new block, "/" opens a menu of block types, Markdown shortcuts
 * ("# ", "- ", "1. ", "[] ", "> ", "```", "---") change a block's type, and
 * images can be pasted or dropped in. Segments stay as they are.
 */

export const HEADING_KINDS: HeadingKind[] = ["normal", "title", "subtitle", "h1", "h2", "h3", "h4", "h5", "h6"];

function isHeading(kind: InsertedTextKind): kind is HeadingKind {
  return (HEADING_KINDS as string[]).includes(kind);
}

// ---------------------------------------------------------------- formatting

/** The document's Normal style, or Word's defaults. */
function normalStyle(docx: DocxStyles): { paragraph: DocxParagraphStyle; run: DocxRunStyle } {
  const named = docx.styles.normal;
  const run = (named && docx.runStyles[named.run]) ?? docx.runStyles[0];
  return { paragraph: named?.style ?? (EMPTY_PARAGRAPH as unknown as DocxParagraphStyle), run };
}

/** Space a list level indents by, and where its marker hangs; the same as the service's Word lists. */
const LIST_INDENT = 36;
const LIST_HANGING = 18;

/** CSS of an inserted paragraph: the document's style for its kind. In a table
 *  cell (`section` null) it has no spacing and no place on the page. */
function paragraphCss(
  docx: DocxStyles,
  setup: DocxSetup,
  attrs: { kind: InsertedTextKind; align: string | null; level: number; section: number | null },
): string {
  const base = normalStyle(docx);
  const { paragraph, run } = isHeading(attrs.kind) && attrs.kind !== "normal"
    ? effectiveStyle(docx, base.paragraph, base.run, { heading: attrs.kind })
    : base;
  const inCell = attrs.section === null;
  let left = inCell ? 0 : paragraph.indent_left;
  if (attrs.kind === "bullet" || attrs.kind === "numbered") left = LIST_INDENT * (attrs.level + 1);
  if (attrs.kind === "todo") left += LIST_HANGING * attrs.level;
  if (attrs.kind === "quote") left += 12;
  const code = attrs.kind === "code";
  const family = code ? "Courier New" : run.family;
  const css = [
    `padding: ${pt(inCell ? 0 : paragraph.space_before)} 0 ${pt(inCell || code ? 0 : paragraph.space_after)} ${pt(left)};`,
    `text-align: ${attrs.align ?? paragraph.align};`,
    `line-height: ${lineHeight(paragraph.line, family)};`,
    `font-family: ${code ? fontStack("Courier New") : fontStack(run.family, run.east_asia)};`,
    `font-size: ${pt(run.size)};`,
    `--marker-left: ${pt(left - LIST_HANGING)};`,
  ];
  if (run.color) css.push(`color: ${run.color};`);
  if (run.bold) css.push("font-weight: 700;");
  if (run.italic) css.push("font-style: italic;");
  if (!inCell) css.push(insetCss(sectionInset(setup, attrs.section ?? 0)));
  return css.join(" ");
}

/** Where the text area of a section's pages is. */
export function sectionInset(setup: DocxSetup, section: number): { left: number; width: number } {
  const { page, margin } = setup.sections[section] ?? setup.sections[0];
  return { left: margin.left, width: page.width - margin.left - margin.right };
}

// ---------------------------------------------------------------- nodes

interface NodeOptions {
  docx: DocxStyles;
  setup: DocxSetup;
}

const sectionAttr = { section: { default: null, rendered: false } };

export const InsParagraph = Node.create<NodeOptions>({
  name: "insParagraph",
  group: "insertedBlock",
  content: "text*",
  marks: "_",
  defining: true,

  addOptions() {
    return { docx: null as unknown as DocxStyles, setup: null as unknown as DocxSetup };
  },

  addAttributes() {
    return {
      kind: { default: "normal", rendered: false },
      align: { default: null, rendered: false },
      level: { default: 0, rendered: false },
      checked: { default: false, rendered: false },
      ...sectionAttr,
    };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-ins-p]",
        contentElement: ".ins-text",
        getAttrs: (element) => ({ kind: (element as HTMLElement).dataset.kind ?? "normal" }),
      },
    ];
  },

  renderHTML({ node }) {
    const { kind, level, checked } = node.attrs;
    return [
      "div",
      {
        "data-ins-p": "",
        "data-kind": kind,
        "data-level": String(level),
        "data-checked": kind === "todo" && checked ? "" : undefined,
        class: "ins-block ins-p",
        style: paragraphCss(this.options.docx, this.options.setup, node.attrs as never),
      },
      ...(kind === "todo"
        ? [["span", { contenteditable: "false", class: "ins-check", role: "checkbox", "aria-checked": String(!!checked) }]]
        : []),
      ["span", { class: "ins-text" }, 0],
    ];
  },
});

function blockCss(setup: DocxSetup, node: ProseMirrorNode): string {
  return insetCss(sectionInset(setup, node.attrs.section ?? 0));
}

export const InsDivider = Node.create<NodeOptions>({
  name: "insDivider",
  group: "insertedBlock",
  atom: true,
  selectable: true,
  draggable: true,

  addOptions() {
    return { docx: null as unknown as DocxStyles, setup: null as unknown as DocxSetup };
  },

  addAttributes() {
    return sectionAttr;
  },

  parseHTML() {
    return [{ tag: "div[data-ins-divider]" }];
  },

  renderHTML({ node }) {
    return [
      "div",
      { "data-ins-divider": "", class: "ins-block ins-divider", style: blockCss(this.options.setup, node) },
      ["hr"],
    ];
  },
});

export const InsPageBreak = Node.create<NodeOptions>({
  name: "insPageBreak",
  group: "insertedBlock",
  atom: true,
  selectable: true,
  draggable: true,

  addOptions() {
    return { docx: null as unknown as DocxStyles, setup: null as unknown as DocxSetup };
  },

  addAttributes() {
    return {
      ...sectionAttr,
      // The pagination starts a new page after it.
      breakAfter: { default: true, rendered: false },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-ins-page-break]" }];
  },

  renderHTML({ node }) {
    return [
      "div",
      { "data-ins-page-break": "", class: "ins-block ins-page-break", style: blockCss(this.options.setup, node) },
    ];
  },
});

export const InsImage = Node.create<NodeOptions>({
  name: "insImage",
  group: "insertedBlock",
  atom: true,
  selectable: true,
  draggable: true,

  addOptions() {
    return { docx: null as unknown as DocxStyles, setup: null as unknown as DocxSetup };
  },

  addAttributes() {
    return {
      src: { default: null, rendered: false },
      width: { default: 100, rendered: false },
      height: { default: 100, rendered: false },
      align: { default: "center", rendered: false },
      alt: { default: "", rendered: false },
      // While uploading: the file shown until it has a name, and what finds the node again.
      preview: { default: null, rendered: false },
      uploadId: { default: null, rendered: false },
      ...sectionAttr,
    };
  },

  parseHTML() {
    return [{ tag: "div[data-ins-image]" }];
  },

  renderHTML({ node }) {
    const { src, width, height, alt } = node.attrs;
    return [
      "div",
      { "data-ins-image": "", class: "ins-block ins-image", style: blockCss(this.options.setup, node) },
      ["img", { src: src ? this.options.docx.mediaHref(src) : "", alt, style: `width: ${pt(width)}; height: ${pt(height)};` }],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageView);
  },
});

/** A table of paragraphs, as wide as the text area, with equal columns. */
class InsTableView extends TableView {
  constructor(
    node: ProseMirrorNode,
    cellMinWidth: number,
    view: EditorView,
    attrs: Record<string, unknown>,
    private setup: DocxSetup,
  ) {
    super(node, cellMinWidth, view, attrs);
    this.dom.classList.add("ins-block", "ins-table");
    this.place(node);
  }

  update(node: ProseMirrorNode): boolean {
    if (!super.update(node)) return false;
    this.place(node);
    return true;
  }

  private place(node: ProseMirrorNode) {
    this.dom.style.cssText = blockCss(this.setup, node);
  }
}

export const InsTable = Table.extend<TableOptions & NodeOptions>({
  group: "insertedBlock",
  draggable: true,

  addOptions() {
    return {
      ...this.parent!(),
      docx: null as unknown as DocxStyles,
      setup: null as unknown as DocxSetup,
    };
  },

  addAttributes() {
    return { ...this.parent?.(), ...sectionAttr };
  },

  addNodeView() {
    const { setup, cellMinWidth } = this.options;
    return ({ node, view, HTMLAttributes }) =>
      new InsTableView(node, cellMinWidth, view, HTMLAttributes, setup) as never;
  },
});

export const InsTableCell = TableCell.extend({ content: "insParagraph+" });
export const InsTableHeader = TableHeader.extend({ content: "insParagraph+" });

// ---------------------------------------------------------------- selection helpers

export interface TopLevel {
  node: ProseMirrorNode;
  pos: number;
  index: number;
}

/** The block of the body the selection starts in; none in a header or footer. */
export function topLevelAt(doc: ProseMirrorNode, selection: Selection): TopLevel | null {
  const { $from } = selection;
  const index = $from.index(0);
  const node = doc.maybeChild(index);
  if (!node || node.type.name === "docxRegion") return null;
  return { node, pos: $from.posAtIndex(index, 0), index };
}

/** The inserted paragraph holding the cursor, top-level or in a table. */
export function insertedParagraphAt(state: EditorState): { node: ProseMirrorNode; pos: number; inCell: boolean } | null {
  const { $from } = state.selection;
  if ($from.parent.type.name !== "insParagraph") return null;
  return { node: $from.parent, pos: $from.before(), inCell: $from.depth > 1 };
}

/** Top-level inserted paragraphs the selection touches. */
function selectedInsertedParagraphs(doc: ProseMirrorNode, selection: Selection): { node: ProseMirrorNode; pos: number }[] {
  const found: { node: ProseMirrorNode; pos: number }[] = [];
  const { from, to } = selection;
  doc.nodesBetween(from, Math.max(to, from + 1), (node, pos, parent) => {
    if (node.type.name === "insParagraph" && parent === doc) found.push({ node, pos });
    return false;
  });
  return found;
}

function paragraphType(state: EditorState | Transaction): NodeType {
  return (state.doc.type.schema.nodes.insParagraph);
}

// ---------------------------------------------------------------- commands

/**
 * Insert blocks after the top-level block holding the selection (an empty
 * inserted paragraph is replaced), and put the cursor in the first place that
 * takes text, adding an empty paragraph after them when there is none.
 */
export function insertBlocks(tr: Transaction, content: JSONContent[]): boolean {
  const found = topLevelAt(tr.doc, tr.selection);
  if (!found) return false;
  const { schema } = tr.doc.type;
  const nodes = content.map((item) => schema.nodeFromJSON(item));
  const { node, pos, index } = found;
  let at: number;
  if (node.type.name === "insParagraph" && node.content.size === 0 && nodes[0].type.name !== "insParagraph") {
    tr.replaceWith(pos, pos + node.nodeSize, nodes);
    at = pos;
  } else {
    at = pos + node.nodeSize;
    // After the text boxes anchored to the paragraph too.
    const bodyIndex = node.attrs.bodyIndex;
    for (let i = index + 1; bodyIndex != null && i < tr.doc.childCount; i++) {
      const next = tr.doc.child(i);
      if (isInserted(next) || next.attrs.bodyIndex !== bodyIndex) break;
      at += next.nodeSize;
    }
    tr.insert(at, nodes);
  }
  const end = at + nodes.reduce((size, item) => size + item.nodeSize, 0);
  if (nodes.at(-1)!.type.name !== "insParagraph" && tr.doc.nodeAt(end)?.type.name !== "insParagraph") {
    tr.insert(end, schema.nodeFromJSON(paragraphContent("normal", [], { section: null })));
  }
  const selection = Selection.findFrom(tr.doc.resolve(at), 1, true);
  if (selection) tr.setSelection(selection);
  tr.scrollIntoView();
  return true;
}

/** Turn the selected inserted paragraphs into `kind`, or back into text when all already are. */
export function setKind(tr: Transaction, kind: InsertedTextKind, toggle = true): boolean {
  const paragraphs = selectedInsertedParagraphs(tr.doc, tr.selection);
  if (!paragraphs.length) return false;
  const next = toggle && paragraphs.every(({ node }) => node.attrs.kind === kind) ? "normal" : kind;
  for (const { node, pos } of paragraphs) {
    tr.setNodeMarkup(pos, undefined, { ...node.attrs, kind: next, checked: false });
  }
  return true;
}

/** Change the nesting of the selected list items. */
export function changeLevel(tr: Transaction, delta: 1 | -1): boolean {
  const items = selectedInsertedParagraphs(tr.doc, tr.selection).filter(({ node }) =>
    LIST_KINDS.includes(node.attrs.kind),
  );
  if (!items.length) return false;
  for (const { node, pos } of items) {
    const level = Math.min(MAX_LEVEL, Math.max(0, node.attrs.level + delta));
    tr.setNodeMarkup(pos, undefined, { ...node.attrs, level });
  }
  return true;
}

/** Set the alignment of the selected inserted paragraphs and images. */
export function setInsertedAlign(tr: Transaction, align: string): boolean {
  let changed = false;
  for (const { node, pos } of selectedInsertedParagraphs(tr.doc, tr.selection)) {
    tr.setNodeMarkup(pos, undefined, { ...node.attrs, align });
    changed = true;
  }
  const { selection } = tr;
  if (selection instanceof NodeSelection && selection.node.type.name === "insImage" && align !== "justify") {
    tr.setNodeMarkup(selection.from, undefined, { ...selection.node.attrs, align });
    changed = true;
  }
  return changed;
}

/** Turn the current block into `kind`, or add a block of that kind after it (from a segment). */
export function applyKind(editor: Editor, kind: InsertedTextKind): boolean {
  return editor
    .chain()
    .focus()
    .command(({ tr }) =>
      setKind(tr, kind) || insertBlocks(tr, [paragraphContent(kind, [], { section: null })]),
    )
    .run();
}

export function insertTable(editor: Editor, rows = 3, cols = 3): boolean {
  return editor.chain().focus().command(({ tr }) => insertBlocks(tr, [tableContent(rows, cols, 0)])).run();
}

export function insertDivider(editor: Editor): boolean {
  return editor.chain().focus().command(({ tr }) => insertBlocks(tr, [{ type: "insDivider" }])).run();
}

export function insertPageBreak(editor: Editor): boolean {
  return editor.chain().focus().command(({ tr }) => insertBlocks(tr, [{ type: "insPageBreak" }])).run();
}

export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif"];

function imageSize(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      resolve({ width: image.naturalWidth || 200, height: image.naturalHeight || 150 });
      URL.revokeObjectURL(url);
    };
    image.onerror = () => {
      resolve({ width: 200, height: 150 });
      URL.revokeObjectURL(url);
    };
    image.src = url;
  });
}

/** An image's size on the page, in points: as the browser shows it, at most the text width. */
export function fitImage(px: { width: number; height: number }, maxWidth: number): { width: number; height: number } {
  const width = px.width * 0.75;
  const height = px.height * 0.75;
  const scale = Math.min(1, maxWidth / width);
  return { width: Math.round(width * scale * 10) / 10, height: Math.round(height * scale * 10) / 10 };
}

/**
 * Add images after the current block, shown from the file while they upload.
 * An image that fails to upload is removed again.
 */
export async function insertImages(editor: Editor, files: File[], at?: number): Promise<void> {
  const storage = editor.extensionManager.extensions.find((e) => e.name === "insertBlocks")?.options as
    | InsertOptions
    | undefined;
  if (!storage?.upload) return;
  const { upload, setup, onError } = storage;
  for (const file of files.filter((item) => IMAGE_TYPES.includes(item.type))) {
    const uploadId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const preview = URL.createObjectURL(file);
    const size = fitImage(await imageSize(file), sectionInset(setup, 0).width);
    const placed = editor
      .chain()
      .focus()
      .command(({ tr }) => {
        if (at !== undefined) {
          tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(at, tr.doc.content.size))));
          at = undefined;
        }
        return insertBlocks(tr, [{ type: "insImage", attrs: { ...size, preview, uploadId, align: "center" } }]);
      })
      .run();
    if (!placed) {
      URL.revokeObjectURL(preview);
      continue;
    }
    const update = (attrs: Record<string, unknown> | null) => {
      if (editor.isDestroyed) return;
      const { state } = editor;
      let target: { node: ProseMirrorNode; pos: number } | null = null;
      state.doc.forEach((node, pos) => {
        if (node.type.name === "insImage" && node.attrs.uploadId === uploadId) target = { node, pos };
      });
      if (!target) return;
      const { node, pos } = target as { node: ProseMirrorNode; pos: number };
      const tr = state.tr.setMeta("addToHistory", false);
      if (attrs) tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...attrs });
      else tr.delete(pos, pos + node.nodeSize);
      editor.view.dispatch(tr);
    };
    upload(file)
      .then((image: UploadedImage) => update({ src: image.name, uploadId: null }))
      .catch(() => {
        update(null);
        URL.revokeObjectURL(preview);
        onError?.("upload");
      });
  }
}

// ---------------------------------------------------------------- slash menu

export interface SlashState {
  active: boolean;
  /** The "/" and the query after it. */
  from: number;
  to: number;
  query: string;
  /** Where a menu the user closed was opened; it stays closed there. */
  dismissed: number | null;
}

const INACTIVE: SlashState = { active: false, from: 0, to: 0, query: "", dismissed: null };

export const slashKey = new PluginKey<SlashState>("slashMenu");

function slashState(state: EditorState, previous: SlashState, close: boolean): SlashState {
  const { selection } = state;
  const { $from } = selection;
  if (!selection.empty || $from.parent.type.name !== "insParagraph" || $from.depth !== 1 || $from.parent.attrs.kind === "code") {
    return { ...INACTIVE, dismissed: null };
  }
  const before = $from.parent.textBetween(Math.max(0, $from.parentOffset - 32), $from.parentOffset, undefined, "\ufffc");
  const match = /(?:^|\s)\/([^\s/]{0,24})$/.exec(before);
  if (!match) return { ...INACTIVE, dismissed: null };
  const from = $from.pos - match[1].length - 1;
  if (close || previous.dismissed === from) return { ...INACTIVE, dismissed: from };
  return { active: true, from, to: $from.pos, query: match[1], dismissed: null };
}

/** Hands the keys the menu uses to it while it is open (SlashMenu connects to it). */
export class SlashKeys {
  private handler: ((key: string) => boolean) | null = null;

  handle(key: string): boolean {
    return this.handler?.(key) ?? false;
  }

  connect(handler: (key: string) => boolean): () => void {
    this.handler = handler;
    return () => {
      if (this.handler === handler) this.handler = null;
    };
  }
}

/** The latest of a callback React passes down, for an extension created once. */
export class Latest<Args extends unknown[], Result> {
  private callback: ((...args: Args) => Result) | undefined;

  set(callback: ((...args: Args) => Result) | undefined) {
    this.callback = callback;
  }

  call = (...args: Args): Result => {
    if (!this.callback) throw new Error("Not available");
    return this.callback(...args);
  };
}

// ---------------------------------------------------------------- the extension

export interface InsertOptions {
  docx: DocxStyles;
  setup: DocxSetup;
  /** Stores an image; without it images cannot be added. */
  upload: ((file: File) => Promise<UploadedImage>) | null;
  onError: ((kind: "upload") => void) | null;
  /** Text shown in an empty block. */
  placeholder: (kind: InsertedTextKind, focused: boolean) => string;
  slashKeys: SlashKeys;
}

/** The kind of the paragraph Enter starts after one of `kind`. */
function nextKind(kind: InsertedTextKind): InsertedTextKind {
  return LIST_KINDS.includes(kind) ? kind : "normal";
}

const MARKDOWN: [RegExp, InsertedTextKind][] = [
  [/^#$/, "h1"],
  [/^##$/, "h2"],
  [/^###$/, "h3"],
  [/^[-*+]$/, "bullet"],
  [/^1[.)]$/, "numbered"],
  [/^\[ ?\]$/, "todo"],
  [/^>$/, "quote"],
];

export const InsertBlocks = Extension.create<InsertOptions>({
  name: "insertBlocks",
  // Before the segment's keys and paste handling.
  priority: 200,

  addOptions() {
    return {
      docx: null as unknown as DocxStyles,
      setup: null as unknown as DocxSetup,
      upload: null,
      onError: null,
      placeholder: () => "",
      slashKeys: new SlashKeys(),
    };
  },

  addKeyboardShortcuts() {
    const editor = this.editor;
    const options = this.options;
    const slashOpen = () => !!slashKey.getState(editor.state)?.active;
    const slash = (key: string) => () => slashOpen() && options.slashKeys.handle(key);

    return {
      ArrowDown: slash("ArrowDown"),
      ArrowUp: slash("ArrowUp"),
      Escape: () => {
        if (!slashOpen()) return false;
        editor.view.dispatch(editor.state.tr.setMeta(slashKey, { close: true }));
        return true;
      },
      Enter: () => {
        if (slashOpen() && options.slashKeys.handle("Enter")) return true;
        const { state } = editor;
        const { $from, $to, empty } = state.selection;
        // A selection into the original document can't be split: its text is deleted, segments kept.
        if (!empty && !$from.sameParent($to)) {
          return editor.chain().command(({ tr }) => {
            deleteAcrossSegments(tr);
            return true;
          }).run();
        }
        const parent = $from.parent;
        // In a paragraph of the original body: a new block below it, like Notion.
        if (parent.type.name === "segment") {
          if ($from.depth !== 2 || $from.node(1).type.name !== "docxParagraph") return false;
          return editor
            .chain()
            .command(({ tr }) => insertBlocks(tr, [paragraphContent("normal", [], { section: null })]))
            .run();
        }
        if (parent.type.name !== "insParagraph") return false;
        const kind = parent.attrs.kind as InsertedTextKind;
        const inCell = $from.depth > 1;
        if (!inCell && parent.content.size === 0 && kind !== "normal") {
          return editor.chain().command(({ tr }) => {
            tr.setNodeMarkup($from.before(), undefined, { ...parent.attrs, kind: "normal", level: 0, checked: false });
            return true;
          }).run();
        }
        if (kind === "code") return editor.chain().command(({ tr }) => !!tr.insertText("\n")).run();
        return editor
          .chain()
          .command(({ tr }) => {
            tr.deleteSelection();
            const type = paragraphType(tr);
            const attrs = { ...parent.attrs, kind: nextKind(kind), checked: false };
            tr.split(tr.selection.from, 1, [{ type, attrs }]);
            tr.scrollIntoView();
            return true;
          })
          .run();
      },
      "Shift-Enter": () => {
        if (editor.state.selection.$from.parent.type.name !== "insParagraph") return false;
        // A line break within the block, saved as one in the file.
        return editor.chain().command(({ tr }) => !!tr.insertText("\n")).run();
      },
      Backspace: () => {
        const { state } = editor;
        const { selection } = state;
        const { $from } = selection;
        if (!selection.empty || $from.parent.type.name !== "insParagraph" || $from.parentOffset > 0) return false;
        const parent = $from.parent;
        if ($from.depth > 1) return $from.index($from.depth - 1) === 0;
        if (parent.attrs.kind !== "normal") {
          return editor.chain().command(({ tr }) => {
            tr.setNodeMarkup($from.before(), undefined, { ...parent.attrs, kind: "normal", level: 0, checked: false });
            return true;
          }).run();
        }
        const index = $from.index(0);
        const previous = index > 0 ? state.doc.child(index - 1) : null;
        if (!previous || previous.type.name === "insParagraph" || previous.isAtom || previous.type.name === "table") {
          return false;
        }
        // Text can't be merged into the original document: an empty block goes,
        // and from one with text the cursor moves to the end of the block before.
        return editor.chain().command(({ tr }) => {
          const pos = $from.before();
          if (parent.content.size === 0) tr.delete(pos, pos + parent.nodeSize);
          tr.setSelection(TextSelection.near(tr.doc.resolve(Math.max(0, pos - 1)), -1));
          return true;
        }).run();
      },
      Delete: () => {
        const { state } = editor;
        const { selection } = state;
        const { $from } = selection;
        const parent = $from.parent;
        if (!selection.empty || parent.type.name !== "insParagraph" || $from.depth > 1) return false;
        if ($from.parentOffset < parent.content.size) return false;
        const next = state.doc.maybeChild($from.index(0) + 1);
        if (!next || isInserted(next)) return false;
        if (parent.content.size > 0) return true;
        return editor.chain().command(({ tr }) => {
          const pos = $from.before();
          tr.delete(pos, pos + parent.nodeSize);
          tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(pos + 1, tr.doc.content.size)), 1));
          return true;
        }).run();
      },
      Tab: () => {
        if (slashOpen() && options.slashKeys.handle("Enter")) return true;
        return editor.chain().command(({ tr }) => changeLevel(tr, 1)).run();
      },
      "Shift-Tab": () => editor.chain().command(({ tr }) => changeLevel(tr, -1)).run(),
      // Google Docs' list shortcuts.
      "Mod-Shift-7": () => applyKind(editor, "numbered"),
      "Mod-Shift-8": () => applyKind(editor, "bullet"),
      "Mod-Shift-9": () => applyKind(editor, "todo"),
      "Mod-Enter": () => insertPageBreak(editor),
    };
  },

  addProseMirrorPlugins() {
    const editor = this.editor;
    const options = this.options;

    return [
      // A top-level block takes the page geometry of the section it is in; a cell's paragraphs none.
      new Plugin({
        appendTransaction: (transactions, _old, state) => {
          if (!transactions.some((tr) => tr.docChanged)) return null;
          const tr = state.tr;
          let section = (state.doc.firstChild?.attrs.section as number | undefined) ?? 0;
          let first = true;
          state.doc.forEach((node, pos) => {
            if (node.type.name === "docxRegion") return;
            if (!isInserted(node)) {
              section = node.attrs.section ?? section;
              first = false;
              return;
            }
            if (first) {
              const original = findNextOriginal(state.doc, pos);
              if (original) section = original.attrs.section ?? section;
            }
            if (node.attrs.section !== section) tr.setNodeMarkup(pos, undefined, { ...node.attrs, section });
            if (node.type.name === "table") {
              node.descendants((child, offset) => {
                if (child.type.name === "insParagraph" && child.attrs.section !== null) {
                  tr.setNodeMarkup(pos + 1 + offset, undefined, { ...child.attrs, section: null });
                }
                return child.type.name !== "insParagraph";
              });
            }
          });
          return tr.docChanged ? tr.setMeta("addToHistory", false) : null;
        },
      }),

      new Plugin<SlashState>({
        key: slashKey,
        state: {
          init: () => INACTIVE,
          apply: (tr, previous, _old, state) => {
            const meta = tr.getMeta(slashKey) as { close?: boolean } | undefined;
            if (!tr.docChanged && !tr.selectionSet && !meta) return previous;
            return slashState(state, previous, !!meta?.close);
          },
        },
      }),

      new Plugin({
        props: {
          // Placeholders: the kind of an empty block, and a hint in the one being typed in.
          decorations: (state) => {
            const decorations: Decoration[] = [];
            const { $from } = state.selection;
            const focused = $from.parent.type.name === "insParagraph" ? $from.before() : -1;
            state.doc.forEach((node, pos) => {
              if (node.type.name !== "insParagraph" || node.content.size > 0) return;
              const text = options.placeholder(node.attrs.kind, pos === focused);
              if (!text) return;
              decorations.push(
                Decoration.node(pos, pos + node.nodeSize, {
                  class: "is-empty",
                  style: `--placeholder: "${text.replace(/["\\]/g, "")}";`,
                }),
              );
            });
            return DecorationSet.create(state.doc, decorations);
          },

          handleTextInput: (view, from, to, text) => {
            const { state } = view;
            const $from = state.doc.resolve(from);
            const parent = $from.parent;
            if (parent.type.name !== "insParagraph" || $from.depth !== 1 || from !== to) return false;
            const before = parent.textBetween(0, $from.parentOffset);
            const pos = $from.before();
            if (parent.attrs.kind === "normal" && text === " ") {
              const rule = MARKDOWN.find(([pattern]) => pattern.test(before));
              if (!rule) return false;
              const tr = state.tr.delete(pos + 1, from);
              tr.setNodeMarkup(pos, undefined, { ...parent.attrs, kind: rule[1], checked: false });
              view.dispatch(tr);
              return true;
            }
            if (text === "`" && before === "``" && parent.attrs.kind !== "code") {
              const tr = state.tr.delete(pos + 1, from);
              tr.setNodeMarkup(pos, undefined, { ...parent.attrs, kind: "code" });
              view.dispatch(tr);
              return true;
            }
            if (text === "-" && before === "--" && parent.textContent === "--") {
              const tr = state.tr;
              const schema = state.schema;
              tr.replaceWith(pos, pos + parent.nodeSize, [
                schema.nodes.insDivider.create(),
                schema.nodes.insParagraph.create(),
              ]);
              tr.setSelection(TextSelection.near(tr.doc.resolve(pos + 2)));
              view.dispatch(tr.scrollIntoView());
              return true;
            }
            return false;
          },

          handleDOMEvents: {
            mousedown: (view, event) => {
              const check = (event.target as HTMLElement | null)?.closest?.(".ins-check");
              if (!check) return false;
              event.preventDefault();
              const block = check.closest(".ins-p");
              if (!block) return true;
              const $pos = view.state.doc.resolve(view.posAtDOM(block, 0));
              const pos = $pos.depth ? $pos.before(1) : $pos.pos;
              const node = view.state.doc.nodeAt(pos);
              if (node?.type.name === "insParagraph") {
                view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, checked: !node.attrs.checked }));
              }
              return true;
            },
          },

          handlePaste: (view, event) => {
            const files = [...(event.clipboardData?.files ?? [])].filter((file) => IMAGE_TYPES.includes(file.type));
            if (files.length && options.upload) {
              if (!topLevelAt(view.state.doc, view.state.selection)) return false;
              void insertImages(editor, files);
              return true;
            }
            // Lines pasted into a block become blocks of their own.
            const text = event.clipboardData?.getData("text/plain");
            const { $from, $to } = view.state.selection;
            if (
              !text?.includes("\n") ||
              !$from.sameParent($to) ||
              $from.parent.type.name !== "insParagraph" ||
              $from.depth !== 1
            ) {
              return false;
            }
            const parent = $from.parent;
            const tr = view.state.tr.deleteSelection();
            const normalized = text.replace(/\r\n?/g, "\n").replace(/\n+$/, "");
            if (parent.attrs.kind === "code") {
              tr.insertText(normalized);
            } else {
              const attrs = { ...parent.attrs, kind: nextKind(parent.attrs.kind), checked: false };
              normalized.split("\n").forEach((line, index) => {
                if (index > 0) tr.split(tr.selection.from, 1, [{ type: paragraphType(tr), attrs }]);
                if (line) tr.insertText(line);
              });
            }
            view.dispatch(tr.scrollIntoView());
            return true;
          },

          handleDrop: (view, event) => {
            const files = [...(event.dataTransfer?.files ?? [])].filter((file) => IMAGE_TYPES.includes(file.type));
            if (!files.length || !options.upload) return false;
            event.preventDefault();
            const at = view.posAtCoords({ left: event.clientX, top: event.clientY });
            if (!at) return true;
            void insertImages(editor, files, at.pos);
            return true;
          },
        },
      }),
    ];
  },
});

function findNextOriginal(doc: ProseMirrorNode, from: number): ProseMirrorNode | null {
  let found: ProseMirrorNode | null = null;
  doc.nodesBetween(from, doc.content.size, (node, _pos, parent) => {
    if (found || parent !== doc) return false;
    if (!isInserted(node) && node.type.name !== "docxRegion") found = node;
    return false;
  });
  return found;
}

export function insertExtensions(options: Omit<InsertOptions, "slashKeys"> & { slashKeys: SlashKeys }): Extension[] {
  const nodeOptions = { docx: options.docx, setup: options.setup };
  return [
    InsParagraph.configure(nodeOptions),
    InsDivider.configure(nodeOptions),
    InsPageBreak.configure(nodeOptions),
    InsImage.configure(nodeOptions),
    InsTable.configure({ ...nodeOptions, resizable: false, allowTableNodeSelection: true }),
    TableRow,
    InsTableCell,
    InsTableHeader,
    InsertBlocks.configure(options),
  ] as unknown as Extension[];
}
