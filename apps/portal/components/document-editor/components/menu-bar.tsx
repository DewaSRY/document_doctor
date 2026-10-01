"use client";

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Menu as MenuIcon } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { HeadingKind, TextAlign } from "../type";
import { BLOCK_ITEMS } from "./block-items";
import type { EditorActions, EditorMode } from "./editor-commands";
import {
  HEADINGS,
  LINE_SPACINGS,
  SPECIAL_CHARACTERS,
  TableSizePicker,
  ZOOM_PRESETS,
  type PdfToolbarControls,
  type ZoomControls,
} from "./editor-toolbar";

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const mod = isMac ? "⌘" : "Ctrl+";
const shift = isMac ? "⇧" : "Shift+";
const alt = isMac ? "⌥" : "Alt+";

interface MenuBarProps {
  mode: EditorMode;
  actions: EditorActions;
  canSave: boolean;
  onSave: () => void;
  /** Omitted when the document can't be downloaded. */
  onDownload?: () => void;
  onPrint: () => void;
  onBack: () => void;
  onFind: () => void;
  onWordCount: () => void;
  onCopyLink: () => void;
  zoom: ZoomControls;
  showSource: boolean;
  onToggleSource: () => void;
  pdf?: PdfToolbarControls;
  /** Opens the file picker for an image; without it images can't be added. */
  onInsertImage?: () => void;
}

/** Every document command — File, Edit, View, Insert, Format and Tools —
 *  grouped behind one compact overflow menu instead of a persistent bar. */
export function MenuBar({
  mode,
  actions,
  canSave,
  onSave,
  onDownload,
  onPrint,
  onBack,
  onFind,
  onWordCount,
  onCopyLink,
  zoom,
  showSource,
  onToggleSource,
  pdf,
  onInsertImage,
}: MenuBarProps) {
  const { t } = useTranslation("editor");
  const docx = mode === "docx";
  const aligned = mode !== "blocks";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("menu.label")}
        title={t("menu.label")}
        className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-[min(var(--radius-md),12px)] text-foreground/80 outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 data-popup-open:bg-muted data-popup-open:text-foreground"
      >
        <MenuIcon className="size-4" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <Menu label={t("menu.file")}>
          <Item onClick={onSave} disabled={!canSave} shortcut={`${mod}S`}>
            {t("save")}
          </Item>
          {onDownload && (
            <Item onClick={onDownload}>{t("menu.downloadFile")}</Item>
          )}
          <Item onClick={onCopyLink}>{t("copyLink")}</Item>
          <DropdownMenuSeparator />
          <Item onClick={onPrint} shortcut={`${mod}P`}>
            {t("print")}
          </Item>
          <DropdownMenuSeparator />
          <Item onClick={onBack}>{t("menu.close")}</Item>
        </Menu>

        <Menu label={t("menu.edit")}>
          <Item onClick={actions.undo} shortcut={`${mod}Z`}>
            {t("undo")}
          </Item>
          <Item onClick={actions.redo} shortcut={`${mod}${shift}Z`}>
            {t("redo")}
          </Item>
          <DropdownMenuSeparator />
          <Item onClick={actions.selectAll} shortcut={`${mod}A`}>
            {t("menu.selectAll")}
          </Item>
          <Item onClick={onFind} shortcut={`${mod}F`}>
            {t("menu.findReplace")}
          </Item>
          <DropdownMenuSeparator />
          <Item onClick={actions.restore}>{t("restore")}</Item>
          <Item onClick={actions.clearText}>{t("clear")}</Item>
        </Menu>

        <Menu label={t("menu.view")}>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>{t("zoomLevel")}</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-40">
              <Item onClick={zoom.fitWidth}>{t("zoomFit")}</Item>
              <DropdownMenuSeparator />
              {ZOOM_PRESETS.map((preset) => (
                <DropdownMenuCheckboxItem
                  key={preset}
                  checked={zoom.zoomPercent === preset}
                  onCheckedChange={() => zoom.setZoomPercent(preset)}
                >
                  {preset}%
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem
            checked={pdf ? pdf.showSource : showSource}
            onCheckedChange={() =>
              pdf ? pdf.setShowSource(!pdf.showSource) : onToggleSource()
            }
          >
            {t("sourceText")}
          </DropdownMenuCheckboxItem>
          {pdf && (
            <>
              <DropdownMenuCheckboxItem
                checked={pdf.compare}
                onCheckedChange={() => pdf.setCompare(!pdf.compare)}
              >
                {t("compare")}
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={pdf.showBoxes}
                onCheckedChange={() => pdf.setShowBoxes(!pdf.showBoxes)}
              >
                {t("showBoxes")}
              </DropdownMenuCheckboxItem>
            </>
          )}
        </Menu>

        <Menu label={t("menu.insert")}>
          {docx && (
            <>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  {t("blocks.items.table")}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-auto">
                  <TableSizePicker
                    onPick={(rows, cols) => actions.insertTable(rows, cols)}
                  />
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              {onInsertImage && (
                <Item onClick={onInsertImage}>{t("blocks.items.image")}</Item>
              )}
              <Item onClick={actions.insertDivider}>
                {t("blocks.items.divider")}
              </Item>
              <Item onClick={actions.insertPageBreak} shortcut={`${mod}↵`}>
                {t("blocks.items.pageBreak")}
              </Item>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  {t("blocks.block")}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-56">
                  {BLOCK_ITEMS.filter((item) => item.kind).map((item) => (
                    <Item
                      key={item.id}
                      onClick={() => actions.setBlockKind(item.kind!)}
                      shortcut={
                        item.id === "numbered"
                          ? `${mod}${shift}7`
                          : item.id === "bullet"
                            ? `${mod}${shift}8`
                            : item.id === "todo"
                              ? `${mod}${shift}9`
                              : undefined
                      }
                    >
                      {t(`blocks.items.${item.id}`)}
                    </Item>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              {t("specialCharacters")}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-72 p-2">
              {SPECIAL_CHARACTERS.map(({ group, chars }) => (
                <div key={group} className="mb-2 last:mb-0">
                  <p className="mb-1 px-1 text-xs font-medium text-muted-foreground">
                    {t(`characterGroups.${group}`)}
                  </p>
                  <div className="grid grid-cols-8 gap-0.5">
                    {chars.map((char) => (
                      <DropdownMenuItem
                        key={char}
                        onClick={() => actions.insertText(char)}
                        className="h-8 justify-center px-0 text-base"
                      >
                        {char}
                      </DropdownMenuItem>
                    ))}
                  </div>
                </div>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <Item onClick={() => actions.insertText(" ")}>
            {t("menu.nonBreakingSpace")}
          </Item>
        </Menu>

        <Menu label={t("menu.format")}>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>{t("menu.text")}</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-60">
              <Item onClick={actions.toggleBold} shortcut={`${mod}B`}>
                {t("menu.bold")}
              </Item>
              <Item onClick={actions.toggleItalic} shortcut={`${mod}I`}>
                {t("menu.italic")}
              </Item>
              <Item onClick={actions.toggleUnderline} shortcut={`${mod}U`}>
                {t("menu.underline")}
              </Item>
              <Item onClick={actions.toggleStrike} shortcut={`${alt}${shift}5`}>
                {t("menu.strike")}
              </Item>
              {aligned && (
                <>
                  <DropdownMenuSeparator />
                  <Item
                    onClick={() => actions.changeFontSize(1)}
                    shortcut={`${mod}${shift}.`}
                  >
                    {t("increaseFontSize")}
                  </Item>
                  <Item
                    onClick={() => actions.changeFontSize(-1)}
                    shortcut={`${mod}${shift},`}
                  >
                    {t("decreaseFontSize")}
                  </Item>
                </>
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          {docx && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                {t("paragraphStyle")}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-56">
                {HEADINGS.map((kind: HeadingKind, index) => (
                  <Item
                    key={kind}
                    onClick={() => actions.setHeading(kind)}
                    shortcut={
                      index === 0
                        ? `${mod}${alt}0`
                        : index >= 3
                          ? `${mod}${alt}${index - 2}`
                          : undefined
                    }
                  >
                    {t(`headings.${kind}`)}
                  </Item>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}
          {aligned && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                {t("menu.alignIndent")}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-60">
                {(
                  [
                    ["left", "alignLeft", "L"],
                    ["center", "alignCenter", "E"],
                    ["right", "alignRight", "R"],
                    ["justify", "alignJustify", "J"],
                  ] as [TextAlign, string, string][]
                ).map(([value, label, key]) => (
                  <Item
                    key={value}
                    onClick={() => actions.setAlign(value)}
                    shortcut={`${mod}${shift}${key}`}
                  >
                    {t(label)}
                  </Item>
                ))}
                {docx && (
                  <>
                    <DropdownMenuSeparator />
                    <Item
                      onClick={() => actions.indent(1)}
                      shortcut={`${mod}]`}
                    >
                      {t("menu.indentIncrease")}
                    </Item>
                    <Item
                      onClick={() => actions.indent(-1)}
                      shortcut={`${mod}[`}
                    >
                      {t("menu.indentDecrease")}
                    </Item>
                  </>
                )}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}
          {docx && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                {t("lineSpacing")}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-56">
                {LINE_SPACINGS.map((spacing) => (
                  <Item
                    key={spacing}
                    onClick={() => actions.setLineSpacing(spacing)}
                  >
                    {t(`spacing.${String(spacing).replace(".", "_")}`)}
                  </Item>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}
          <DropdownMenuSeparator />
          <Item onClick={actions.clearFormatting} shortcut={`${mod}\\`}>
            {t("menu.clearFormatting")}
          </Item>
          {aligned && (
            <Item onClick={actions.resetStyle}>{t("resetStyle")}</Item>
          )}
        </Menu>

        <Menu label={t("menu.tools")}>
          <Item onClick={onWordCount}>{t("wordCount.title")}</Item>
          <Item
            onClick={() =>
              pdf ? pdf.setShowSource(!pdf.showSource) : onToggleSource()
            }
          >
            {t("sourceText")}
          </Item>
          {pdf && (
            <Item onClick={() => pdf.setCompare(!pdf.compare)}>
              {t("compare")}
            </Item>
          )}
        </Menu>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** A category nested one level inside the overflow menu. */
function Menu({ label, children }: { label: string; children: ReactNode }) {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>{label}</DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-64">
        {children}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

function Item({
  onClick,
  disabled,
  shortcut,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  shortcut?: string;
  children: ReactNode;
}) {
  return (
    <DropdownMenuItem onClick={onClick} disabled={disabled}>
      {children}
      {shortcut && <DropdownMenuShortcut>{shortcut}</DropdownMenuShortcut>}
    </DropdownMenuItem>
  );
}
