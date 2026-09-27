import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getDocumentSegmentsAction,
  translateDocumentAction,
  updateDocumentSegmentsAction,
} from "../actions";
import type { LanguageCode } from "../constants";
import type { UpdateSegmentsBody } from "../type";

// Masking server action for handling API requests with packed results
import { unpackActionResult } from "@/lib/api/unpack-server-result";

export const queryKeys = {
  all: ["translator"] as const,
  segments: (documentId: string) =>
    [...queryKeys.all, "segments", documentId] as const,
};

export interface TranslateDocumentVariables {
  file: File;
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
}

export function useTranslateDocument() {
  return useMutation({
    mutationFn: ({
      file,
      sourceLanguage,
      targetLanguage,
    }: TranslateDocumentVariables) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("source_language", sourceLanguage);
      formData.append("target_language", targetLanguage);
      return translateDocumentAction(formData).then(unpackActionResult);
    },
  });
}

export function useDocumentSegments(documentId: string) {
  return useQuery({
    queryKey: queryKeys.segments(documentId),
    queryFn: () =>
      getDocumentSegmentsAction(documentId).then(unpackActionResult),
    // The editor owns the text once loaded; refetching would not update it.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

export function useUpdateDocumentSegments(documentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: UpdateSegmentsBody) =>
      updateDocumentSegmentsAction(documentId, body).then(unpackActionResult),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.segments(documentId), data);
    },
  });
}
