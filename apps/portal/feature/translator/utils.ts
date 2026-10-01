import { getServiceErrorMessage } from "@/components/file-tools/utils";

export const getTranslatorErrorMessage = getServiceErrorMessage;

export function getTranslatorErrorStatus(error: unknown): number | undefined {
  return (error as { response?: { status?: number } })?.response?.status;
}

/** Triggers a browser download of a binary file encoded as base64. */
export function downloadFromBase64(
  base64: string,
  fileName: string,
  contentType = "application/octet-stream",
): void {
  if (typeof window === "undefined") return;

  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: contentType });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}
