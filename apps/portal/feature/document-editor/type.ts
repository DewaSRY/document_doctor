/** Types shared by the document editor and the services whose documents it edits. */

/** The fonts a PDF is rewritten with. */
export type FontFamily = "Helvetica" | "Times" | "Courier";
export type TextAlign = "left" | "center" | "right" | "justify";
/** The paragraph styles offered for a Word document. */
export type HeadingKind =
  | "normal"
  | "title"
  | "subtitle"
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6";

/** A user's overrides of a segment's style. Text fields apply to the whole
 *  segment; paragraph fields (DOCX only) to every segment of its paragraph. */
export interface SegmentStyle {
  bold?: boolean;
  italic?: boolean;
  /** In points. */
  font_size?: number;
  /** `#rrggbb`. */
  color?: string;
  align?: TextAlign;
  /** A PDF takes one of FontFamily; a DOCX any font name. */
  family?: string;
  heading?: HeadingKind;
  /** A multiple of single line spacing. */
  line_spacing?: number;
  /** In points. */
  space_before?: number;
  space_after?: number;
  indent_left?: number;
}

/** Formatting of a range of a segment's text. Toggles are absolute; an unset
 *  colour or highlight keeps the segment's own. */
export interface RunStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  /** `#rrggbb`. */
  color?: string;
  /** `#rrggbb`, or `transparent` to remove the document's highlight. */
  highlight?: string;
}

export interface SegmentRun {
  text: string;
  style?: RunStyle;
}

export interface DocumentSegment {
  key: string;
  source_text: string;
  translated_text: string;
  style?: SegmentStyle;
  /** Formatting of ranges of the translation; absent when it is uniform. */
  runs?: SegmentRun[];
}

/** Where and how the service writes a segment's translation into the PDF.
 *  Rects are `[x0, y0, x1, y1]` in PDF points from the page's top left. */
export interface SegmentLayout {
  key: string;
  /** The area the translation may fill. */
  rect: [number, number, number, number];
  source_rect: [number, number, number, number];
  baseline: number;
  /** Top of the text box to the first baseline, relative to the font size. */
  baseline_ratio: number;
  line_count: number;
  line_height: number;
  text_indent: number;
  font_size: number;
  family: FontFamily;
  bold: boolean;
  italic: boolean;
  color: string;
  align: TextAlign;
}

export interface PageLayout {
  page: number;
  width: number;
  height: number;
  segments: SegmentLayout[];
}

export interface PdfLayout {
  document_id: string;
  format: "pdf";
  pages: PageLayout[];
}

// ---------------------------------------------------------------- DOCX layout
// Lengths are in points. See apps/ai-translation/.../docx_layout.py.

/** Resolved formatting of a run of a Word document. */
export interface DocxRunStyle {
  family: string;
  east_asia: string | null;
  size: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  color: string | null;
  highlight: string | null;
  caps: boolean;
  small_caps: boolean;
  vert: "super" | "sub" | null;
  spacing: number;
}

export interface DocxBorder {
  width: number;
  color: string;
  style: "solid" | "dotted" | "dashed" | "double";
}

export interface DocxTabStop {
  pos: number;
  align: "left" | "center" | "right" | "decimal";
  leader: "none" | "dot" | "hyphen" | "underscore" | "middleDot" | "heavy";
}

export interface DocxParagraphStyle {
  align: TextAlign;
  indent_left: number;
  indent_right: number;
  /** Negative for a hanging indent. */
  indent_first: number;
  space_before: number;
  space_after: number;
  /** `auto`: a multiple of single spacing; otherwise points. */
  line: { rule: "auto" | "exact" | "atLeast"; value: number };
  contextual: boolean;
  shading: string | null;
  borders: Partial<Record<"top" | "bottom" | "left" | "right", DocxBorder>> | null;
  tabs: DocxTabStop[];
}

export interface DocxAnchor {
  x: { relative: string; offset: number; align: string | null };
  y: { relative: string; offset: number; align: string | null };
  wrap: string;
  behind: boolean;
}

/** Content of a paragraph; `run` is an index into `run_styles`. */
export type DocxPart =
  | { type: "segment"; key: string; run: number }
  | { type: "text"; text: string; run: number }
  | { type: "field"; field: "page" | "pages"; run: number }
  | { type: "tab" }
  | { type: "break" }
  | {
      type: "image";
      src: string | null;
      width: number;
      height: number;
      position: DocxAnchor | null;
      alt: string;
    };

export interface DocxParagraph {
  type: "paragraph";
  style: DocxParagraphStyle;
  style_id: string | null;
  heading: HeadingKind | null;
  /** Formatting of the paragraph mark: the size of an empty paragraph. */
  run: number;
  marker: { text: string; run: number; suffix: "tab" | "space" | "nothing" } | null;
  parts: DocxPart[];
  break_before: boolean;
  break_after: boolean;
}

export interface DocxCell {
  col: number;
  span: number;
  row_span: number;
  width: number;
  shading: string | null;
  valign: "top" | "center" | "bottom";
  margin: { top: number; right: number; bottom: number; left: number };
  borders: Record<"top" | "right" | "bottom" | "left", DocxBorder | null>;
  blocks: DocxBlock[];
}

export interface DocxTable {
  type: "table";
  columns: number[];
  align: "left" | "center" | "right";
  indent: number;
  rows: {
    height: number | null;
    rule: "auto" | "atLeast";
    header: boolean;
    cells: DocxCell[];
  }[];
}

/** A text box. */
export interface DocxFrame {
  type: "frame";
  width: number;
  height: number;
  position: DocxAnchor | null;
  fill: string | null;
  border: DocxBorder | null;
  blocks: DocxBlock[];
}

export type DocxBlock = DocxParagraph | DocxTable | DocxFrame;

export interface DocxSection {
  page: { width: number; height: number };
  margin: {
    top: number;
    right: number;
    bottom: number;
    left: number;
    header: number;
    footer: number;
  };
  break: "nextPage" | "continuous" | "evenPage" | "oddPage" | "nextColumn";
  columns: number;
  title_page: boolean;
  /** Ids into `headers`. */
  header: { default: string | null; first: string | null };
  footer: { default: string | null; first: string | null };
  blocks: DocxBlock[];
}

export interface DocxNamedStyle {
  style_id: string;
  style: DocxParagraphStyle;
  run: number;
}

export interface DocxLayout {
  document_id: string;
  format: "docx";
  default_tab: number;
  sections: DocxSection[];
  /** Headers and footers, by id. */
  headers: Record<string, DocxBlock[]>;
  /** The document's own formatting of the paragraph styles it defines. */
  styles: Partial<Record<HeadingKind, DocxNamedStyle>>;
  run_styles: DocxRunStyle[];
}

export type DocumentLayout = PdfLayout | DocxLayout;

/** A document as the editor edits it: its segments and, optionally, their layout. */
export interface EditorDocument {
  document_id: string;
  file_name: string;
  document_type: "pdf" | "docx";
  /** BCP 47 code of the text being edited, for spellchecking. */
  target_language: string;
  segments: DocumentSegment[];
}

/** A segment changed in the editor since it was last saved. */
export interface SegmentEdit {
  key: string;
  translated_text: string;
  /** Replaces the stored overrides; null clears them. */
  style?: SegmentStyle | null;
  /** Replaces the stored runs; null clears them (the text is uniform). */
  runs?: SegmentRun[] | null;
}
