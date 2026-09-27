import type { getTranslation } from "@/i18n/server";

export type LandingT = Awaited<ReturnType<typeof getTranslation>>["t"];

/** Reads an array-valued translation key (e.g. "faq.items"). */
export function tList<T>(t: LandingT, key: string): T[] {
  const value: unknown = t(key, { returnObjects: true });
  return Array.isArray(value) ? (value as T[]) : [];
}

/** Where the landing page's "Translate a document" / "Use tool" CTAs point.
 *  Locale-less: render it with the `Link` from `@/i18n/navigation`. */
export const START_HREF = "/translate";

/** Where a tool card's "Documentation" button points until per-tool docs
 *  pages exist (PRD §19). */
export const DOCS_HREF = "#features";

export const SECTION_IDS = {
  tools: "tools",
  howItWorks: "how-it-works",
  features: "features",
  languages: "languages",
  faq: "faq",
} as const;
