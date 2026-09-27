"use client";

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

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
import type { EditorActions, EditorMode } from "./editor-commands";
import {
  HEADINGS,
  LINE_SPACINGS,
  SPECIAL_CHARACTERS,
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
  onDownload: () => void;
  onPrint: () => void;
  onBack: () => void;
  onFind: () => void;
  onWordCount: () => void;
  onCopyLink: () => void;
  zoom: ZoomControls;
  showSource: boolean;
  onToggleSource: () => void;
  pdf?: PdfToolbarControls;
}

/** File, Edit, View, Insert, Format and Tools, like Google Docs. */
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
}: MenuBarProps) {
  const { t } = useTranslation("translator");
  const docx = mode === "docx";
  const aligned = mode !== "blocks";

  return (
    <nav aria-label={t("editor.menu.label")} className="flex items-center gap-0.5 text-sm">
      <Menu label={t("editor.menu.file")}>
        <Item onClick={onSave} disabled={!canSave} shortcut={`${mod}S`}>
          {t("editor.save")}
        </Item>
        <Item onClick={onDownload}>{t("editor.menu.downloadFile")}</Item>
        <Item onClick={onCopyLink}>{t("editor.copyLink")}</Item>
        <DropdownMenuSeparator />
        <Item onClick={onPrint} shortcut={`${mod}P`}>
          {t("editor.print")}
        </Item>
        <DropdownMenuSeparator />
        <Item onClick={onBack}>{t("editor.menu.close")}</Item>
      </Menu>

      <Menu label={t("editor.menu.edit")}>
        <Item onClick={actions.undo} shortcut={`${mod}Z`}>
          {t("editor.undo")}
        </Item>
        <Item onClick={actions.redo} shortcut={`${mod}${shift}Z`}>
          {t("editor.redo")}
        </Item>
        <DropdownMenuSeparator />
        <Item onClick={actions.selectAll} shortcut={`${mod}A`}>
          {t("editor.menu.selectAll")}
        </Item>
        <Item onClick={onFind} shortcut={`${mod}F`}>
          {t("editor.menu.findReplace")}
        </Item>
        <DropdownMenuSeparator />
        <Item onClick={actions.restore}>{t("editor.restore")}</Item>
        <Item onClick={actions.clearText}>{t("editor.clear")}</Item>
      </Menu>

      <Menu label={t("editor.menu.view")}>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>{t("editor.zoomLevel")}</DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-40">
            <Item onClick={zoom.fitWidth}>{t("editor.zoomFit")}</Item>
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
          onCheckedChange={() => (pdf ? pdf.setShowSource(!pdf.showSource) : onToggleSource())}
        >
          {t("editor.sourceText")}
        </DropdownMenuCheckboxItem>
        {pdf && (
          <>
            <DropdownMenuCheckboxItem checked={pdf.compare} onCheckedChange={() => pdf.setCompare(!pdf.compare)}>
              {t("editor.compare")}
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={pdf.showBoxes} onCheckedChange={() => pdf.setShowBoxes(!pdf.showBoxes)}>
              {t("editor.showBoxes")}
            </DropdownMenuCheckboxItem>
          </>
        )}
      </Menu>

      <Menu label={t("editor.menu.insert")}>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>{t("editor.specialCharacters")}</DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-72 p-2">
            {SPECIAL_CHARACTERS.map(({ group, chars }) => (
              <div key={group} className="mb-2 last:mb-0">
                <p className="mb-1 px-1 text-xs font-medium text-muted-foreground">
                  {t(`editor.characterGroups.${group}`)}
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
        <Item onClick={() => actions.insertText(" ")}>{t("editor.menu.nonBreakingSpace")}</Item>
      </Menu>

      <Menu label={t("editor.menu.format")}>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>{t("editor.menu.text")}</DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-60">
            <Item onClick={actions.toggleBold} shortcut={`${mod}B`}>
              {t("editor.menu.bold")}
            </Item>
            <Item onClick={actions.toggleItalic} shortcut={`${mod}I`}>
              {t("editor.menu.italic")}
            </Item>
            <Item onClick={actions.toggleUnderline} shortcut={`${mod}U`}>
              {t("editor.menu.underline")}
            </Item>
            <Item onClick={actions.toggleStrike} shortcut={`${alt}${shift}5`}>
              {t("editor.menu.strike")}
            </Item>
            {aligned && (
              <>
                <DropdownMenuSeparator />
                <Item onClick={() => actions.changeFontSize(1)} shortcut={`${mod}${shift}.`}>
                  {t("editor.increaseFontSize")}
                </Item>
                <Item onClick={() => actions.changeFontSize(-1)} shortcut={`${mod}${shift},`}>
                  {t("editor.decreaseFontSize")}
                </Item>
              </>
            )}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        {docx && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>{t("editor.paragraphStyle")}</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-56">
              {HEADINGS.map((kind: HeadingKind, index) => (
                <Item
                  key={kind}
                  onClick={() => actions.setHeading(kind)}
                  shortcut={index === 0 ? `${mod}${alt}0` : index >= 3 ? `${mod}${alt}${index - 2}` : undefined}
                >
                  {t(`editor.headings.${kind}`)}
                </Item>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}
        {aligned && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>{t("editor.menu.alignIndent")}</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-60">
              {(
                [
                  ["left", "editor.alignLeft", "L"],
                  ["center", "editor.alignCenter", "E"],
                  ["right", "editor.alignRight", "R"],
                  ["justify", "editor.alignJustify", "J"],
                ] as [TextAlign, string, string][]
              ).map(([value, label, key]) => (
                <Item key={value} onClick={() => actions.setAlign(value)} shortcut={`${mod}${shift}${key}`}>
                  {t(label)}
                </Item>
              ))}
              {docx && (
                <>
                  <DropdownMenuSeparator />
                  <Item onClick={() => actions.indent(1)} shortcut={`${mod}]`}>
                    {t("editor.menu.indentIncrease")}
                  </Item>
                  <Item onClick={() => actions.indent(-1)} shortcut={`${mod}[`}>
                    {t("editor.menu.indentDecrease")}
                  </Item>
                </>
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}
        {docx && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>{t("editor.lineSpacing")}</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-56">
              {LINE_SPACINGS.map((spacing) => (
                <Item key={spacing} onClick={() => actions.setLineSpacing(spacing)}>
                  {t(`editor.spacing.${String(spacing).replace(".", "_")}`)}
                </Item>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}
        <DropdownMenuSeparator />
        <Item onClick={actions.clearFormatting} shortcut={`${mod}\\`}>
          {t("editor.menu.clearFormatting")}
        </Item>
        {aligned && <Item onClick={actions.resetStyle}>{t("editor.resetStyle")}</Item>}
      </Menu>

      <Menu label={t("editor.menu.tools")}>
        <Item onClick={onWordCount}>{t("editor.wordCount.title")}</Item>
        <Item onClick={() => (pdf ? pdf.setShowSource(!pdf.showSource) : onToggleSource())}>
          {t("editor.sourceText")}
        </Item>
        {pdf && <Item onClick={() => pdf.setCompare(!pdf.compare)}>{t("editor.compare")}</Item>}
      </Menu>
    </nav>
  );
}

function Menu({ label, children }: { label: string; children: ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="cursor-pointer rounded-sm px-2 py-0.5 text-foreground/80 outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 data-popup-open:bg-muted data-popup-open:text-foreground">
        {label}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
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
