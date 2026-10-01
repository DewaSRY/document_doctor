import { RESULT_HEADERS, type ProxiedTool } from "./constants";
import type { ToolFileResult } from "./type";

/** Error with the same shape as a failed axios request, so one helper reads
 *  the service's message for Server Actions and proxied calls alike. */
export class ToolRequestError extends Error {
  response: { status: number; data?: { message?: string } };

  constructor(status: number, data?: { message?: string }) {
    super(data?.message ?? `Request failed with status ${status}`);
    this.response = { status, data };
  }
}

function fileNameFromDisposition(header: string | null): string | undefined {
  if (!header) return undefined;
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(header)?.[1];
  if (encoded) {
    try {
      return decodeURIComponent(encoded);
    } catch {
      // Fall through to the plain file name.
    }
  }
  return /filename="?([^";]+)"?/i.exec(header)?.[1];
}

async function postToTool(tool: ProxiedTool, body: FormData): Promise<Response> {
  const response = await fetch(`/api/tools/${tool}`, { method: "POST", body }).catch(
    () => {
      throw new ToolRequestError(0);
    },
  );
  if (!response.ok) {
    const data = await response.json().catch(() => undefined);
    throw new ToolRequestError(response.status, data);
  }
  return response;
}

/** Runs a file tool and returns the file it produced. */
export async function runFileTool(
  tool: ProxiedTool,
  body: FormData,
  fallbackName: string,
): Promise<ToolFileResult> {
  const response = await postToTool(tool, body);
  const headers: Record<string, string> = {};
  for (const name of RESULT_HEADERS) {
    const value = response.headers.get(name);
    if (value) headers[name] = value;
  }

  return {
    blob: await response.blob(),
    fileName: fileNameFromDisposition(response.headers.get("content-disposition")) ?? fallbackName,
    headers,
  };
}

/** Runs a proxied tool that answers with the service's JSON envelope. */
export async function runJsonTool<T>(tool: ProxiedTool, body: FormData): Promise<T> {
  const response = await postToTool(tool, body);
  const json = (await response.json()) as { data: T };
  return json.data;
}

export function fileStem(fileName: string): string {
  const index = fileName.lastIndexOf(".");
  return index > 0 ? fileName.slice(0, index) : fileName || "document";
}

export type ImageFormat = "png" | "jpeg" | "webp";

/** Reads the first bytes of a file to tell PNG, JPEG and WEBP apart,
 *  since the extension alone can't be trusted. */
export async function detectImageFormat(
  file: File,
): Promise<ImageFormat | null> {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (
    bytes.length >= 8 &&
    pngSignature.every((value, index) => bytes[index] === value)
  ) {
    return "png";
  }
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "jpeg";
  }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return "webp";
  }
  return null;
}
