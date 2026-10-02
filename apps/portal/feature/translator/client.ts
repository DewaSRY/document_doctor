import { BaseClient } from "@/lib/api/base-client";
import { serverApiClient } from "@/lib/api/server-client";
import type {
  DeleteDocumentResponse,
  DocumentLayout,
  DocumentSegments,
  TranslatedDocument,
  TranslatorResponse,
  UpdateSegmentsBody,
  UploadedImage,
} from "./type";

export class TranslatorClient extends BaseClient {
  translateDocument(
    file: File,
    sourceLanguage: string,
    targetLanguage: string,
    clientIp?: string,
  ) {
    const body = new FormData();

    body.append("file", file, file.name);

    return this.postFormData<TranslatorResponse<TranslatedDocument>>({
      endpoint: "/translate-document",
      body,
      params: {
        source_language: sourceLanguage,
        target_language: targetLanguage,
      },
      config: {
        timeout: 15 * 60_000,
        headers: clientIp ? { "X-Portal-Client-IP": clientIp } : undefined,
      },
    });
  }

  getDocumentSegments(documentId: string) {
    return this.get<TranslatorResponse<DocumentSegments>>({
      endpoint: `/translated-document/${encodeURIComponent(documentId)}/segments`,
    });
  }

  getDocumentLayout(documentId: string) {
    return this.get<TranslatorResponse<DocumentLayout>>({
      endpoint: `/translated-document/${encodeURIComponent(documentId)}/layout`,
      config: { timeout: 60_000 },
    });
  }

  /** Stores an image to place in a Word document as an inserted block. */
  uploadDocumentMedia(documentId: string, file: File) {
    const body = new FormData();
    body.append("file", file, file.name);

    return this.postFormData<TranslatorResponse<UploadedImage>>({
      endpoint: `/translated-document/${encodeURIComponent(documentId)}/media`,
      body,
      config: { timeout: 60_000 },
    });
  }

  updateDocumentSegments(documentId: string, body: UpdateSegmentsBody) {
    return this.put<TranslatorResponse<DocumentSegments>>({
      endpoint: `/translated-document/${encodeURIComponent(documentId)}/segments`,
      body,
      config: { timeout: 60_000 },
    });
  }

  deleteDocument(documentId: string) {
    return this.delete<TranslatorResponse<DeleteDocumentResponse>>({
      endpoint: `/translated-document/${encodeURIComponent(documentId)}`,
    });
  }
}

export const translatorClient = new TranslatorClient(serverApiClient);
