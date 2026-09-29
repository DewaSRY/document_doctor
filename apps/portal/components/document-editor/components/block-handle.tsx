"use client";

import { useEffect, useRef, useState, type DragEvent, type RefObject } from "react";
import type { Editor } from "@tiptap/react";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { NodeSelection, TextSelection, type Transaction } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { useTranslation } from "react-i18next";
import { ArrowDown, ArrowUp, Copy, GripVertical, Plus, Trash } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { TEXT_ITEMS } from "./block-items";
import { isInserted, paragraphContent } from "./insert-content";
import { insertBlocks, setKind } from "./insert-extension";

interface Hovered {
  pos: number;
  node: ProseMirrorNode;
  top: number;
  left: number;
}

/** Room the handle takes left of a block, in px. */
const HANDLE_WIDTH = 48;

/** Put the selection in (or on) the top-level block at `pos`. */
function selectBlock(tr: Transaction, pos: number) {
  const node = tr.doc.nodeAt(pos);
  if (!node) return;
  if (node.isAtom) tr.setSelection(NodeSelection.create(tr.doc, pos));
  else tr.setSelection(TextSelection.near(tr.doc.resolve(pos + 1)));
}

/** Drag the top-level block at `pos`: ProseMirror moves it where it is dropped
 *  (see handleDrop in segment-extension.ts). */
function startDrag(view: EditorView, pos: number, event: DragEvent) {
  const selection = NodeSelection.create(view.state.doc, pos);
  view.dispatch(view.state.tr.setSelection(selection));
  const dom = view.nodeDOM(pos) as HTMLElement | null;
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", selection.node.textContent);
  if (dom) event.dataTransfer.setDragImage(dom, 0, 0);
  view.dragging = { slice: selection.content(), move: true };
}

/**
 * Notion's block handle, in the page margin next to the block under the
 * pointer: + adds a block below and opens the "/" menu; the grip of a block
 * the user added drags it elsewhere or opens its menu.
 */
export function BlockHandle({
  editor,
  containerRef,
}: {
  editor: Editor | null;
  containerRef: RefObject<HTMLDivElement | null>;
}) {
  const { t } = useTranslation("editor");
  const [hovered, setHovered] = useState<Hovered | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const handleRef = useRef<HTMLDivElement>(null);
  // The handle stays on its block while its menu is open.
  const frozen = useRef(false);
  useEffect(() => {
    frozen.current = menuOpen;
  }, [menuOpen]);

  useEffect(() => {
    const container = containerRef.current;
    if (!editor || !container) return;
    let frame = 0;

    const locate = (x: number, y: number) => {
      const { view } = editor;
      if (view.isDestroyed) return;
      const box = container.getBoundingClientRect();
      const found = view.posAtCoords({ left: x, top: y });
      if (!found) return setHovered(null);
      const $pos = view.state.doc.resolve(found.inside >= 0 ? found.inside : found.pos);
      const index = $pos.index(0);
      const node = view.state.doc.maybeChild(index);
      if (!node || node.type.name === "docxRegion") return setHovered(null);
      const pos = $pos.posAtIndex(index, 0);
      const dom = view.nodeDOM(pos) as HTMLElement | null;
      if (!dom?.getBoundingClientRect) return setHovered(null);
      const rect = dom.getBoundingClientRect();
      // Level with the first line of text, or the top of a table or image.
      let top = rect.top;
      if (node.isTextblock || node.type.name === "docxParagraph") {
        try {
          const line = view.coordsAtPos(Math.min(pos + 2, pos + node.nodeSize - 1));
          top = (line.top + line.bottom) / 2 - 12;
        } catch {
          // Keep the block's top.
        }
      }
      setHovered({ pos, node, top: top - box.top, left: rect.left - box.left - HANDLE_WIDTH });
    };

    const onMove = (event: MouseEvent) => {
      if (frozen.current || handleRef.current?.contains(event.target as Node)) return;
      cancelAnimationFrame(frame);
      const { clientX, clientY } = event;
      frame = requestAnimationFrame(() => locate(clientX, clientY));
    };
    const onLeave = (event: MouseEvent) => {
      if (frozen.current || handleRef.current?.contains(event.relatedTarget as Node)) return;
      setHovered(null);
    };
    // Out of the way while typing, as in Notion.
    const onKey = () => {
      if (!frozen.current) setHovered(null);
    };

    container.addEventListener("mousemove", onMove);
    container.addEventListener("mouseleave", onLeave);
    editor.view.dom.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      container.removeEventListener("mousemove", onMove);
      container.removeEventListener("mouseleave", onLeave);
      editor.view.dom.removeEventListener("keydown", onKey);
    };
  }, [editor, containerRef]);

  if (!editor || !hovered) return null;
  const { pos, node } = hovered;
  const inserted = isInserted(node);
  const current = () => editor.state.doc.nodeAt(pos);

  function addBelow() {
    if (!editor || !current()) return;
    editor
      .chain()
      .focus()
      .command(({ tr }) => {
        selectBlock(tr, pos);
        const block = tr.doc.nodeAt(pos)!;
        if (block.type.name !== "insParagraph" || block.content.size > 0) {
          insertBlocks(tr, [paragraphContent("normal", [], { section: null })]);
        }
        tr.insertText("/");
        return true;
      })
      .run();
    setHovered(null);
  }

  function run(change: (tr: Transaction, node: ProseMirrorNode) => void) {
    const block = current();
    if (!editor || !block) return;
    editor
      .chain()
      .focus()
      .command(({ tr }) => {
        change(tr, block);
        return true;
      })
      .run();
    setHovered(null);
  }

  const index = editor.state.doc.resolve(pos).index(0);
  const previous = index > 0 ? editor.state.doc.child(index - 1) : null;
  const next = editor.state.doc.maybeChild(index + 1);
  const canMoveUp = !!previous && previous.type.name !== "docxRegion";
  const canMoveDown = !!next;

  function onDragStart(event: DragEvent) {
    if (editor && current()) startDrag(editor.view, pos, event);
  }

  return (
    <div
      ref={handleRef}
      className="absolute z-20 flex items-center gap-px print:hidden"
      style={{ top: hovered.top, left: Math.max(0, hovered.left) }}
      onMouseLeave={(event) => {
        if (!menuOpen && !editor.view.dom.contains(event.relatedTarget as Node)) setHovered(null);
      }}
    >
      <button
        type="button"
        aria-label={t("blocks.addBelow")}
        title={t("blocks.addBelow")}
        onMouseDown={(event) => event.preventDefault()}
        onClick={addBelow}
        className="flex size-6 cursor-pointer items-center justify-center rounded-sm text-neutral-400 hover:bg-neutral-900/6 hover:text-neutral-700"
      >
        <Plus className="size-4" aria-hidden />
      </button>
      {inserted && (
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger
            draggable
            onDragStart={onDragStart}
            aria-label={t("blocks.dragOrMenu")}
            title={t("blocks.dragOrMenu")}
            className="flex h-6 w-4.5 cursor-grab items-center justify-center rounded-sm text-neutral-400 outline-none hover:bg-neutral-900/6 hover:text-neutral-700 active:cursor-grabbing data-popup-open:bg-neutral-900/6"
          >
            <GripVertical className="size-4" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {node.type.name === "insParagraph" && (
              <>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>{t("blocks.turnInto")}</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-52">
                    {TEXT_ITEMS.map((item) => {
                      const Icon = item.icon;
                      return (
                        <DropdownMenuItem
                          key={item.id}
                          onClick={() =>
                            run((tr) => {
                              selectBlock(tr, pos);
                              setKind(tr, item.kind!, false);
                            })
                          }
                          className={node.attrs.kind === item.kind ? "bg-accent/60" : undefined}
                        >
                          <Icon aria-hidden />
                          {t(`blocks.items.${item.id}`)}
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onClick={() => run((tr, block) => tr.insert(pos + block.nodeSize, block.type.create(block.attrs, block.content, block.marks)))}>
              <Copy aria-hidden />
              {t("blocks.duplicate")}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!canMoveUp}
              onClick={() =>
                run((tr, block) => {
                  const before = pos - previous!.nodeSize;
                  tr.delete(pos, pos + block.nodeSize).insert(before, block);
                  selectBlock(tr, before);
                })
              }
            >
              <ArrowUp aria-hidden />
              {t("blocks.moveUp")}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!canMoveDown}
              onClick={() =>
                run((tr, block) => {
                  const after = pos + block.nodeSize + next!.nodeSize;
                  tr.insert(after, block).delete(pos, pos + block.nodeSize);
                  selectBlock(tr, pos + next!.nodeSize);
                })
              }
            >
              <ArrowDown aria-hidden />
              {t("blocks.moveDown")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() =>
                run((tr, block) => {
                  tr.delete(pos, pos + block.nodeSize);
                  tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(pos, tr.doc.content.size)), -1));
                })
              }
            >
              <Trash aria-hidden />
              {t("blocks.delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
