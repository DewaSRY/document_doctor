import {
  Combine,
  ArrowLeftRight,
  FileSearch,
  FileText,
  Image as ImageIcon,
  Camera,
  Layers,
  Zap,
  Spline,
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
  // icon = target format
  "png-to-jpg": Camera,
  "webp-to-jpg": Camera,
  "jpg-to-png": Layers,
  "webp-to-png": Layers,
  "jpg-to-webp": Zap,
  "png-to-webp": Zap,
  "png-to-svg": Spline,
  "jpg-to-svg": Spline,
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

  "png-to-jpg": "bg-[#f59e0b]",
  "webp-to-jpg": "bg-[#f59e0b]",
  "jpg-to-png": "bg-[#10b981]",
  "webp-to-png": "bg-[#10b981]",
  "jpg-to-webp": "bg-[#8b5cf6]",
  "png-to-webp": "bg-orange-500",
  "jpg-to-svg": "bg-orange-800",
  "png-to-svg": "bg-[#ec4899]",
};

export const FALLBACK_TOOL_COLOR = "bg-foreground";
