import axios from "axios";
import { BaseClient } from "@/lib/api/base-client";
import { AI_TRANSLATION_API_URL } from "@/feature/translator/config";
import type { DocumentExtraction, DocumentSummary, ToolResponse } from "./type";

const documentAiApi = axios.create({
  baseURL: AI_TRANSLATION_API_URL,
  // The model reads the whole document, which can take a few minutes.
  timeout: 15 * 60_000,
});

export class ToolsClient extends BaseClient {
  constructor() {
    super(documentAiApi);
  }

  summarizeDocument(file: File, length: string, language: string | null) {
    const body = new FormData();
    body.append("file", file, file.name);
    body.append("length", length);
    if (language) body.append("language", language);

    return this.post<ToolResponse<DocumentSummary>>({
      endpoint: "/summarize-document",
      body,
    });
  }

  extractDocument(file: File) {
    const body = new FormData();
    body.append("file", file, file.name);

    return this.post<ToolResponse<DocumentExtraction>>({
      endpoint: "/extract-document",
      body,
    });
  }
}

export const toolsClient = new ToolsClient();
