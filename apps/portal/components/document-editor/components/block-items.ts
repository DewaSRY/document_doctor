import type { Transaction } from "@tiptap/pm/state";
import {
  Code,
  Heading1,
  Heading2,
  Heading3,
  Image,
  List,
  ListOrdered,
  ListTodo,
  ScissorsLineDashed,
  SeparatorHorizontal,
  Table,
  TextQuote,
  Type,
  type LucideIcon,
} from "lucide-react";

import type { InsertedTextKind } from "../type";
import { paragraphContent, tableContent } from "./insert-content";
import { insertBlocks, setKind } from "./insert-extension";

/** A block type offered by the "/" menu, the block handle and the Insert menus.
 *  Its label is `blocks.items.<id>` and its hint `blocks.hints.<id>`. */
export interface BlockItem {
  id: string;
  icon: LucideIcon;
  /** Text blocks: what "Turn into" makes of a block. */
  kind?: InsertedTextKind;
  /** Words it is found by, besides its label (in English, whatever the language). */
  keywords: string[];
  /** Makes the block; images are picked from a file instead. */
  apply?: (tr: Transaction) => boolean;
}

function textItem(id: string, kind: InsertedTextKind, icon: LucideIcon, keywords: string[]): BlockItem {
  return {
    id,
    icon,
    kind,
    keywords,
    apply: (tr) =>
      setKind(tr, kind, false) || insertBlocks(tr, [paragraphContent(kind, [], { section: null })]),
  };
}

export const BLOCK_ITEMS: BlockItem[] = [
  textItem("text", "normal", Type, ["text", "paragraph", "plain", "normal"]),
  textItem("h1", "h1", Heading1, ["heading", "title", "h1", "#"]),
  textItem("h2", "h2", Heading2, ["heading", "subtitle", "h2", "##"]),
  textItem("h3", "h3", Heading3, ["heading", "h3", "###"]),
  textItem("bullet", "bullet", List, ["bullet", "list", "unordered", "ul", "-"]),
  textItem("numbered", "numbered", ListOrdered, ["numbered", "list", "ordered", "ol", "1."]),
  textItem("todo", "todo", ListTodo, ["todo", "to-do", "task", "check", "checkbox", "[]"]),
  textItem("quote", "quote", TextQuote, ["quote", "citation", "blockquote", ">"]),
  textItem("code", "code", Code, ["code", "monospace", "snippet", "```"]),
  {
    id: "table",
    icon: Table,
    keywords: ["table", "grid", "rows", "columns"],
    apply: (tr) => insertBlocks(tr, [tableContent(3, 3, 0)]),
  },
  { id: "image", icon: Image, keywords: ["image", "picture", "photo", "upload", "img"] },
  {
    id: "divider",
    icon: SeparatorHorizontal,
    keywords: ["divider", "line", "separator", "rule", "hr", "---"],
    apply: (tr) => insertBlocks(tr, [{ type: "insDivider" }]),
  },
  {
    id: "pageBreak",
    icon: ScissorsLineDashed,
    keywords: ["page", "break", "new page"],
    apply: (tr) => insertBlocks(tr, [{ type: "insPageBreak" }]),
  },
];

export const TEXT_ITEMS = BLOCK_ITEMS.filter((item) => item.kind);

/** Items whose label or keywords contain every word of the query. */
export function filterItems(query: string, label: (item: BlockItem) => string): BlockItem[] {
  const words = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return BLOCK_ITEMS;
  return BLOCK_ITEMS.filter((item) => {
    const haystack = [label(item), item.id, ...item.keywords].join(" ").toLocaleLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}
