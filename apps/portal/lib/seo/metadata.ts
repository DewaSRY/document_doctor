import type { Metadata } from "next";
import { locales, type AppLocale } from "@/i18n/settings";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(
  /\/+$/,
  "",
);
export const SITE_NAME = "Dewa Surya Hub";

/** `robots` for every page that must not be indexed (portal, admin, sso, checkout). */
export const NOINDEX: Metadata["robots"] = {
  index: false,
  follow: false,
  googleBot: { index: false, follow: false },
};

function normalizePath(path: string): string {
  if (!path || path === "/") return "";
  return path.startsWith("/") ? path : `/${path}`;
}

/**
 * Builds `alternates.languages` for a locale-agnostic path, e.g. "/blog".
 * `only` limits it to the languages the page really exists in (an article
 * with no English translation must not advertise `/en/…`).
 */
export function buildLanguageAlternates(path: string, only?: readonly string[]): Record<string, string> {
  const normalized = normalizePath(path);
  const available = only?.length ? locales.filter((locale) => only.includes(locale)) : locales;
  const list = available.length ? available : locales;
  return {
    ...Object.fromEntries(list.map((locale) => [locale, `${SITE_URL}/${locale}${normalized}`])),
    "x-default": `${SITE_URL}/${list[0]}${normalized}`,
  };
}

export function canonicalFor(locale: AppLocale, path: string): string {
  return `${SITE_URL}/${locale}${normalizePath(path)}`;
}

export function absoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${SITE_URL}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

export interface OgImage {
  url: string;
  width?: number;
  height?: number;
  alt?: string;
}

export const DEFAULT_OG_IMAGE: OgImage = {
  url: "/icons/android-chrome-512x512.png",
  width: 512,
  height: 512,
  alt: SITE_NAME,
};

/** Standard metadata for a public `(site)` page: canonical, hreflang, OG, Twitter. */
export function buildPageMetadata(options: {
  locale: AppLocale;
  path: string;
  title: string;
  description: string;
  absoluteTitle?: boolean;
  image?: OgImage | null;
  type?: "website" | "article";
  publishedTime?: string | null;
  modifiedTime?: string | null;
  tags?: string[];
  section?: string;
  canonical?: string | null;
  /** Languages the page exists in (hreflang); default: every locale. */
  languages?: readonly string[];
  /** Language of the text when it differs from `locale` (a fallback translation). */
  contentLocale?: string;
}): Metadata {
  const {
    locale,
    path,
    title,
    description,
    absoluteTitle,
    image,
    type = "website",
  } = options;
  const canonical = options.canonical || canonicalFor(locale, path);
  const og = image ?? DEFAULT_OG_IMAGE;
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: {
      canonical,
      languages: buildLanguageAlternates(path, options.languages),
    },
    openGraph: {
      title,
      description,
      type,
      url: canonical,
      siteName: SITE_NAME,
      locale: (options.contentLocale ?? locale) === "id" ? "id_ID" : "en_US",
      images: [og],
      ...(type === "article"
        ? {
            publishedTime: options.publishedTime ?? undefined,
            modifiedTime: options.modifiedTime ?? undefined,
            tags: options.tags,
            section: options.section,
          }
        : {}),
    },
    twitter: {
      card: og.width && og.width >= 800 ? "summary_large_image" : "summary",
      title,
      description,
      images: [og.url],
    },
  };
}
