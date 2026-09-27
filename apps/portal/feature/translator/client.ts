import axios from "axios";
import { BaseClient } from "@/lib/api/base-client";
import { AI_TRANSLATION_API_URL } from "./config";
import type {
  DocumentSegments,
  TranslatedDocument,
  TranslatorResponse,
  UpdateSegmentsBody,
} from "./type";

const aiTranslationApi = axios.create({
  baseURL: AI_TRANSLATION_API_URL,
  // Translation runs synchronously on the service, sentence by sentence, so
  // a long document can take several minutes.
  timeout: 15 * 60_000,
});

export class TranslatorClient extends BaseClient {
  constructor() {
    super(aiTranslationApi);
  }

  translateDocument(
    file: File,
    sourceLanguage: string,
    targetLanguage: string,
  ) {
    const body = new FormData();
    body.append("file", file, file.name);

    return this.post<TranslatorResponse<TranslatedDocument>>({
      endpoint: "/translate-document",
      body,
      params: {
        source_language: sourceLanguage,
        target_language: targetLanguage,
      },
    });
  }

  getDocumentSegments(documentId: string) {
    return this.get<TranslatorResponse<DocumentSegments>>({
      endpoint: `/translated-document/${encodeURIComponent(documentId)}/segments`,
    });
  }

  updateDocumentSegments(documentId: string, body: UpdateSegmentsBody) {
    return this.put<TranslatorResponse<DocumentSegments>>({
      endpoint: `/translated-document/${encodeURIComponent(documentId)}/segments`,
      body,
      config: { timeout: 60_000 },
    });
  }
}

export const translatorClient = new TranslatorClient();
