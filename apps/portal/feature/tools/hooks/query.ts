import { useMutation } from "@tanstack/react-query";

import type { LanguageCode } from "@/feature/translator/constants";
import type { ProxiedTool, SummaryLength } from "../constants";
import type { DocumentExtraction, DocumentSummary, PdfInfo } from "../type";
import { runFileTool, runJsonTool } from "../utils";

export interface SummarizeDocumentVariables {
  file: File;
  length: SummaryLength;
  language: LanguageCode | null;
}

export function useSummarizeDocument() {
  return useMutation({
    mutationFn: ({ file, length, language }: SummarizeDocumentVariables) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("length", length);
      if (language) formData.append("language", language);
      return runJsonTool<DocumentSummary>("summarize", formData);
    },
  });
}

export function useExtractDocument() {
  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return runJsonTool<DocumentExtraction>("extract", formData);
    },
  });
}


export function usePdfInfo() {
  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return runJsonTool<PdfInfo>("pdf-info", formData);
    },
  });
}

export interface FileToolVariables {
  body: FormData;
  fallbackName: string;
}

/** Runs one of the file tools (convert, PDF, image) through the proxy. */
export function useFileTool(tool: ProxiedTool) {
  return useMutation({
    mutationFn: ({ body, fallbackName }: FileToolVariables) =>
      runFileTool(tool, body, fallbackName),
  });
}
