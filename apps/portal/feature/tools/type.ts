import type { LanguageCode } from "@/feature/translator/constants";
import type { ExtractionField, SummaryLength } from "./constants";

/** The AI service wraps every response as { data, code, message }. */
export interface ToolResponse<T> {
  data: T;
  code: number;
  message: string;
}

export interface DocumentSummary {
  file_name: string;
  document_type: "pdf" | "docx";
  length: SummaryLength;
  language: LanguageCode | null;
  overview: string;
  key_points: string[];
  truncated: boolean;
  model: string;
}

export interface DocumentExtraction {
  file_name: string;
  document_type: "pdf" | "docx";
  fields: Record<ExtractionField, string[]>;
  truncated: boolean;
  model: string;
}

export interface PdfInfo {
  file_name: string;
  page_count: number;
}

/** A file produced by one of the proxied tools. */
export interface ToolFileResult {
  blob: Blob;
  fileName: string;
  headers: Record<string, string>;
}
