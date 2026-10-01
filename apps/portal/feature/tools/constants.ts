/** Where each tool card on the landing page leads, keyed by its icon id
 *  (messages/<locale>/landing.json → tools.items[].icon). Locale-less. */
export const TOOL_HREFS: Record<string, string> = {
  translator: "/translate",
  summarizer: "/summarize",
  extractor: "/extract",
  converter: "/convert",
  pdf: "/pdf",
  resizer: "/resize-image",
  compressor: "/compress-image",
  "image-converter": "/convert-image",
};

/** Tools that return a file (or a small JSON) are proxied by
 *  app/api/tools/[tool]/route.ts to these AI service endpoints. */
export const PROXIED_TOOL_ENDPOINTS = {
  convert: "/convert-document",
  "pdf-info": "/pdf/info",
  "pdf-merge": "/pdf/merge",
  "pdf-split": "/pdf/split",
  "image-resize": "/image/resize",
  "image-compress": "/image/compress",
  "image-convert": "/image/convert",
} as const;

export type ProxiedTool = keyof typeof PROXIED_TOOL_ENDPOINTS;

export function isProxiedTool(value: string): value is ProxiedTool {
  return Object.hasOwn(PROXIED_TOOL_ENDPOINTS, value);
}

/** Headers the image endpoints use to report what they produced. */
export const RESULT_HEADERS = [
  "x-image-width",
  "x-image-height",
  "x-original-size",
  "x-output-size",
] as const;

// Same limits the service enforces.
export const DOCUMENT_AI_MAX_SIZE = 5 * 1024 * 1024;
export const FILE_TOOL_MAX_SIZE = 10 * 1024 * 1024;
export const IMAGE_MAX_SIZE = 10 * 1024 * 1024;
export const MAX_MERGE_FILES = 20;
export const MAX_IMAGE_DIMENSION = 10_000;

export const DOCUMENT_EXTENSIONS = ["pdf", "docx"] as const;
export const PDF_EXTENSIONS = ["pdf"] as const;
export const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp"] as const;

export const DOCUMENT_ACCEPT =
  ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const PDF_ACCEPT = ".pdf,application/pdf";
export const IMAGE_ACCEPT =
  ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";

export const SUMMARY_LENGTHS = ["short", "medium", "detailed"] as const;
export type SummaryLength = (typeof SUMMARY_LENGTHS)[number];

export function isSummaryLength(value: unknown): value is SummaryLength {
  return (SUMMARY_LENGTHS as readonly unknown[]).includes(value);
}

/** Field order of the extractor's result (ai_translation/domain/document_ai/extractor.py). */
export const EXTRACTION_FIELDS = [
  "people",
  "organizations",
  "dates",
  "amounts",
  "locations",
  "emails",
  "phone_numbers",
  "urls",
] as const;
export type ExtractionField = (typeof EXTRACTION_FIELDS)[number];

export const IMAGE_FORMATS = ["jpg", "png", "webp"] as const;
export type ImageFormat = (typeof IMAGE_FORMATS)[number];

export const FIT_MODES = ["cover", "contain", "stretch"] as const;
export type FitMode = (typeof FIT_MODES)[number];

export const SPLIT_MODES = ["ranges", "every"] as const;
export type SplitMode = (typeof SPLIT_MODES)[number];

export const RESIZE_PRESETS = [
  { id: "og", width: 1200, height: 630 },
  { id: "square", width: 1080, height: 1080 },
  { id: "story", width: 1080, height: 1920 },
  { id: "hd", width: 1920, height: 1080 },
  { id: "thumbnail", width: 400, height: 300 },
] as const;

export function getFileExtension(fileName: string): string {
  return fileName.includes(".")
    ? (fileName.split(".").pop()?.toLowerCase() ?? "")
    : "";
}
