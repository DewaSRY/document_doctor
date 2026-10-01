"use server";

import { translatorClient } from "./client";
import {
  ACCEPTED_EXTENSIONS,
  ACCEPTED_IMAGE_TYPES,
  MAX_FILE_SIZE,
  getFileExtension,
  isLanguageCode,
} from "./constants";
import type { DownloadDocumentResponse, UpdateSegmentsBody } from "./type";

// Masking server action for handling API requests with packed results
import { runMaskingServerAction } from "@/lib/api/pack-server-action";
import type { MaskingActionResult } from "@/lib/api/types";

export async function translateDocumentAction(formData: FormData) {
  const file = formData.get("file");
  const sourceLanguage = formData.get("source_language");
  const targetLanguage = formData.get("target_language");

  // The browser checks these too, but a Server Action is a public endpoint.
  if (
    !(file instanceof File) ||
    file.size === 0 ||
    file.size > MAX_FILE_SIZE ||
    !(ACCEPTED_EXTENSIONS as readonly string[]).includes(
      getFileExtension(file.name),
    ) ||
    !isLanguageCode(sourceLanguage) ||
    !isLanguageCode(targetLanguage) ||
    sourceLanguage === targetLanguage
  ) {
    throw new Error("Invalid translation request");
  }

  return runMaskingServerAction(async () => {
    const response = await translatorClient.translateDocument(
      file,
      sourceLanguage,
      targetLanguage,
    );
    return response.data.data;
  });
}

export async function getDocumentSegmentsAction(documentId: string) {
  return runMaskingServerAction(async () => {
    const response = await translatorClient.getDocumentSegments(documentId);
    return response.data.data;
  });
}

export async function getDocumentLayoutAction(documentId: string) {
  return runMaskingServerAction(async () => {
    const response = await translatorClient.getDocumentLayout(documentId);
    return response.data.data;
  });
}

export async function updateDocumentSegmentsAction(
  documentId: string,
  body: UpdateSegmentsBody,
) {
  return runMaskingServerAction(async () => {
    const response = await translatorClient.updateDocumentSegments(
      documentId,
      body,
    );
    return response.data.data;
  });
}

export async function uploadDocumentMediaAction(
  documentId: string,
  formData: FormData,
) {
  const file = formData.get("file");
  // The service checks the content too; a Server Action is a public endpoint.
  if (
    !(file instanceof File) ||
    file.size === 0 ||
    file.size > MAX_FILE_SIZE ||
    !(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)
  ) {
    throw new Error("Invalid image");
  }

  return runMaskingServerAction(async () => {
    const response = await translatorClient.uploadDocumentMedia(
      documentId,
      file,
    );
    return response.data.data;
  });
}

function extractFileNameFromDisposition(
  disposition?: string,
  fallback = "translated-document",
): string {
  if (!disposition) return fallback;
  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      // Fall through to plain file name.
    }
  }
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  return match?.[1] ?? fallback;
}

export async function downloadDocumentAction(
  documentId: string,
): Promise<MaskingActionResult<DownloadDocumentResponse>> {
  return runMaskingServerAction(async () => {
    const response = await translatorClient.downloadDocument(documentId);
    const headers = response.headers;
    const contentType =
      ((typeof headers?.get === "function"
        ? headers.get("content-type")
        : headers?.["content-type"]) as string | undefined) ??
      "application/octet-stream";
    const disposition = (
      typeof headers?.get === "function"
        ? headers.get("content-disposition")
        : headers?.["content-disposition"]
    ) as string | undefined;
    const fileName = extractFileNameFromDisposition(disposition);
    const base64 = Buffer.from(response.data).toString("base64");

    return {
      base64,
      fileName,
      contentType,
    };
  });
}
