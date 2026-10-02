import type {
  DocumentSegment,
  InsertedBlock,
  SegmentEdit,
} from "@/components/document-editor/type";

import type { LanguageCode } from "./constants";

export type {
  FontFamily,
  TextAlign,
  HeadingKind,
  SegmentStyle,
  RunStyle,
  SegmentRun,
  DocumentSegment,
  SegmentLayout,
  PageLayout,
  PdfLayout,
  DocxRunStyle,
  DocxBorder,
  DocxTabStop,
  DocxParagraphStyle,
  DocxAnchor,
  DocxPart,
  DocxParagraph,
  DocxCell,
  DocxTable,
  DocxFrame,
  DocxBlock,
  DocxSection,
  DocxNamedStyle,
  DocxLayout,
  DocumentLayout,
  SegmentEdit,
  InsertedBlock,
  UploadedImage,
} from "@/components/document-editor/type";

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

export interface DocumentSegments {
  document_id: string;
  file_name: string;
  document_type: "pdf" | "docx";
  source_language: LanguageCode;
  target_language: LanguageCode;
  segments: DocumentSegment[];
  /** Blocks added to a Word document in the editor. */
  insertions?: InsertedBlock[];
  updated_at: string;
}

export interface UpdateSegmentsBody {
  segments: SegmentEdit[];
  /** Replaces the added blocks when sent. */
  insertions?: InsertedBlock[];
}

export interface DeleteDocumentResponse {
  document_id: string;
}