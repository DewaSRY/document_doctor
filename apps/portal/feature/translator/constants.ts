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

/** Images that can be added to a Word document in the editor (what Word embeds). */
export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif"] as const;

export const ACCEPT_ATTRIBUTE =
  ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function getFileExtension(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

/** Route handler that renders one page of the original PDF. By default the
 *  translatable text is removed, so the editor can draw it on top. */
export function getPageImageHref(
  documentId: string,
  page: number,
  { scale, original = false }: { scale: number; original?: boolean },
): string {
  const params = new URLSearchParams({ scale: String(scale) });
  if (original) params.set("original", "true");
  return `/api/documents/${encodeURIComponent(documentId)}/pages/${page}?${params}`;
}

/** Route handler that streams an image of a Word document, by its part name in the file. */
export function getMediaHref(documentId: string, name: string): string {
  const path = name.split("/").map(encodeURIComponent).join("/");
  return `/api/documents/${encodeURIComponent(documentId)}/media/${path}`;
}
