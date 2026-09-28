export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Saves a Blob as a file from the browser. */
export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give the browser time to start the download before releasing the URL.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Reads the service's `message` from a failed request, for errors whose
 *  text is useful to the user (unsupported file, file too large, …). */
export function getServiceErrorMessage(error: unknown): string | undefined {
  const data = (error as { response?: { data?: { message?: unknown } } })
    ?.response?.data;
  return typeof data?.message === "string" ? data.message : undefined;
}
