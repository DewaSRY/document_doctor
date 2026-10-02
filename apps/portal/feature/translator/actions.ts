"use server";

import { headers } from "next/headers";
import { translatorClient } from "./client";
import {
  ACCEPTED_EXTENSIONS,
  ACCEPTED_IMAGE_TYPES,
  MAX_FILE_SIZE,
  getFileExtension,
  isLanguageCode,
} from "./constants";
import type { DeleteDocumentResponse, UpdateSegmentsBody } from "./type";

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
    const clientIp = (await headers()).get("cf-connecting-ip") ?? undefined;
    const response = await translatorClient.translateDocument(
      file,
      sourceLanguage,
      targetLanguage,
      clientIp,
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

export async function deleteDocumentAction(
  documentId: string,
): Promise<MaskingActionResult<DeleteDocumentResponse>> {
  return runMaskingServerAction(async () => {
    const response = await translatorClient.deleteDocument(documentId);
    return response.data.data;
  });
}