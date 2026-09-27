"use client";

import { useState, type ReactNode } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import { useTranslation } from "react-i18next";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  Columns2,
  Eraser,
  FileSearch,
  Italic,
  Minus,
  Plus,
  Redo2,
  RemoveFormatting,
  RotateCcw,
  ScanText,
  Search,
  SquareDashed,
  Undo2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import type { SegmentLayout, SegmentStyle, TextAlign } from "../type";
import { useFit, type FitStore } from "./pdf-view-context";
import { findActiveSegment } from "./segment-extension";
import { FONT_FAMILIES, resolveStyle } from "./segment-style";

export const ZOOM_PRESETS = [50, 75, 90, 100, 110, 125, 150, 175, 200] as const;
export const MIN_ZOOM = 25;
export const MAX_ZOOM = 300;

const ALIGNMENTS: { value: TextAlign; icon: typeof AlignLeft; label: string }[] = [
  { value: "left", icon: AlignLeft, label: "editor.alignLeft" },
  { value: "center", icon: AlignCenter, label: "editor.alignCenter" },
  { value: "right", icon: AlignRight, label: "editor.alignRight" },
  { value: "justify", icon: AlignJustify, label: "editor.alignJustify" },
];

export interface PdfToolbarControls {
  zoomPercent: number;
  setZoomPercent: (percent: number) => void;
  fitWidth: () => void;
  compare: boolean;
  setCompare: (value: boolean) => void;
  showBoxes: boolean;
  setShowBoxes: (value: boolean) => void;
  showSource: boolean;
  setShowSource: (value: boolean) => void;
  pageCount: number;
  goToPage: (page: number) => void;
  fits: FitStore;
}

interface EditorToolbarProps {
  editor: Editor | null;
  findOpen: boolean;
  onToggleFind: () => void;
  /** Present for a PDF shown as pages. */
  pdf?: PdfToolbarControls;
  children?: ReactNode;
}

/** Every editing tool, in one compact row: history, find, formatting of the
 *  selected block, block actions and (for PDFs) the view. */
export function EditorToolbar({ editor, findOpen, onToggleFind, pdf, children }: EditorToolbarProps) {
  const { t } = useTranslation("translator");

  const state = useEditorState({
    editor,
    selector: ({ editor }) => {
      const found = editor ? findActiveSegment(editor.state) : null;
      return {
        canUndo: editor?.can().undo() ?? false,
        canRedo: editor?.can().redo() ?? false,
        active: found
          ? {
              key: found.node.attrs.key as string,
              layout: found.node.attrs.layout as SegmentLayout | null,
              style: found.node.attrs.style as SegmentStyle | null,
              isEdited: found.node.textContent !== found.node.attrs.initial,
              isEmpty: found.node.content.size === 0,
            }
          : null,
      };
    },
  });

  const active = state?.active ?? null;
  const layout = active?.layout ?? null;
  const style = layout ? resolveStyle(layout, active?.style) : null;
  const fit = useFit(pdf?.fits, active?.key);

  const run = (command: (chain: ReturnType<Editor["chain"]>) => ReturnType<Editor["chain"]>) =>
    editor && command(editor.chain().focus()).run();
  const setStyle = (patch: SegmentStyle | null) => run((chain) => chain.setSegmentStyle(patch));

  return (
    <div className="relative border-b border-border/60 bg-background/95 backdrop-blur">
      <div
        role="toolbar"
        aria-label={t("editor.toolbar")}
        className="flex h-10 items-center gap-0.5 overflow-x-auto px-2 [scrollbar-width:none] sm:px-3"
      >
        <ToolButton label={t("editor.undo")} disabled={!state?.canUndo} onClick={() => run((c) => c.undo())}>
          <Undo2 />
        </ToolButton>
        <ToolButton label={t("editor.redo")} disabled={!state?.canRedo} onClick={() => run((c) => c.redo())}>
          <Redo2 />
        </ToolButton>
        <ToolButton label={t("editor.find")} pressed={findOpen} onClick={onToggleFind}>
          <Search />
        </ToolButton>

        {pdf && (
          <>
            <Divider />
            <select
              aria-label={t("editor.fontFamily")}
              title={t("editor.fontFamily")}
              disabled={!style}
              value={style?.family ?? ""}
              onChange={(event) =>
                setStyle({ family: event.target.value as SegmentStyle["family"] })
              }
              className="h-7 w-28 shrink-0 rounded-xs border border-transparent bg-transparent px-1.5 text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-40"
            >
              {!style && <option value="">{t("editor.fontFamily")}</option>}
              {FONT_FAMILIES.map((family) => (
                <option key={family} value={family}>
                  {t(`editor.fonts.${family}`)}
                </option>
              ))}
            </select>
            <FontSize
              value={style?.font_size ?? null}
              onChange={(font_size) => setStyle({ font_size })}
            />
            <Divider />
            <ToolButton
              label={t("editor.bold")}
              disabled={!style}
              pressed={style?.bold}
              onClick={() => run((c) => c.toggleSegmentStyle("bold"))}
            >
              <Bold />
            </ToolButton>
            <ToolButton
              label={t("editor.italic")}
              disabled={!style}
              pressed={style?.italic}
              onClick={() => run((c) => c.toggleSegmentStyle("italic"))}
            >
              <Italic />
            </ToolButton>
            <label
              title={t("editor.textColor")}
              className={cn(
                "relative flex size-7 shrink-0 cursor-pointer flex-col items-center justify-center rounded-xs hover:bg-muted has-focus-visible:ring-2 has-focus-visible:ring-ring/40",
                !style && "pointer-events-none opacity-40",
              )}
            >
              <span className="text-sm leading-none font-semibold">A</span>
              <span
                className="mt-0.5 h-1 w-4 rounded-full ring-1 ring-black/10"
                style={{ background: style?.color ?? "currentColor" }}
              />
              <input
                type="color"
                aria-label={t("editor.textColor")}
                disabled={!style}
                value={style?.color ?? "#000000"}
                onChange={(event) => setStyle({ color: event.target.value })}
                className="absolute inset-0 size-full cursor-pointer opacity-0"
              />
            </label>
            <Divider />
            {ALIGNMENTS.map(({ value, icon: Icon, label }) => (
              <ToolButton
                key={value}
                label={t(label)}
                disabled={!style}
                pressed={style?.align === value}
                onClick={() => setStyle({ align: value })}
              >
                <Icon />
              </ToolButton>
            ))}
            <ToolButton
              label={t("editor.resetStyle")}
              disabled={!active?.style}
              onClick={() => setStyle(null)}
            >
              <RemoveFormatting />
            </ToolButton>
          </>
        )}

        <Divider />
        <ToolButton
          label={t("editor.restore")}
          disabled={!active?.isEdited}
          onClick={() => run((c) => c.restoreSegment())}
        >
          <RotateCcw />
        </ToolButton>
        <ToolButton
          label={t("editor.clear")}
          disabled={!active || active.isEmpty}
          onClick={() => run((c) => c.setSegmentText(""))}
        >
          <Eraser />
        </ToolButton>

        {pdf && fit < 1 && (
          <span
            title={t("editor.shrunkHelp")}
            className="ml-1 shrink-0 rounded-xs bg-rose-500/10 px-1.5 py-0.5 text-xs whitespace-nowrap text-rose-600 dark:text-rose-400"
          >
            {t("editor.shrunk", { percent: Math.round(fit * 100) })}
          </span>
        )}

        {pdf && (
          <div className="ml-auto flex shrink-0 items-center gap-0.5 pl-2">
            <ToolButton
              label={t("editor.sourceText")}
              pressed={pdf.showSource}
              onClick={() => pdf.setShowSource(!pdf.showSource)}
            >
              <ScanText />
            </ToolButton>
            <ToolButton
              label={t("editor.compare")}
              pressed={pdf.compare}
              onClick={() => pdf.setCompare(!pdf.compare)}
            >
              <Columns2 />
            </ToolButton>
            <ToolButton
              label={t("editor.showBoxes")}
              pressed={pdf.showBoxes}
              onClick={() => pdf.setShowBoxes(!pdf.showBoxes)}
            >
              <SquareDashed />
            </ToolButton>
            <Divider />
            <PageJump count={pdf.pageCount} onSelect={pdf.goToPage} />
            <Divider />
            <ToolButton
              label={t("editor.zoomOut")}
              disabled={pdf.zoomPercent <= MIN_ZOOM}
              onClick={() => pdf.setZoomPercent(stepZoom(pdf.zoomPercent, -1))}
            >
              <Minus />
            </ToolButton>
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label={t("editor.zoomLevel")}
                title={t("editor.zoomLevel")}
                className="flex h-7 w-16 shrink-0 cursor-pointer items-center justify-center gap-0.5 rounded-xs text-sm tabular-nums outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/40 data-popup-open:bg-muted"
              >
                {pdf.zoomPercent}%
                <ChevronDown className="size-3 text-muted-foreground" aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={pdf.fitWidth}>{t("editor.zoomFit")}</DropdownMenuItem>
                <DropdownMenuSeparator />
                {ZOOM_PRESETS.map((preset) => (
                  <DropdownMenuItem key={preset} onClick={() => pdf.setZoomPercent(preset)}>
                    {preset}%
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <ToolButton
              label={t("editor.zoomIn")}
              disabled={pdf.zoomPercent >= MAX_ZOOM}
              onClick={() => pdf.setZoomPercent(stepZoom(pdf.zoomPercent, 1))}
            >
              <Plus />
            </ToolButton>
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

function stepZoom(current: number, direction: 1 | -1): number {
  const next =
    direction > 0
      ? ZOOM_PRESETS.find((preset) => preset > current)
      : [...ZOOM_PRESETS].reverse().find((preset) => preset < current);
  return next ?? Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current + direction * 25));
}

function ToolButton({
  label,
  pressed,
  disabled,
  onClick,
  children,
}: {
  label: string;
  pressed?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      // Keep the editor's selection while clicking.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn("disabled:opacity-35", pressed && "bg-muted text-foreground")}
    >
      {children}
    </Button>
  );
}

function Divider() {
  return <span aria-hidden className="mx-1 h-4 w-px shrink-0 bg-border" />;
}

function FontSize({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (value: number) => void;
}) {
  const { t } = useTranslation("translator");
  const shown = value === null ? "" : String(Math.round(value * 10) / 10);
  const [draft, setDraft] = useState<string | null>(null);

  const commit = (next: number) => {
    if (Number.isFinite(next)) onChange(Math.min(96, Math.max(4, Math.round(next * 10) / 10)));
  };

  return (
    <div className="flex shrink-0 items-center">
      <ToolButton
        label={t("editor.decreaseFontSize")}
        disabled={value === null}
        onClick={() => value !== null && commit(value - 0.5)}
      >
        <Minus />
      </ToolButton>
      <input
        type="number"
        inputMode="decimal"
        min={4}
        max={96}
        step={0.5}
        aria-label={t("editor.fontSize")}
        title={t("editor.fontSize")}
        disabled={value === null}
        value={draft ?? shown}
        onFocus={() => setDraft(shown)}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          if (draft !== null && draft !== shown) commit(Number(draft));
          setDraft(null);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") {
            setDraft(null);
            event.currentTarget.blur();
          }
        }}
        className="h-7 w-11 rounded-xs border border-border bg-background text-center text-sm tabular-nums outline-none [appearance:textfield] focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-40 [&::-webkit-inner-spin-button]:appearance-none"
      />
      <ToolButton
        label={t("editor.increaseFontSize")}
        disabled={value === null}
        onClick={() => value !== null && commit(value + 0.5)}
      >
        <Plus />
      </ToolButton>
    </div>
  );
}

function PageJump({ count, onSelect }: { count: number; onSelect: (page: number) => void }) {
  const { t } = useTranslation("translator");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("editor.goToPage")}
        title={t("editor.goToPage")}
        className="flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-xs px-1.5 text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/40 data-popup-open:bg-muted"
      >
        <FileSearch className="size-4" aria-hidden />
        <span className="tabular-nums">{t("editor.pageCount", { count })}</span>
        <ChevronDown className="size-3 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-72 w-36">
        {Array.from({ length: count }, (_, page) => (
          <DropdownMenuItem key={page} onClick={() => onSelect(page)}>
            {t("editor.page", { page: page + 1 })}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
