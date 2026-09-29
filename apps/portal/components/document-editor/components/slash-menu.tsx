"use client";

import { useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useEditorState, type Editor } from "@tiptap/react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";

import { filterItems, type BlockItem } from "./block-items";
import { slashKey, type SlashKeys } from "./insert-extension";

const MENU_HEIGHT = 320;

/**
 * The "/" menu of an inserted paragraph: typing after the slash filters the
 * block types; ↑ ↓ pick one, Enter makes it, Esc closes the menu.
 */
export function SlashMenu({
  editor,
  slashKeys,
  onPickImage,
}: {
  editor: Editor | null;
  slashKeys: SlashKeys;
  onPickImage: () => void;
}) {
  const { t } = useTranslation("editor");
  const slash = useEditorState({
    editor,
    selector: ({ editor }) => (editor ? (slashKey.getState(editor.state) ?? null) : null),
  });
  const active = !!slash?.active;
  const query = slash?.query ?? "";
  const items = useMemo(
    () => filterItems(query, (item) => t(`blocks.items.${item.id}`)),
    [query, t],
  );
  const [selected, setSelected] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  // Follows the text while the page scrolls.
  const [, rerender] = useReducer((n: number) => n + 1, 0);

  const [lastQuery, setLastQuery] = useState(query);
  if (lastQuery !== query) {
    setLastQuery(query);
    setSelected(0);
  }

  function choose(item: BlockItem | undefined) {
    if (!editor || !slash?.active || !item) return false;
    const range = { from: slash.from, to: slash.to };
    if (item.apply) {
      editor.chain().focus().deleteRange(range).command(({ tr }) => item.apply!(tr)).run();
    } else {
      editor.chain().focus().deleteRange(range).run();
      onPickImage();
    }
    return true;
  }

  // The editor hands the menu its keys while it is open.
  const latest = useRef({ items, selected, choose });
  useLayoutEffect(() => {
    latest.current = { items, selected, choose };
  });
  useEffect(
    () =>
      slashKeys.connect((key) => {
        const { items, selected, choose } = latest.current;
        if (!items.length) return false;
        if (key === "ArrowDown") setSelected((selected + 1) % items.length);
        else if (key === "ArrowUp") setSelected((selected - 1 + items.length) % items.length);
        else if (key === "Enter") return choose(items[selected]);
        else return false;
        return true;
      }),
    [slashKeys],
  );

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${selected}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  useEffect(() => {
    if (!active) return;
    window.addEventListener("scroll", rerender, true);
    window.addEventListener("resize", rerender);
    return () => {
      window.removeEventListener("scroll", rerender, true);
      window.removeEventListener("resize", rerender);
    };
  }, [active]);

  if (!editor || !slash?.active) return null;

  let coords: { left: number; top: number; bottom: number };
  try {
    coords = editor.view.coordsAtPos(slash.from);
  } catch {
    return null;
  }
  const below = coords.bottom + 6 + MENU_HEIGHT < window.innerHeight;
  const style = below
    ? { left: coords.left, top: coords.bottom + 6 }
    : { left: coords.left, bottom: window.innerHeight - coords.top + 6 };

  return createPortal(
    <div
      role="listbox"
      aria-label={t("blocks.menu")}
      className="fixed z-50 w-72 overflow-hidden rounded-lg border border-border/70 bg-popover text-popover-foreground shadow-lg"
      style={{ ...style, maxWidth: "calc(100vw - 32px)" }}
      onMouseDown={(event) => event.preventDefault()}
    >
      <div ref={listRef} className="max-h-80 overflow-y-auto p-1">
        {items.length ? (
          <>
            <p className="px-2 pt-1.5 pb-1 text-xs font-medium text-muted-foreground">
              {t("blocks.basic")}
            </p>
            {items.map((item, index) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={index === selected}
                  data-index={index}
                  onMouseEnter={() => setSelected(index)}
                  onClick={() => choose(item)}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-left outline-none",
                    index === selected && "bg-accent text-accent-foreground",
                  )}
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border/70 bg-background">
                    <Icon className="size-4.5" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm">{t(`blocks.items.${item.id}`)}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {t(`blocks.hints.${item.id}`)}
                    </span>
                  </span>
                </button>
              );
            })}
          </>
        ) : (
          <p className="px-2 py-2 text-sm text-muted-foreground">{t("blocks.noResults")}</p>
        )}
      </div>
    </div>,
    document.body,
  );
}
