import type { MetadataRoute } from "next";
import { locales } from "@/i18n/settings";
import { canonicalFor, buildLanguageAlternates } from "@/lib/seo/metadata";
import { PUBLIC_PATHS } from "@/lib/seo/routes";

/** Every indexable page in every locale, with its hreflang alternates.
 *  New tools appear here once they're added to TOOL_IDS. */
export default function sitemap(): MetadataRoute.Sitemap {
  return locales.flatMap((locale) =>
    PUBLIC_PATHS.map((path) => ({
      url: canonicalFor(locale, path),
      priority: path === "" ? 1 : 0.8,
      alternates: { languages: buildLanguageAlternates(path) },
    })),
  );
}
