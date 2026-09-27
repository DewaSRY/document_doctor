import { Arimo, Caladea, Carlito, Cousine, Tinos } from "next/font/google";

/**
 * Open fonts with the metrics of Word's and PDF's standard fonts (Calibri,
 * Cambria, Arial, Times New Roman, Courier New), so a document's lines wrap as
 * they do in the original when that font is not installed. They load only
 * when a document uses them. (next/font needs literal options.)
 */
const carlito = Carlito({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  display: "swap",
  preload: false,
  variable: "--font-carlito",
});
const caladea = Caladea({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  display: "swap",
  preload: false,
  variable: "--font-caladea",
});
const arimo = Arimo({
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
  preload: false,
  variable: "--font-arimo",
});
const tinos = Tinos({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  display: "swap",
  preload: false,
  variable: "--font-tinos",
});
const cousine = Cousine({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  display: "swap",
  preload: false,
  variable: "--font-cousine",
});

/** Class names that define the --font-* variables used by docx-style.ts. */
export const documentFontVariables = [carlito, caladea, arimo, tinos, cousine]
  .map((font) => font.variable)
  .join(" ");
