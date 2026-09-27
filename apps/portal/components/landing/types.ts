import type { getTranslation } from "@/i18n/server";

export type LandingT = Awaited<ReturnType<typeof getTranslation>>["t"];

/** Reads an array-valued translation key (e.g. "faq.items"). */
export function tList<T>(t: LandingT, key: string): T[] {
  const value: unknown = t(key, { returnObjects: true });
  return Array.isArray(value) ? (value as T[]) : [];
}

/** Where the landing page's "Translate a document" CTAs point.
 *  Locale-less: render it with the `Link` from `@/i18n/navigation`. */
export const START_HREF = "/translate";

export const SECTION_IDS = {
  tools: "tools",
  useCases: "use-cases",
  howItWorks: "how-it-works",
  features: "features",
  faq: "faq",
} as const;

/** The toolkit is the product, so the generic CTAs lead to it. */
export const TOOLS_HREF = `#${SECTION_IDS.tools}`;
