import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo/metadata";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/*/dashboard", "/*/account", "/*/auth-success", "/*/logout"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
