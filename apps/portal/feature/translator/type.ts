import type { LanguageCode } from "./constants";

/** The AI service wraps every response as { data, code, message }. */
export interface TranslatorResponse<T> {
  data: T;
  code: number;
  message: string;
}

export interface TranslatedDocument {
  document_id: string;
  file_name: string;
  file_size: number;
  source_language: LanguageCode;
  target_language: LanguageCode;
  document_type: "pdf" | "docx";
  status: string;
  model: string;
  created_at: string;
}

export type FontFamily = "Helvetica" | "Times" | "Courier";
export type TextAlign = "left" | "center" | "right" | "justify";

/** A user's overrides of a PDF segment's detected style. */
export interface SegmentStyle {
  bold?: boolean;
  italic?: boolean;
  /** In PDF points. */
  font_size?: number;
  /** `#rrggbb`. */
  color?: string;
  align?: TextAlign;
  family?: FontFamily;
}

export interface DocumentSegment {
  key: string;
  source_text: string;
  translated_text: string;
  style?: SegmentStyle;
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

export interface DocumentLayout {
  document_id: string;
  pages: PageLayout[];
}

export interface DocumentSegments {
  document_id: string;
  file_name: string;
  document_type: "pdf" | "docx";
  source_language: LanguageCode;
  target_language: LanguageCode;
  segments: DocumentSegment[];
  updated_at: string;
}

export interface UpdateSegmentsBody {
  segments: {
    key: string;
    translated_text: string;
    /** Replaces the stored overrides; null clears them. PDF only. */
    style?: SegmentStyle | null;
  }[];
}
