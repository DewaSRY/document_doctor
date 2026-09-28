import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo/metadata";

/** Everything public is crawlable, including /_next assets pages need to
 *  render. API routes return files, not pages. Translation editors
 *  (/<locale>/translate/<id>/edit) stay crawlable so bots can see their
 *  noindex; they're private links, never linked from public pages. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
