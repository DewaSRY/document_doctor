"use client";

import { useState, type ReactNode } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { CellSelection } from "@tiptap/pm/tables";
import { TextSelection } from "@tiptap/pm/state";
import { useTranslation } from "react-i18next";
import {
  BetweenHorizontalEnd,
  BetweenHorizontalStart,
  BetweenVerticalEnd,
  BetweenVerticalStart,
  Bold,
  ChevronDown,
  Columns2,
  Grid2x2X,
  Highlighter,
  Italic,
  PanelTop,
  Rows2,
  Strikethrough,
  Underline,
} from "lucide-react";

import { cn } from "@/lib/utils";

import { TEXT_ITEMS } from "./block-items";
import type { EditorActions } from "./editor-commands";
import { setKind } from "./insert-extension";

const QUICK_COLORS = ["#000000", "#666666", "#cc0000", "#e69138", "#bf9000", "#38761d", "#1155cc", "#674ea7"];
const HIGHLIGHT = "#fff2cc";

function BubbleButton({
  label,
  pressed,
  onClick,
  children,
}: {
  label: string;
  pressed?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        "flex h-7 min-w-7 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-sm px-1 text-sm text-foreground/80 hover:bg-foreground/8 hover:text-foreground [&_svg]:size-4",
        pressed && "bg-primary/12 text-primary hover:bg-primary/15",
      )}
    >
      {children}
    </button>
  );
}

const barClass =
  "flex max-w-[calc(100vw-32px)] flex-col rounded-lg border border-border/70 bg-popover p-1 text-popover-foreground shadow-lg print:hidden";

/** Formatting of the selected text, next to it, as in Notion. */
export function BubbleToolbar({ editor, actions }: { editor: Editor; actions: EditorActions }) {
  const { t } = useTranslation("editor");
  const [panel, setPanel] = useState<"color" | "turn" | null>(null);
  const state = useEditorState({
    editor,
    selector: ({ editor }) => {
      const { $from } = editor.state.selection;
      const inserted = $from.parent.type.name === "insParagraph" && $from.depth === 1;
      return {
        bold: editor.isActive("bold"),
        italic: editor.isActive("italic"),
        underline: editor.isActive("underline"),
        strike: editor.isActive("strike"),
        highlight: editor.isActive("highlight"),
        color: (editor.getAttributes("textStyle").color as string | undefined) ?? null,
        kind: inserted ? ($from.parent.attrs.kind as string) : null,
      };
    },
  });
  const turnInto = TEXT_ITEMS.find((item) => item.kind === state.kind);

  return (
    <BubbleMenu
      editor={editor}
      pluginKey="formatBubble"
      options={{ placement: "top", offset: 8, onHide: () => setPanel(null) }}
      shouldShow={({ editor, state }) => {
        const { selection } = state;
        return (
          editor.isEditable &&
          selection instanceof TextSelection &&
          !selection.empty &&
          state.doc.textBetween(selection.from, selection.to).trim().length > 0
        );
      }}
    >
      <div className={barClass}>
        <div className="flex items-center gap-0.5">
          {turnInto && (
            <>
              <BubbleButton
                label={t("blocks.turnInto")}
                pressed={panel === "turn"}
                onClick={() => setPanel(panel === "turn" ? null : "turn")}
              >
                <span className="max-w-28 truncate px-0.5">{t(`blocks.items.${turnInto.id}`)}</span>
                <ChevronDown className="size-3!" aria-hidden />
              </BubbleButton>
              <span aria-hidden className="mx-0.5 h-5 w-px bg-foreground/15" />
            </>
          )}
          <BubbleButton label={t("bold")} pressed={state.bold} onClick={actions.toggleBold}>
            <Bold />
          </BubbleButton>
          <BubbleButton label={t("italic")} pressed={state.italic} onClick={actions.toggleItalic}>
            <Italic />
          </BubbleButton>
          <BubbleButton label={t("underline")} pressed={state.underline} onClick={actions.toggleUnderline}>
            <Underline />
          </BubbleButton>
          <BubbleButton label={t("strike")} pressed={state.strike} onClick={actions.toggleStrike}>
            <Strikethrough />
          </BubbleButton>
          <BubbleButton
            label={t("highlightColor")}
            pressed={state.highlight}
            onClick={() => actions.setHighlight(state.highlight ? null : HIGHLIGHT)}
          >
            <Highlighter />
          </BubbleButton>
          <BubbleButton
            label={t("textColor")}
            pressed={panel === "color"}
            onClick={() => setPanel(panel === "color" ? null : "color")}
          >
            <span
              aria-hidden
              className="flex size-5 items-center justify-center rounded-xs border border-foreground/15 text-xs font-semibold"
              style={{ color: state.color ?? undefined }}
            >
              A
            </span>
          </BubbleButton>
        </div>

        {panel === "color" && (
          <div className="flex items-center gap-1 border-t border-border/60 px-1 pt-1.5 pb-0.5 mt-1" role="group" aria-label={t("textColor")}>
            <BubbleButton label={t("colorReset")} onClick={() => actions.setColor(null)}>
              <span className="text-xs">{t("colorReset")}</span>
            </BubbleButton>
            {QUICK_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={color}
                title={color}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  actions.setColor(color);
                  setPanel(null);
                }}
                className="size-5 shrink-0 cursor-pointer rounded-full ring-1 ring-black/15 hover:scale-110"
                style={{ background: color }}
              />
            ))}
          </div>
        )}

        {panel === "turn" && (
          <div className="mt-1 grid grid-cols-3 gap-0.5 border-t border-border/60 pt-1">
            {TEXT_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <BubbleButton
                  key={item.id}
                  label={t(`blocks.items.${item.id}`)}
                  pressed={state.kind === item.kind}
                  onClick={() => {
                    editor.chain().focus().command(({ tr }) => setKind(tr, item.kind!, false)).run();
                    setPanel(null);
                  }}
                >
                  <Icon aria-hidden />
                  <span className="truncate text-xs">{t(`blocks.items.${item.id}`)}</span>
                </BubbleButton>
              );
            })}
          </div>
        )}
      </div>
    </BubbleMenu>
  );
}

/** Rows, columns and the header of the table holding the cursor. */
export function TableToolbar({ editor }: { editor: Editor }) {
  const { t } = useTranslation("editor");
  const chain = () => editor.chain().focus();

  const tableRect = () => {
    const { $from } = editor.state.selection;
    for (let depth = $from.depth; depth > 0; depth--) {
      if ($from.node(depth).type.name === "table") {
        const dom = editor.view.nodeDOM($from.before(depth)) as HTMLElement | null;
        return dom?.getBoundingClientRect() ?? null;
      }
    }
    return null;
  };

  return (
    <BubbleMenu
      editor={editor}
      pluginKey="tableBubble"
      options={{ placement: "top-start", offset: 6 }}
      getReferencedVirtualElement={() => {
        const rect = tableRect();
        return rect ? { getBoundingClientRect: () => rect, getClientRects: () => [rect] } : null;
      }}
      shouldShow={({ editor, state }) =>
        editor.isEditable &&
        editor.isActive("table") &&
        (state.selection.empty || state.selection instanceof CellSelection)
      }
    >
      <div className={cn(barClass, "flex-row items-center gap-0.5")}>
        <BubbleButton label={t("blocks.table.rowAbove")} onClick={() => chain().addRowBefore().run()}>
          <BetweenHorizontalStart />
        </BubbleButton>
        <BubbleButton label={t("blocks.table.rowBelow")} onClick={() => chain().addRowAfter().run()}>
          <BetweenHorizontalEnd />
        </BubbleButton>
        <BubbleButton label={t("blocks.table.columnLeft")} onClick={() => chain().addColumnBefore().run()}>
          <BetweenVerticalStart />
        </BubbleButton>
        <BubbleButton label={t("blocks.table.columnRight")} onClick={() => chain().addColumnAfter().run()}>
          <BetweenVerticalEnd />
        </BubbleButton>
        <span aria-hidden className="mx-0.5 h-5 w-px bg-foreground/15" />
        <BubbleButton label={t("blocks.table.deleteRow")} onClick={() => chain().deleteRow().run()}>
          <Rows2 />
        </BubbleButton>
        <BubbleButton label={t("blocks.table.deleteColumn")} onClick={() => chain().deleteColumn().run()}>
          <Columns2 />
        </BubbleButton>
        <BubbleButton label={t("blocks.table.headerRow")} onClick={() => chain().toggleHeaderRow().run()}>
          <PanelTop />
        </BubbleButton>
        <span aria-hidden className="mx-0.5 h-5 w-px bg-foreground/15" />
        <BubbleButton label={t("blocks.table.delete")} onClick={() => chain().deleteTable().run()}>
          <Grid2x2X />
        </BubbleButton>
      </div>
    </BubbleMenu>
  );
}
