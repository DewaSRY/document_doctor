"use client";

import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle, Languages, Loader2 } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import ErrorState from "@/components/ui/error-state";
import {
  DocumentEditor,
  type PageImageHref,
} from "@/components/document-editor";
import { cn } from "@/lib/utils";

import { getMediaHref, getPageImageHref } from "../constants";
import {
  useDocumentLayout,
  useDocumentSegments,
  useDownloadDocument,
  useUpdateDocumentSegments,
  useUploadDocumentMedia,
} from "../hooks/query";
import type {
  DocumentLayout,
  DocumentSegments,
  InsertedBlock,
  SegmentEdit,
} from "../type";
import { getTranslatorErrorStatus } from "../utils";

export function SegmentEditor({ documentId }: { documentId: string }) {
  const { t } = useTranslation("translator");
  const segments = useDocumentSegments(documentId);
  const layout = useDocumentLayout(documentId, segments.isSuccess);

  if (segments.isPending || (segments.isSuccess && layout.isPending)) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 py-24 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" aria-hidden />
        {t("editor.loading")}
      </div>
    );
  }

  if (segments.isError) {
    const notFound = getTranslatorErrorStatus(segments.error) === 404;
    return (
      <div className="flex flex-1 flex-col items-center py-16">
        <ErrorState
          icon={AlertCircle}
          title={t(notFound ? "editor.notFoundTitle" : "editor.loadErrorTitle")}
          description={t(
            notFound
              ? "editor.notFoundDescription"
              : "editor.loadErrorDescription",
          )}
          className="max-w-md flex-none"
        />
        {notFound ? (
          <Link
            href="/translate"
            className={cn(buttonVariants(), "h-9 rounded-lg")}
          >
            {t("editor.translateAgain")}
          </Link>
        ) : (
          <Button className="h-9 rounded-lg" onClick={() => segments.refetch()}>
            {t("error.retry")}
          </Button>
        )}
      </div>
    );
  }

  return (
    <TranslationEditor
      // The schema is fixed when the editor mounts: start over once a layout arrives.
      key={`${segments.data.document_id}:${layout.data ? "layout" : "text"}`}
      document={segments.data}
      layout={layout.data}
      layoutFailed={layout.isError}
      onRetryLayout={() => layout.refetch()}
    />
  );
}

function TranslationEditor({
  document,
  layout,
  layoutFailed,
  onRetryLayout,
}: {
  document: DocumentSegments;
  layout?: DocumentLayout;
  layoutFailed: boolean;
  onRetryLayout: () => void;
}) {
  const { t } = useTranslation("translator");
  const id = document.document_id;
  const update = useUpdateDocumentSegments(id);
  const upload = useUploadDocumentMedia(id);
  const download = useDownloadDocument();

  const pageImageHref = useCallback<PageImageHref>(
    (page, options) => getPageImageHref(id, page, options),
    [id],
  );
  const mediaHref = useCallback((name: string) => getMediaHref(id, name), [id]);

  const languagePair = t("editor.languagePair", {
    source: t(`languages.${document.source_language}`),
    target: t(`languages.${document.target_language}`),
  });

  return (
    <DocumentEditor
      document={document}
      layout={layout}
      onSave={(edits: SegmentEdit[], insertions?: InsertedBlock[]) =>
        update.mutateAsync({ segments: edits, insertions })
      }
      onUploadImage={
        document.document_type === "docx" ? upload.mutateAsync : undefined
      }
      pageImageHref={pageImageHref}
      mediaHref={mediaHref}
      onDownload={() => download.mutateAsync(id).then(() => {})}
      backHref="/translate"
      badge={languagePair}
      details={[
        { icon: Languages, label: t("editor.languages"), value: languagePair },
      ]}
      layoutFailed={layoutFailed}
      onRetryLayout={onRetryLayout}
    />
  );
}
