"use client";

import { useId, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff, FileText, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatFileSize } from "@/components/file-tools/utils";

import { DocumentPreview } from "./document-preview";
import { canPreviewDocument, getFileExtension } from "./utils";

/** A picked file: icon, name, type and size, with room for actions.
 *  With `preview`, PDF and DOCX files get a toggle that shows their content below. */
export function FileChip({
  file,
  icon: Icon = FileText,
  preview = false,
  defaultPreviewOpen = true,
  children,
}: {
  file: File;
  icon?: LucideIcon;
  preview?: boolean;
  defaultPreviewOpen?: boolean;
  children?: ReactNode;
}) {
  const { t } = useTranslation("common");
  const previewId = useId();
  const [previewOpen, setPreviewOpen] = useState(defaultPreviewOpen);
  const showToggle = preview && canPreviewDocument(file);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{file.name}</p>
          <p className="text-xs text-muted-foreground">
            {getFileExtension(file.name).toUpperCase()} ·{" "}
            {formatFileSize(file.size)}
          </p>
        </div>
        {showToggle && (
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={previewOpen}
            aria-controls={previewId}
            onClick={() => setPreviewOpen((open) => !open)}
          >
            {previewOpen ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
            {previewOpen ? t("filePreview.hide") : t("filePreview.show")}
          </Button>
        )}
        {children}
      </div>

      {showToggle && previewOpen && (
        <div id={previewId}>
          <DocumentPreview file={file} />
        </div>
      )}
    </div>
  );
}
