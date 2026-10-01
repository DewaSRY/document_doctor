import {
  Combine,
  ArrowLeftRight,
  FileSearch,
  FileText,
  Image as ImageIcon,
  Languages,
  Minimize2,
  Repeat2,
  type LucideIcon,
} from "lucide-react";

/** One icon per tool, keyed by the tool id used in landing.json and
 *  TOOL_HREFS, so the hero, tool grid and use cases always agree. */
export const TOOL_ICONS: Record<string, LucideIcon> = {
  translator: Languages,
  summarizer: FileText,
  extractor: FileSearch,
  converter: Repeat2,
  pdf: Combine,
  resizer: ImageIcon,
  compressor: Minimize2,
  "image-converter": ArrowLeftRight,
};

export const FALLBACK_TOOL_ICON = FileText;

/** Each tool gets its own icon color, so the grid scans by color as well as
 *  by name. All pass 3:1 against white for the white glyph on top. */
export const TOOL_COLORS: Record<string, string> = {
  translator: "bg-brand",
  summarizer: "bg-[#7c3aed]",
  extractor: "bg-[#0f8b8d]",
  converter: "bg-[#2563eb]",
  pdf: "bg-[#ea580c]",
  resizer: "bg-[#16a34a]",
  compressor: "bg-[#db2777]",
  "image-converter": "bg-[#0e7490]",
};

export const FALLBACK_TOOL_COLOR = "bg-foreground";
