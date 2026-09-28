"use server";

import { isLanguageCode } from "@/feature/translator/constants";
import { toolsClient } from "./client";
import {
  DOCUMENT_AI_MAX_SIZE,
  DOCUMENT_EXTENSIONS,
  getFileExtension,
  isSummaryLength,
} from "./constants";

// Masking server action for handling API requests with packed results
import { runMaskingServerAction } from "@/lib/api/pack-server-action";

function readDocument(formData: FormData): File {
  const file = formData.get("file");

  // The browser checks these too, but a Server Action is a public endpoint.
  if (
    !(file instanceof File) ||
    file.size === 0 ||
    file.size > DOCUMENT_AI_MAX_SIZE ||
    !(DOCUMENT_EXTENSIONS as readonly string[]).includes(getFileExtension(file.name))
  ) {
    throw new Error("Invalid document");
  }
  return file;
}

export async function summarizeDocumentAction(formData: FormData) {
  const file = readDocument(formData);
  const length = formData.get("length");
  const language = formData.get("language") || null;

  if (!isSummaryLength(length) || (language !== null && !isLanguageCode(language))) {
    throw new Error("Invalid summary request");
  }

  return runMaskingServerAction(async () => {
    const response = await toolsClient.summarizeDocument(file, length, language);
    return response.data.data;
  });
}

export async function extractDocumentAction(formData: FormData) {
  const file = readDocument(formData);

  return runMaskingServerAction(async () => {
    const response = await toolsClient.extractDocument(file);
    return response.data.data;
  });
}
