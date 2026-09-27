/** Lower-case extension of a file name, without the dot ("" when there is none). */
export function getFileExtension(fileName: string): string {
  return fileName.includes(".") ? (fileName.split(".").pop()?.toLowerCase() ?? "") : "";
}

export const PREVIEWABLE_EXTENSIONS = ["pdf", "docx"] as const;

/** Whether `DocumentPreview` can show this file. */
export function canPreviewDocument(file: File): boolean {
  return (PREVIEWABLE_EXTENSIONS as readonly string[]).includes(getFileExtension(file.name));
}
