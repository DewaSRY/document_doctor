import axios from "axios";
import { BaseClient } from "@/lib/api/base-client";
import type { DocumentExtraction, DocumentSummary, ToolResponse } from "./type";

export class ToolsClient extends BaseClient {
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
