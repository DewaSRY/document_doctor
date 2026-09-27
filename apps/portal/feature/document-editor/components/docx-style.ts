import type { DOMOutputSpec, Node as ProseMirrorNode } from "@tiptap/pm/model";

import type { DocxMarker, InlinePart, Inset } from "./docx-content";
import type {
  DocxBorder,
  DocxLayout,
  DocxNamedStyle,
  DocxParagraphStyle,
  DocxRunStyle,
  HeadingKind,
  SegmentStyle,
} from "../type";

/**
 * CSS for Word formatting. Every length is in points, scaled by `--z` (CSS px
 * per point) set on the canvas, so zooming restyles nothing but one variable.
 */
export function pt(value: number): string {
  return `calc(${Math.round(value * 100) / 100} * var(--z))`;
}

// Fonts with the same metrics as Word's defaults, so lines wrap where they do
// in Word even without the original font (see document-fonts.ts).
const METRIC_FALLBACKS: Record<string, string> = {
  calibri: "var(--font-carlito)",
  "calibri light": "var(--font-carlito)",
  carlito: "var(--font-carlito)",
  cambria: "var(--font-caladea)",
  "cambria math": "var(--font-caladea)",
  arial: "var(--font-arimo)",
  helvetica: "var(--font-arimo)",
  "liberation sans": "var(--font-arimo)",
  "times new roman": "var(--font-tinos)",
  times: "var(--font-tinos)",
  "liberation serif": "var(--font-tinos)",
  "courier new": "var(--font-cousine)",
  courier: "var(--font-cousine)",
  "liberation mono": "var(--font-cousine)",
};
const SERIF = /times|roman|serif|georgia|garamond|cambria|palatino|minion|book|song|sun|ming|batang|mincho/i;
const MONO = /courier|mono|consol|menlo/i;
const CJK_SANS = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", "Source Han Sans SC"';
const CJK_SERIF = '"Songti SC", SimSun, "Noto Serif CJK SC", "Source Han Serif SC"';

function quote(family: string): string {
  return `"${family.replace(/["\\]/g, "")}"`;
}

/** The font, a metric-compatible substitute, a CJK font for translations, and a generic family. */
export function fontStack(family: string, eastAsia?: string | null): string {
  const key = family.trim().toLowerCase();
  const fonts = [quote(family)];
  if (METRIC_FALLBACKS[key]) fonts.push(METRIC_FALLBACKS[key]);
  if (eastAsia) fonts.push(quote(eastAsia));
  if (MONO.test(key)) fonts.push("var(--font-cousine)", CJK_SANS, "monospace");
  else if (SERIF.test(key)) fonts.push("var(--font-tinos)", CJK_SERIF, "serif");
  else fonts.push("var(--font-arimo)", CJK_SANS, "sans-serif");
  return fonts.join(", ");
}

// Word's single line spacing is the font's own line height (ascent + descent + gap).
const LINE_FACTORS: [RegExp, number][] = [
  [/calibri|carlito/i, 1.22],
  [/cambria|caladea/i, 1.172],
  [/aptos/i, 1.2],
  [/segoe/i, 1.33],
  [/verdana/i, 1.215],
  [/tahoma/i, 1.207],
  [/georgia/i, 1.136],
  [/courier/i, 1.133],
  [/yahei|dengxian|pingfang|simhei|simsun|songti|noto sans cjk|source han/i, 1.32],
];

export function lineFactor(family: string): number {
  return LINE_FACTORS.find(([pattern]) => pattern.test(family))?.[1] ?? 1.15;
}

export function lineHeight(line: DocxParagraphStyle["line"], family: string): string {
  if (line.rule === "exact") return pt(line.value);
  const single = Math.round(lineFactor(family) * 1000) / 1000;
  if (line.rule === "atLeast") return `max(${pt(line.value)}, ${single}em)`;
  return String(Math.round(line.value * single * 1000) / 1000);
}

function border(value: DocxBorder | null | undefined): string {
  if (!value) return "none";
  // A hairline stays visible when zoomed out.
  return `max(1px, ${pt(value.width)}) ${value.style} ${value.color}`;
}

export function borderCss(side: string, value: DocxBorder | null | undefined): string {
  return value ? `border-${side}: ${border(value)};` : "";
}

/**
 * CSS of a run's font, colour and highlight. With `toggles`, also its bold,
 * italic, underline and strike, which segments carry as marks instead.
 */
export function runCss(run: DocxRunStyle, toggles = false): string {
  const css = [`font-family: ${fontStack(run.family, run.east_asia)};`];
  css.push(`font-size: ${pt(run.vert ? run.size * 0.65 : run.size)};`);
  if (run.color) css.push(`color: ${run.color};`);
  if (run.highlight) css.push(`background-color: ${run.highlight};`);
  if (run.caps) css.push("text-transform: uppercase;");
  if (run.small_caps) css.push("font-variant: small-caps;");
  if (run.vert) css.push(`vertical-align: ${run.vert};`);
  if (run.spacing) css.push(`letter-spacing: ${pt(run.spacing)};`);
  if (toggles) {
    if (run.bold) css.push("font-weight: 700;");
    if (run.italic) css.push("font-style: italic;");
    const decoration = [run.underline && "underline", run.strike && "line-through"].filter(Boolean);
    if (decoration.length) css.push(`text-decoration: ${decoration.join(" ")};`);
  }
  return css.join(" ");
}

/** Formatting for a paragraph style the document does not define, like Google Docs'.
 *  The service applies the same (_HEADING_FALLBACKS in docx_handler.py). */
export const HEADING_FALLBACKS: Record<Exclude<HeadingKind, "normal">, { size: number; bold: boolean; color?: string }> = {
  title: { size: 26, bold: false },
  subtitle: { size: 15, bold: false, color: "#666666" },
  h1: { size: 20, bold: true },
  h2: { size: 16, bold: true },
  h3: { size: 14, bold: true },
  h4: { size: 12, bold: true },
  h5: { size: 11, bold: true },
  h6: { size: 11, bold: false },
};

export interface DocxStyles {
  styles: DocxLayout["styles"];
  runStyles: DocxRunStyle[];
  defaultTab: number;
  mediaHref: (name: string) => string;
}

/**
 * The paragraph and run formatting a segment is shown with: the document's,
 * unless the user chose another paragraph style, font or size.
 */
export function effectiveStyle(
  docx: DocxStyles,
  paragraph: DocxParagraphStyle,
  run: DocxRunStyle,
  style: SegmentStyle | null | undefined,
): { paragraph: DocxParagraphStyle; run: DocxRunStyle } {
  let para = paragraph;
  let text = run;
  const heading = style?.heading;
  if (heading) {
    const named: DocxNamedStyle | undefined = docx.styles[heading];
    if (named) {
      para = named.style;
      text = docx.runStyles[named.run] ?? run;
    } else if (heading !== "normal") {
      const fallback = HEADING_FALLBACKS[heading];
      text = { ...run, size: fallback.size, bold: fallback.bold, italic: false, color: fallback.color ?? null };
    }
  }
  if (style) {
    para = {
      ...para,
      align: style.align ?? para.align,
      indent_left: style.indent_left ?? para.indent_left,
      space_before: style.space_before ?? para.space_before,
      space_after: style.space_after ?? para.space_after,
      line: style.line_spacing !== undefined ? { rule: "auto", value: style.line_spacing } : para.line,
    };
    text = {
      ...text,
      family: style.family ?? text.family,
      size: style.font_size ?? text.size,
      color: style.color ?? text.color,
    };
  }
  return { paragraph: para, run: text };
}

export function paragraphCss(paragraph: DocxParagraphStyle, mark: DocxRunStyle): string {
  const css = [
    `padding: ${pt(paragraph.space_before)} ${pt(paragraph.indent_right)} ${pt(paragraph.space_after)} ${pt(paragraph.indent_left)};`,
    `text-indent: ${pt(paragraph.indent_first)};`,
    `text-align: ${paragraph.align};`,
    `line-height: ${lineHeight(paragraph.line, mark.family)};`,
    `font-family: ${fontStack(mark.family, mark.east_asia)};`,
    `font-size: ${pt(mark.size)};`,
  ];
  if (mark.color) css.push(`color: ${mark.color};`);
  if (paragraph.shading) css.push(`background-color: ${paragraph.shading};`);
  const borders = paragraph.borders;
  if (borders) {
    for (const side of ["top", "bottom", "left", "right"] as const) {
      css.push(borderCss(side, borders[side]));
    }
  }
  return css.join(" ");
}

export function insetCss(inset: Inset | null): string {
  return inset ? `margin-left: ${pt(inset.left)}; width: ${pt(inset.width)};` : "";
}

/** DOM of content that is not translated: fixed text, tabs, breaks, fields and images. */
export function partSpec(part: InlinePart, docx: DocxStyles): DOMOutputSpec {
  switch (part.type) {
    case "text":
      return ["span", { contenteditable: "false", class: "docx-fixed", style: runCss(part.run, true) }, part.text];
    case "field":
      return [
        "span",
        { contenteditable: "false", class: "docx-fixed", "data-field": part.field, style: runCss(part.run, true) },
      ];
    case "tab":
      return ["span", { contenteditable: "false", class: "docx-tab", "data-tab": String(part.index), style: `width: var(--t${part.index}, 0px); background: var(--l${part.index}, none);` }];
    case "break":
      return ["span", { contenteditable: "false", class: "docx-break" }, ["br"]];
    case "image": {
      const size = `width: ${pt(part.width)}; height: ${pt(part.height)};`;
      const image: DOMOutputSpec = part.src
        ? ["img", { src: docx.mediaHref(part.src), alt: part.alt, draggable: "false", style: size, class: "docx-image" }]
        : ["span", { class: "docx-image docx-image-missing", style: size, title: part.alt }];
      const float = part.float;
      if (!float) return ["span", { contenteditable: "false", class: "docx-inline-object" }, image];
      const placement =
        float.mode === "absolute"
          ? `position: absolute; left: ${pt(float.x)}; top: ${pt(float.y)}; z-index: ${float.behind ? 0 : 2};`
          : `float: ${float.mode}; margin: 0 ${float.mode === "left" ? pt(9) : 0} ${pt(4)} ${float.mode === "right" ? pt(9) : 0};`;
      return ["span", { contenteditable: "false", class: "docx-float", style: placement }, image];
    }
  }
}

export function markerSpec(marker: DocxMarker): DOMOutputSpec[] {
  const specs: DOMOutputSpec[] = [
    ["span", { contenteditable: "false", class: "docx-marker", style: runCss(marker.run, true) }, marker.text + (marker.space ? " " : "")],
  ];
  if (marker.tab !== null) {
    specs.push(partSpec({ type: "tab", index: marker.tab }, {} as DocxStyles));
  }
  return specs;
}

/** The paragraph formatting a paragraph node is shown with, including the user's changes. */
export function paragraphStyleOf(
  node: ProseMirrorNode,
  docx: DocxStyles,
): { paragraph: DocxParagraphStyle; run: DocxRunStyle } {
  const overrides = node.firstChild?.attrs.style as SegmentStyle | null | undefined;
  // The paragraph mark takes the paragraph style, not the text's own font or size.
  const paragraphOnly = overrides
    ? { ...overrides, family: undefined, font_size: undefined, color: undefined }
    : null;
  return effectiveStyle(docx, node.attrs.style, node.attrs.mark, paragraphOnly);
}
