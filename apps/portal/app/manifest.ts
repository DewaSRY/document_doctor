import type { MetadataRoute } from "next";
import { SITE_NAME } from "@/lib/seo/metadata";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} — AI Document Tools`,
    short_name: SITE_NAME,
    description:
      "Simple AI-powered tools for working with documents and digital files.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#c8252c",
    icons: [
      {
        src: "/icons/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
