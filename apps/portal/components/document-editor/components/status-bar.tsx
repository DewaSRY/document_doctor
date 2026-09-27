"use client";

import { useTranslation } from "react-i18next";
import { Maximize2, Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

import { MAX_ZOOM, MIN_ZOOM, stepZoom, type ZoomControls } from "./editor-toolbar";

/** The bar under the document: where you are, how long it is, and the zoom. */
export function StatusBar({
  page,
  pageCount,
  words,
  onWordCount,
  zoom,
}: {
  /** Zero-based; null when the document is not shown as pages. */
  page: number | null;
  pageCount: number;
  words: number;
  onWordCount: () => void;
  zoom: ZoomControls | null;
}) {
  const { t } = useTranslation("editor");
  return (
    <div className="sticky bottom-0 z-30 flex h-9 items-center gap-3 border-t border-border/60 bg-background/95 px-3 text-xs text-muted-foreground backdrop-blur sm:px-4 print:hidden">
      {page !== null && (
        <span aria-live="polite" className="tabular-nums">
          {t("pageOf", { page: page + 1, count: pageCount })}
        </span>
      )}
      <button
        type="button"
        onClick={onWordCount}
        className="cursor-pointer rounded-xs px-1 tabular-nums hover:bg-muted hover:text-foreground"
      >
        {t("wordCount.words", { count: words })}
      </button>

      {zoom && (
        <div className="ml-auto flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={t("zoomFit")}
            title={t("zoomFit")}
            onClick={zoom.fitWidth}
          >
            <Maximize2 aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={t("zoomOut")}
            title={t("zoomOut")}
            disabled={zoom.zoomPercent <= MIN_ZOOM}
            onClick={() => zoom.setZoomPercent(stepZoom(zoom.zoomPercent, -1))}
          >
            <Minus aria-hidden />
          </Button>
          <span className="w-10 text-center tabular-nums">{zoom.zoomPercent}%</span>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={t("zoomIn")}
            title={t("zoomIn")}
            disabled={zoom.zoomPercent >= MAX_ZOOM}
            onClick={() => zoom.setZoomPercent(stepZoom(zoom.zoomPercent, 1))}
          >
            <Plus aria-hidden />
          </Button>
        </div>
      )}
    </div>
  );
}
