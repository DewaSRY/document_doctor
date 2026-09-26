import type { MetadataRoute } from "next";
import { locales } from "@/i18n/settings";
import { canonicalFor, buildLanguageAlternates } from "@/lib/seo/metadata";

const PUBLIC_PATHS = ["/", "/login", "/register"];

export default function sitemap(): MetadataRoute.Sitemap {
  return locales.flatMap((locale) =>
    PUBLIC_PATHS.map((path) => ({
      url: canonicalFor(locale, path === "/" ? "" : path),
      alternates: { languages: buildLanguageAlternates(path === "/" ? "" : path) },
    })),
  );
}
