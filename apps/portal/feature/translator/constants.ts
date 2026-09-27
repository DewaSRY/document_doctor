/** Language codes the AI translation service understands
 *  (apps/ai-translation/src/ai_translation/domain/translation/utils.py). */
export const LANGUAGE_CODES = [
  "id",
  "en",
  "zh",
  "ja",
  "ko",
  "fr",
  "de",
  "es",
] as const;

export type LanguageCode = (typeof LANGUAGE_CODES)[number];

export function isLanguageCode(value: unknown): value is LanguageCode {
  return (LANGUAGE_CODES as readonly unknown[]).includes(value);
}

/** Same limit the service enforces on /v1/translate-document. */
export const MAX_FILE_SIZE = 5 * 1024 * 1024;

export const ACCEPTED_EXTENSIONS = ["pdf", "docx"] as const;

export const ACCEPT_ATTRIBUTE =
  ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function getFileExtension(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

/** Route handler that streams the translated file from the service. */
export function getDownloadHref(documentId: string): string {
  return `/api/documents/${encodeURIComponent(documentId)}/download`;
}
