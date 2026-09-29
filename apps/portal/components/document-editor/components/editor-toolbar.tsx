"use client";

import { useState, type ReactNode } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import { useTranslation } from "react-i18next";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Baseline,
  Bold,
  ChevronDown,
  Columns2,
  Eraser,
  Highlighter,
  IndentDecrease,
  IndentIncrease,
  Italic,
  List,
  ListCollapse,
  ListOrdered,
  ListTodo,
  Minus,
  Omega,
  Plus,
  SquarePlus,
  Printer,
  Redo2,
  RemoveFormatting,
  RotateCcw,
  ScanText,
  Search,
  SquareDashed,
  Strikethrough,
  Underline,
  Undo2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import type { HeadingKind, TextAlign } from "../type";
import { HEADING_FALLBACKS, fontStack, type DocxStyles } from "./docx-style";
import {
  MAX_FONT_SIZE,
  MIN_FONT_SIZE,
  activeFormat,
  type EditorActions,
  type EditorMode,
} from "./editor-commands";
import { BLOCK_ITEMS } from "./block-items";
import { normalizeColor } from "./format-marks";
import { useFit, type FitStore } from "./pdf-view-context";
import { FONT_FAMILIES, FONT_STACKS } from "./segment-style";

export const ZOOM_PRESETS = [50, 75, 90, 100, 110, 125, 150, 175, 200] as const;
export const MIN_ZOOM = 25;
export const MAX_ZOOM = 300;

const ALIGNMENTS: { value: TextAlign; icon: typeof AlignLeft; label: string }[] = [
  { value: "left", icon: AlignLeft, label: "alignLeft" },
  { value: "center", icon: AlignCenter, label: "alignCenter" },
  { value: "right", icon: AlignRight, label: "alignRight" },
  { value: "justify", icon: AlignJustify, label: "alignJustify" },
];

export const HEADINGS: HeadingKind[] = ["normal", "title", "subtitle", "h1", "h2", "h3", "h4", "h5", "h6"];

/** Fonts offered for Word documents, besides the ones the document uses. */
const COMMON_FONTS = [
  "Arial",
  "Calibri",
  "Cambria",
  "Courier New",
  "Georgia",
  "Tahoma",
  "Times New Roman",
  "Verdana",
  "Microsoft YaHei",
  "SimSun",
];

export const LINE_SPACINGS = [1, 1.15, 1.5, 2] as const;

// Google Docs' palette: greys, then the saturated colours and two lighter rows.
const TEXT_COLORS = [
  "#000000", "#434343", "#666666", "#999999", "#b7b7b7", "#cccccc", "#d9d9d9", "#efefef", "#f3f3f3", "#ffffff",
  "#980000", "#ff0000", "#ff9900", "#ffff00", "#00ff00", "#00ffff", "#4a86e8", "#0000ff", "#9900ff", "#ff00ff",
  "#e6b8af", "#f4cccc", "#fce5cd", "#fff2cc", "#d9ead3", "#d0e0e3", "#c9daf8", "#cfe2f3", "#d9d2e9", "#ead1dc",
  "#cc4125", "#e06666", "#f6b26b", "#ffd966", "#93c47d", "#76a5af", "#6d9eeb", "#6fa8dc", "#8e7cc3", "#c27ba0",
  "#85200c", "#990000", "#b45f06", "#bf9000", "#38761d", "#134f5c", "#1155cc", "#0b5394", "#351c75", "#741b47",
];

export const SPECIAL_CHARACTERS: { group: string; chars: string[] }[] = [
  { group: "punctuation", chars: ["—", "–", "…", "•", "·", "¶", "§", "†", "‡", "«", "»", "“", "”", "‘", "’", "「", "」", "『", "』", "、", "。", "，", "：", "；"] },
  { group: "symbols", chars: ["©", "®", "™", "°", "±", "×", "÷", "≈", "≠", "≤", "≥", "∞", "√", "‰", "µ", "½", "¼", "¾", "²", "³"] },
  { group: "currency", chars: ["$", "€", "£", "¥", "₩", "₹", "Rp", "¢", "₫", "฿"] },
  { group: "arrows", chars: ["←", "→", "↑", "↓", "↔", "⇒", "⇔", "✓", "✗", "★", "☐", "☑"] },
];

export interface PdfToolbarControls {
  compare: boolean;
  setCompare: (value: boolean) => void;
  showBoxes: boolean;
  setShowBoxes: (value: boolean) => void;
  showSource: boolean;
  setShowSource: (value: boolean) => void;
  fits: FitStore;
}

export interface ZoomControls {
  zoomPercent: number;
  setZoomPercent: (percent: number) => void;
  fitWidth: () => void;
}

interface EditorToolbarProps {
  editor: Editor | null;
  mode: EditorMode;
  docx: DocxStyles | null;
  actions: EditorActions;
  findOpen: boolean;
  onToggleFind: () => void;
  onPrint: () => void;
  zoom: ZoomControls;
  /** Fonts the document uses, offered first. */
  documentFonts: string[];
  showSource: boolean;
  onToggleSource: () => void;
  /** Present for a PDF shown as pages. */
  pdf?: PdfToolbarControls;
  /** Opens the file picker for an image; without it images can't be added. */
  onInsertImage?: () => void;
  children?: ReactNode;
}

/** The formatting toolbar, in the order Google Docs has it. */
export function EditorToolbar({
  editor,
  mode,
  docx,
  actions,
  findOpen,
  onToggleFind,
  onPrint,
  zoom,
  documentFonts,
  showSource,
  onToggleSource,
  pdf,
  onInsertImage,
  children,
}: EditorToolbarProps) {
  const { t } = useTranslation("editor");

  const state = useEditorState({
    editor,
    selector: ({ editor }) => {
      if (!editor) return null;
      return {
        canUndo: editor.can().undo(),
        canRedo: editor.can().redo(),
        bold: editor.isActive("bold"),
        italic: editor.isActive("italic"),
        underline: editor.isActive("underline"),
        strike: editor.isActive("strike"),
        color: (editor.getAttributes("textStyle").color as string | undefined) ?? null,
        highlight: (editor.getAttributes("highlight").color as string | undefined) ?? null,
        active: activeFormat(editor.state, docx),
      };
    },
  });

  const active = state?.active ?? null;
  const fit = useFit(pdf?.fits, active?.key);
  const hasText = !!active;
  const formatted = mode !== "blocks";
  const inserted = !!active?.inserted;
  const isList = inserted && ["bullet", "numbered", "todo"].includes(active?.kind ?? "");

  const fonts =
    mode === "pdf"
      ? FONT_FAMILIES.map((family) => ({ value: family, label: t(`fonts.${family}`), stack: FONT_STACKS[family] }))
      : [...new Set([...documentFonts, ...COMMON_FONTS])].map((family) => ({
          value: family,
          label: family,
          stack: fontStack(family),
        }));

  return (
    <div className="relative bg-background px-2 pb-1.5 sm:px-3">
      <div
        role="toolbar"
        aria-label={t("toolbar")}
        className="flex h-10 items-center gap-0.5 overflow-x-auto rounded-full bg-muted/70 px-2 scrollbar-none dark:bg-muted/40"
      >
        <ToolButton label={t("undoShortcut")} disabled={!state?.canUndo} onClick={actions.undo}>
          <Undo2 />
        </ToolButton>
        <ToolButton label={t("redoShortcut")} disabled={!state?.canRedo} onClick={actions.redo}>
          <Redo2 />
        </ToolButton>
        <ToolButton label={t("printShortcut")} onClick={onPrint}>
          <Printer />
        </ToolButton>
        <ToolButton label={t("find")} pressed={findOpen} onClick={onToggleFind}>
          <Search />
        </ToolButton>

        <Divider />
        <ZoomMenu zoom={zoom} />

        {mode === "docx" && (
          <>
            <Divider />
            <InsertMenu actions={actions} onInsertImage={onInsertImage} disabled={!editor} />
            <Divider />
            <StyleMenu
              value={active?.heading ?? null}
              disabled={!hasText}
              docx={docx}
              onSelect={actions.setHeading}
            />
          </>
        )}

        {formatted && (
          <>
            <Divider />
            <FontMenu
              value={active?.family ?? null}
              fonts={fonts}
              disabled={!active?.family}
              onSelect={actions.setFamily}
            />
            <Divider />
            <FontSize
              value={active?.fontSize ?? null}
              onChange={actions.setFontSize}
              onStep={actions.changeFontSize}
            />
          </>
        )}

        <Divider />
        <ToolButton label={t("bold")} disabled={!hasText} pressed={state?.bold} onClick={actions.toggleBold}>
          <Bold />
        </ToolButton>
        <ToolButton label={t("italic")} disabled={!hasText} pressed={state?.italic} onClick={actions.toggleItalic}>
          <Italic />
        </ToolButton>
        <ToolButton
          label={t("underline")}
          disabled={!hasText}
          pressed={state?.underline}
          onClick={actions.toggleUnderline}
        >
          <Underline />
        </ToolButton>
        <ToolButton
          label={t("strike")}
          disabled={!hasText}
          pressed={state?.strike}
          onClick={actions.toggleStrike}
        >
          <Strikethrough />
        </ToolButton>
        <ColorMenu
          label={t("textColor")}
          icon={Baseline}
          value={state?.color ?? active?.color ?? null}
          disabled={!hasText}
          resetLabel={t("colorReset")}
          onSelect={actions.setColor}
        />
        <ColorMenu
          label={t("highlightColor")}
          icon={Highlighter}
          value={state?.highlight ?? null}
          disabled={!hasText}
          resetLabel={t("highlightNone")}
          onSelect={actions.setHighlight}
        />

        {formatted && (
          <>
            <Divider />
            {ALIGNMENTS.map(({ value, icon: Icon, label }) => (
              <ToolButton
                key={value}
                label={t(label)}
                disabled={!active?.align}
                pressed={active?.align === value}
                onClick={() => actions.setAlign(value)}
              >
                <Icon />
              </ToolButton>
            ))}
          </>
        )}

        {mode === "docx" && (
          <>
            <ToolButton
              label={t("blocks.items.bullet")}
              pressed={active?.kind === "bullet"}
              onClick={() => actions.setBlockKind("bullet")}
            >
              <List />
            </ToolButton>
            <ToolButton
              label={t("blocks.items.numbered")}
              pressed={active?.kind === "numbered"}
              onClick={() => actions.setBlockKind("numbered")}
            >
              <ListOrdered />
            </ToolButton>
            <ToolButton
              label={t("blocks.items.todo")}
              pressed={active?.kind === "todo"}
              onClick={() => actions.setBlockKind("todo")}
            >
              <ListTodo />
            </ToolButton>
            <LineSpacingMenu
              disabled={!hasText || inserted}
              value={active?.lineSpacing ?? null}
              spaceBefore={active?.spaceBefore ?? 0}
              spaceAfter={active?.spaceAfter ?? 0}
              actions={actions}
            />
            <ToolButton
              label={t("indentDecrease")}
              disabled={!hasText || (inserted ? !isList : !active?.indentLeft)}
              onClick={() => actions.indent(-1)}
            >
              <IndentDecrease />
            </ToolButton>
            <ToolButton
              label={t("indentIncrease")}
              disabled={!hasText || (inserted && !isList)}
              onClick={() => actions.indent(1)}
            >
              <IndentIncrease />
            </ToolButton>
          </>
        )}

        <Divider />
        <ToolButton label={t("clearFormatting")} disabled={!hasText} onClick={actions.clearFormatting}>
          <RemoveFormatting />
        </ToolButton>
        <SpecialCharactersMenu disabled={!hasText} onSelect={actions.insertText} />

        <Divider />
        <ToolButton label={t("restore")} disabled={!active?.isEdited} onClick={actions.restore}>
          <RotateCcw />
        </ToolButton>
        <ToolButton label={t("clear")} disabled={!active || inserted || active.isEmpty} onClick={actions.clearText}>
          <Eraser />
        </ToolButton>

        {pdf && fit < 1 && (
          <span
            title={t("shrunkHelp")}
            className="ml-1 shrink-0 rounded-xs bg-rose-500/10 px-1.5 py-0.5 text-xs whitespace-nowrap text-rose-600 dark:text-rose-400"
          >
            {t("shrunk", { percent: Math.round(fit * 100) })}
          </span>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-0.5 pl-2">
          <ToolButton
            label={t("sourceText")}
            pressed={pdf ? pdf.showSource : showSource}
            onClick={pdf ? () => pdf.setShowSource(!pdf.showSource) : onToggleSource}
          >
            <ScanText />
          </ToolButton>
          {pdf && (
            <>
              <ToolButton label={t("compare")} pressed={pdf.compare} onClick={() => pdf.setCompare(!pdf.compare)}>
                <Columns2 />
              </ToolButton>
              <ToolButton
                label={t("showBoxes")}
                pressed={pdf.showBoxes}
                onClick={() => pdf.setShowBoxes(!pdf.showBoxes)}
              >
                <SquareDashed />
              </ToolButton>
            </>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

export function stepZoom(current: number, direction: 1 | -1): number {
  const next =
    direction > 0
      ? ZOOM_PRESETS.find((preset) => preset > current)
      : [...ZOOM_PRESETS].reverse().find((preset) => preset < current);
  return next ?? Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current + direction * 25));
}

export function ToolButton({
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
      className={cn(
        "shrink-0 rounded-sm hover:bg-foreground/8 disabled:opacity-35",
        pressed && "bg-primary/12 text-primary hover:bg-primary/15",
      )}
    >
      {children}
    </Button>
  );
}

function Divider() {
  return <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-foreground/15" />;
}

const triggerClass =
  "flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-sm px-1.5 text-sm outline-none hover:bg-foreground/8 focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent data-popup-open:bg-foreground/8";

/** Rows × columns of a new table, chosen by hovering a grid, like Google Docs. */
export function TableSizePicker({ onPick }: { onPick: (rows: number, cols: number) => void }) {
  const { t } = useTranslation("editor");
  const [size, setSize] = useState({ rows: 0, cols: 0 });
  const max = 8;
  return (
    <div className="p-1.5" onMouseLeave={() => setSize({ rows: 0, cols: 0 })}>
      <div className="grid grid-cols-8 gap-0.5" role="grid" aria-label={t("blocks.table.size")}>
        {Array.from({ length: max * max }, (_, index) => {
          const row = Math.floor(index / max) + 1;
          const col = (index % max) + 1;
          const on = row <= size.rows && col <= size.cols;
          return (
            <button
              key={index}
              type="button"
              aria-label={t("blocks.table.dimensions", { rows: row, cols: col })}
              onMouseEnter={() => setSize({ rows: row, cols: col })}
              onFocus={() => setSize({ rows: row, cols: col })}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onPick(row, col)}
              className={cn(
                "size-4.5 cursor-pointer rounded-[2px] border",
                on ? "border-primary/60 bg-primary/20" : "border-foreground/20 bg-background",
              )}
            />
          );
        })}
      </div>
      <p className="mt-1.5 text-center text-xs text-muted-foreground tabular-nums">
        {size.rows ? t("blocks.table.dimensions", { rows: size.rows, cols: size.cols }) : t("blocks.table.size")}
      </p>
    </div>
  );
}

/** Blocks a Word document can be given: tables, images, lists, dividers… */
function InsertMenu({
  actions,
  onInsertImage,
  disabled,
}: {
  actions: EditorActions;
  onInsertImage?: () => void;
  disabled: boolean;
}) {
  const { t } = useTranslation("editor");
  const [open, setOpen] = useState(false);
  const run = (id: string) => {
    setOpen(false);
    if (id === "image") onInsertImage?.();
    else if (id === "divider") actions.insertDivider();
    else if (id === "pageBreak") actions.insertPageBreak();
    else {
      const item = BLOCK_ITEMS.find((candidate) => candidate.id === id);
      if (item?.kind) actions.setBlockKind(item.kind);
    }
  };
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        disabled={disabled}
        aria-label={t("blocks.insert")}
        title={t("blocks.insertHint")}
        className={cn(triggerClass, "gap-1")}
      >
        <SquarePlus className="size-4" aria-hidden />
        <span className="hidden lg:inline">{t("blocks.insert")}</span>
        <ChevronDown className="size-3 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel>{t("blocks.items.table")}</DropdownMenuLabel>
        <TableSizePicker
          onPick={(rows, cols) => {
            setOpen(false);
            actions.insertTable(rows, cols);
          }}
        />
        <DropdownMenuSeparator />
        {BLOCK_ITEMS.filter((item) => item.id !== "table" && (item.id !== "image" || onInsertImage)).map((item) => {
          const Icon = item.icon;
          return (
            <DropdownMenuItem key={item.id} onClick={() => run(item.id)}>
              <Icon aria-hidden />
              {t(`blocks.items.${item.id}`)}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ZoomMenu({ zoom }: { zoom: ZoomControls }) {
  const { t } = useTranslation("editor");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label={t("zoomLevel")} title={t("zoomLevel")} className={cn(triggerClass, "w-17 justify-between tabular-nums")}>
        {zoom.zoomPercent}%
        <ChevronDown className="size-3 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-40">
        <DropdownMenuItem onClick={zoom.fitWidth}>{t("zoomFit")}</DropdownMenuItem>
        <DropdownMenuSeparator />
        {ZOOM_PRESETS.map((preset) => (
          <DropdownMenuItem key={preset} onClick={() => zoom.setZoomPercent(preset)}>
            {preset}%
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** How a paragraph style looks in the menu: its size and weight, like Google Docs'. */
function headingPreview(kind: HeadingKind, docx: DocxStyles | null): React.CSSProperties {
  const named = docx?.styles[kind];
  const run = named ? docx.runStyles[named.run] : null;
  const size = run?.size ?? (kind === "normal" ? 11 : HEADING_FALLBACKS[kind].size);
  return {
    fontSize: `${Math.min(22, Math.max(12, size * 0.9))}px`,
    fontWeight: (run?.bold ?? (kind !== "normal" && HEADING_FALLBACKS[kind].bold)) ? 700 : 400,
    fontStyle: run?.italic ? "italic" : undefined,
    color: run?.color ?? (kind === "subtitle" ? "#666666" : undefined),
    fontFamily: run ? fontStack(run.family, run.east_asia) : undefined,
  };
}

function StyleMenu({
  value,
  disabled,
  docx,
  onSelect,
}: {
  value: HeadingKind | null;
  disabled: boolean;
  docx: DocxStyles | null;
  onSelect: (kind: HeadingKind) => void;
}) {
  const { t } = useTranslation("editor");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        aria-label={t("paragraphStyle")}
        title={t("paragraphStyle")}
        className={cn(triggerClass, "w-32 justify-between")}
      >
        <span className="truncate">{t(`headings.${value ?? "normal"}`)}</span>
        <ChevronDown className="size-3 shrink-0 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {HEADINGS.map((kind) => (
          <DropdownMenuItem
            key={kind}
            onClick={() => onSelect(kind)}
            className={cn("py-1.5", value === kind && "bg-accent/60")}
          >
            <span style={headingPreview(kind, docx)} className="truncate leading-tight">
              {t(`headings.${kind}`)}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function FontMenu({
  value,
  fonts,
  disabled,
  onSelect,
}: {
  value: string | null;
  fonts: { value: string; label: string; stack: string }[];
  disabled: boolean;
  onSelect: (family: string) => void;
}) {
  const { t } = useTranslation("editor");
  const current = fonts.find((font) => font.value === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        aria-label={t("fontFamily")}
        title={t("fontFamily")}
        className={cn(triggerClass, "w-32 justify-between")}
      >
        <span className="truncate">{current?.label ?? value ?? t("fontFamily")}</span>
        <ChevronDown className="size-3 shrink-0 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 w-56">
        {fonts.map((font) => (
          <DropdownMenuItem
            key={font.value}
            onClick={() => onSelect(font.value)}
            className={cn(value === font.value && "bg-accent/60")}
          >
            <span style={{ fontFamily: font.stack }} className="truncate">
              {font.label}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function FontSize({
  value,
  onChange,
  onStep,
}: {
  value: number | null;
  onChange: (value: number) => void;
  onStep: (delta: number) => void;
}) {
  const { t } = useTranslation("editor");
  const shown = value === null ? "" : String(Math.round(value * 10) / 10);
  const [draft, setDraft] = useState<string | null>(null);

  const commit = (next: number) => {
    if (Number.isFinite(next)) onChange(next);
  };

  return (
    <div className="flex shrink-0 items-center">
      <ToolButton
        label={t("decreaseFontSize")}
        disabled={value === null || value <= MIN_FONT_SIZE}
        onClick={() => onStep(-1)}
      >
        <Minus />
      </ToolButton>
      <input
        type="number"
        inputMode="decimal"
        min={MIN_FONT_SIZE}
        max={MAX_FONT_SIZE}
        step={0.5}
        aria-label={t("fontSize")}
        title={t("fontSize")}
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
        className="h-7 w-10 rounded-sm border border-foreground/20 bg-background text-center text-sm tabular-nums outline-none [appearance:textfield] focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-40 [&::-webkit-inner-spin-button]:appearance-none"
      />
      <ToolButton
        label={t("increaseFontSize")}
        disabled={value === null || value >= MAX_FONT_SIZE}
        onClick={() => onStep(1)}
      >
        <Plus />
      </ToolButton>
    </div>
  );
}

function ColorMenu({
  label,
  icon: Icon,
  value,
  disabled,
  resetLabel,
  onSelect,
}: {
  label: string;
  icon: typeof Baseline;
  value: string | null;
  disabled: boolean;
  resetLabel: string;
  onSelect: (color: string | null) => void;
}) {
  const { t } = useTranslation("editor");
  const [open, setOpen] = useState(false);
  const current = value ? normalizeColor(value) : undefined;
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        disabled={disabled}
        aria-label={label}
        title={label}
        className={cn(triggerClass, "relative size-7 flex-col justify-center gap-0 px-0")}
      >
        <Icon className="size-4" aria-hidden />
        <span
          aria-hidden
          className="-mt-0.5 h-0.75 w-4 rounded-full ring-1 ring-black/10"
          style={{ background: current && current !== "transparent" ? current : "transparent" }}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-auto p-2">
        <DropdownMenuItem onClick={() => onSelect(null)} className="mb-1.5">
          {resetLabel}
        </DropdownMenuItem>
        <div className="grid grid-cols-10 gap-1" role="group" aria-label={label}>
          {TEXT_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={color}
              title={color}
              onClick={() => {
                onSelect(color);
                setOpen(false);
              }}
              className={cn(
                "size-5 cursor-pointer rounded-full ring-1 ring-black/15 transition-transform outline-none hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring",
                current === color && "ring-2 ring-primary ring-offset-1",
              )}
              style={{ background: color }}
            />
          ))}
        </div>
        <label className="mt-2 flex cursor-pointer items-center gap-2 rounded-xs px-1.5 py-1 text-sm hover:bg-accent">
          <span
            aria-hidden
            className="size-5 rounded-full ring-1 ring-black/15"
            style={{ background: "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)" }}
          />
          {t("customColor")}
          <input
            type="color"
            className="sr-only"
            value={current && current !== "transparent" ? current : "#000000"}
            onChange={(event) => onSelect(event.target.value)}
          />
        </label>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function LineSpacingMenu({
  disabled,
  value,
  spaceBefore,
  spaceAfter,
  actions,
}: {
  disabled: boolean;
  value: number | null;
  spaceBefore: number;
  spaceAfter: number;
  actions: EditorActions;
}) {
  const { t } = useTranslation("editor");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        aria-label={t("lineSpacing")}
        title={t("lineSpacing")}
        className={cn(triggerClass, "size-7 justify-center px-0")}
      >
        <ListCollapse className="size-4" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>{t("lineSpacing")}</DropdownMenuLabel>
        {LINE_SPACINGS.map((spacing) => (
          <DropdownMenuItem
            key={spacing}
            onClick={() => actions.setLineSpacing(spacing)}
            className={cn(value !== null && Math.abs(value - spacing) < 0.01 && "bg-accent/60")}
          >
            {t(`spacing.${String(spacing).replace(".", "_")}`)}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => actions.setSpaceBefore(spaceBefore > 0 ? 0 : 10)}>
          {t(spaceBefore > 0 ? "removeSpaceBefore" : "addSpaceBefore")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => actions.setSpaceAfter(spaceAfter > 0 ? 0 : 10)}>
          {t(spaceAfter > 0 ? "removeSpaceAfter" : "addSpaceAfter")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SpecialCharactersMenu({
  disabled,
  onSelect,
}: {
  disabled: boolean;
  onSelect: (text: string) => void;
}) {
  const { t } = useTranslation("editor");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        aria-label={t("specialCharacters")}
        title={t("specialCharacters")}
        className={cn(triggerClass, "size-7 justify-center px-0")}
      >
        <Omega className="size-4" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72 p-2">
        {SPECIAL_CHARACTERS.map(({ group, chars }) => (
          <div key={group} className="mb-2 last:mb-0">
            <p className="mb-1 px-1 text-xs font-medium text-muted-foreground">
              {t(`characterGroups.${group}`)}
            </p>
            <div className="grid grid-cols-8 gap-0.5">
              {chars.map((char) => (
                <DropdownMenuItem
                  key={char}
                  title={char}
                  onClick={() => onSelect(char)}
                  className="h-8 justify-center px-0 text-base"
                >
                  {char}
                </DropdownMenuItem>
              ))}
            </div>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
