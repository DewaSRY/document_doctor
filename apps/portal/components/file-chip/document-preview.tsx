"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

import { getFileExtension } from "./utils";

/** Read-only look at a picked PDF or DOCX, so the user can check it's the right file. */
export function DocumentPreview({ file, className }: { file: File; className?: string }) {
  const { t } = useTranslation("common");
  const isPdf = getFileExtension(file.name) === "pdf";
  const containerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [status, setStatus] = useState<{ file: File; failed: boolean } | null>(null);

  useEffect(() => {
    const frame = frameRef.current;
    if (!isPdf || !frame) return;
    const url = URL.createObjectURL(file);
    frame.src = `${url}#view=FitH`;
    return () => URL.revokeObjectURL(url);
  }, [file, isPdf]);

  useEffect(() => {
    const container = containerRef.current;
    if (isPdf || !container) return;
    let active = true;
    container.replaceChildren();
    // Loaded on demand: only DOCX previews need it.
    import("docx-preview")
      .then(({ renderAsync }) =>
        renderAsync(file, container, undefined, {
          className: "docx-preview",
          inWrapper: true,
          ignoreLastRenderedPageBreak: false,
        }),
      )
      .then(
        () => active && setStatus({ file, failed: false }),
        () => active && setStatus({ file, failed: true }),
      );
    return () => {
      active = false;
    };
  }, [file, isPdf]);

  const label = t("filePreview.alt", { name: file.name });
  // A state left over from an earlier file is never used for the current one.
  const current = status?.file === file ? status : null;

  if (isPdf) {
    return (
      <iframe
        ref={frameRef}
        title={label}
        className={cn("h-[32rem] w-full rounded-lg border bg-muted", className)}
      />
    );
  }

  return (
    <div className={cn("relative h-[32rem] overflow-auto rounded-lg border bg-muted", className)}>
      {!current && (
        <div className="absolute inset-0 grid place-items-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
        </div>
      )}
      {current?.failed && (
        <p className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-muted-foreground">
          {t("filePreview.error")}
        </p>
      )}
      <div ref={containerRef} role="document" aria-label={label} />
    </div>
  );
}
