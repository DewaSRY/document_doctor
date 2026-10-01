export const TOOL_IDS = [
  "translator",
  "summarizer",
  "extractor",
  "converter",
  "pdf",
  "resizer",
  "compressor",
  "image-converter",
  "jpg-to-png",
  "jpg-to-webp",
  "png-to-webp",
  "jpg-to-svg",
  "png-to-svg",
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
  "jpg-to-png": "/convert-image/jpg-to-png",
  "jpg-to-webp": "/convert-image/jpg-to-webp",
  "png-to-webp": "/convert-image/png-to-webp",
  "jpg-to-svg": "/convert-image/jpg-to-svg",
  "png-to-svg": "/convert-image/png-to-svg",
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
  "jpg-to-png": "UtilitiesApplication",
  "jpg-to-webp": "UtilitiesApplication",
  "png-to-webp": "UtilitiesApplication",
  "jpg-to-svg": "UtilitiesApplication",
  "png-to-svg": "UtilitiesApplication",
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
  "jpg-to-png": ["jpg-to-webp", "jpg-to-svg", "resizer"],
  "jpg-to-webp": ["png-to-webp", "jpg-to-png", "compressor"],
  "png-to-webp": ["jpg-to-webp", "png-to-svg", "compressor"],
  "jpg-to-svg": ["png-to-svg", "jpg-to-png", "jpg-to-webp"],
  "png-to-svg": ["jpg-to-svg", "png-to-webp", "resizer"],
};
