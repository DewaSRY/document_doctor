import { getServiceErrorMessage } from "@/components/file-tools/utils";

export const getTranslatorErrorMessage = getServiceErrorMessage;

export function getTranslatorErrorStatus(error: unknown): number | undefined {
  return (error as { response?: { status?: number } })?.response?.status;
}

export async function downloadResponse(response: Response): Promise<void> {
  const disposition = response.headers.get("content-disposition") ?? "";
  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  const plainMatch = /filename="?([^";]+)"?/i.exec(disposition);
  let fileName = "translated-document";
  try {
    fileName = utf8Match?.[1]
      ? decodeURIComponent(utf8Match[1])
      : (plainMatch?.[1] ?? fileName);
  } catch {
    fileName = plainMatch?.[1] ?? fileName;
  }

  const url = window.URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 0);
}
