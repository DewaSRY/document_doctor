import { SITE_NAME, SITE_URL } from "./metadata";

export const AUTHOR_PERSON = {
  "@type": "Person",
  name: "Dewa Surya Ariesta",
  url: `${SITE_URL}/id/about`,
  sameAs: ["https://github.com/DewaSRY", "https://www.linkedin.com/in/dewa-surya/"],
} as const;

export type JsonLd = Record<string, unknown>;

/** Serialises JSON-LD safely for a `<script type="application/ld+json">`. */
export function serializeJsonLd(data: JsonLd | JsonLd[]): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function websiteJsonLd(url: string): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url,
    author: AUTHOR_PERSON,
  };
}

export function breadcrumbJsonLd(items: { name: string; url: string }[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function articleJsonLd(article: {
  url: string;
  headline: string;
  description?: string;
  image?: { url: string; width?: number; height?: number } | null;
  datePublished?: string | null;
  dateModified?: string | null;
  section?: string | null;
  keywords?: string[];
  wordCount?: number | null;
}): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    mainEntityOfPage: { "@type": "WebPage", "@id": article.url },
    headline: article.headline,
    description: article.description,
    image: article.image
      ? {
          "@type": "ImageObject",
          url: article.image.url,
          width: article.image.width,
          height: article.image.height,
        }
      : undefined,
    datePublished: article.datePublished ?? undefined,
    dateModified: article.dateModified ?? article.datePublished ?? undefined,
    author: AUTHOR_PERSON,
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    articleSection: article.section ?? undefined,
    keywords: article.keywords?.length ? article.keywords.join(", ") : undefined,
    wordCount: article.wordCount ?? undefined,
  };
}

export function personJsonLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    ...AUTHOR_PERSON,
    jobTitle: "Full-stack developer",
  };
}
