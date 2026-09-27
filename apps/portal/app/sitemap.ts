import type { MetadataRoute } from "next";
import { locales } from "@/i18n/settings";
import { canonicalFor, buildLanguageAlternates } from "@/lib/seo/metadata";

// Only list routes that actually exist and should be indexed.
const PUBLIC_PATHS = ["", "/translate"];

export default function sitemap(): MetadataRoute.Sitemap {
  return locales.flatMap((locale) =>
    PUBLIC_PATHS.map((path) => ({
      url: canonicalFor(locale, path),
      changeFrequency: "monthly" as const,
      priority: 1,
      alternates: { languages: buildLanguageAlternates(path) },
    })),
  );
}
