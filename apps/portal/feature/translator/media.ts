import "server-only";

import { AI_TRANSLATION_API_URL } from "./config";

const UPLOADED_IMAGE_PATTERN = /^[0-9a-f]{32}\.(png|jpeg|gif)$/;

/** Only images the document holds (word/media/<name>) or was given (upload/<name>) may be streamed. */
export function isAllowedMediaPath(path: string[]): boolean {
  if (path.some((part) => part === ".." || part === "")) return false;
  const original = path.length >= 3 && path[0] === "word" && path[1] === "media";
  const uploaded =
    path.length === 2 && path[0] === "upload" && UPLOADED_IMAGE_PATTERN.test(path[1]);
  return original || uploaded;
}

export function getMediaUpstreamUrl(documentId: string, path: string[]): string {
  const name = path.map(encodeURIComponent).join("/");
  return `${AI_TRANSLATION_API_URL}/translated-document/${encodeURIComponent(documentId)}/media/${name}`;
}

export function isValidPageNumber(page: string): boolean {
  return /^\d+$/.test(page);
}

export function getPageImageUpstreamUrl(
  documentId: string,
  page: string,
  searchParams: URLSearchParams,
): string {
  const params = new URLSearchParams();
  const scale = Number(searchParams.get("scale"));
  if (Number.isFinite(scale) && scale >= 0.5 && scale <= 4) {
    params.set("scale", String(scale));
  }
  if (searchParams.get("original") === "true") params.set("original", "true");

  return `${AI_TRANSLATION_API_URL}/translated-document/${encodeURIComponent(documentId)}/pages/${page}/image?${params}`;
}
