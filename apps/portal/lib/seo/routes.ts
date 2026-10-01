export const TOOL_IDS = [
  "translator",
  "summarizer",
  "extractor",
  "converter",
  "pdf",
  "resizer",
  "compressor",
  "image-converter",
] as const;

export type ToolId = (typeof TOOL_IDS)[number];

const TOOL_PATHS: Record<ToolId, string> = {
  translator: "/translate",
  summarizer: "/summarize",
  extractor: "/extract",
  converter: "/convert",
  pdf: "/pdf",
  resizer: "/resize-image",
  compressor: "/compress-image",
  "image-converter": "/convert-image",
};

export function toolPath(tool: ToolId): string {
  return TOOL_PATHS[tool];
}

export const PUBLIC_PATHS = ["", ...TOOL_IDS.map(toolPath)];

export const TOOL_CATEGORIES: Record<ToolId, string> = {
  translator: "BusinessApplication",
  summarizer: "BusinessApplication",
  extractor: "BusinessApplication",
  converter: "UtilitiesApplication",
  pdf: "UtilitiesApplication",
  resizer: "UtilitiesApplication",
  compressor: "UtilitiesApplication",
  "image-converter": "UtilitiesApplication",
};

export const RELATED_TOOLS: Record<ToolId, readonly ToolId[]> = {
  translator: ["summarizer", "extractor", "converter"],
  summarizer: ["translator", "extractor", "pdf"],
  extractor: ["translator", "summarizer", "converter"],
  converter: ["pdf", "translator", "image-converter"],
  pdf: ["converter", "extractor", "resizer"],
  resizer: ["compressor", "image-converter", "pdf"],
  compressor: ["resizer", "image-converter", "pdf"],
  "image-converter": ["resizer", "compressor", "converter"],
};
