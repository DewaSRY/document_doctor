import {
  Combine,
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
};

export const FALLBACK_TOOL_ICON = FileText;
