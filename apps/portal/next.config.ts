import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const NOINDEX = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    serverActions: {
      // Document uploads go through a Server Action; the service accepts up
      // to 5 MB, plus room for the multipart envelope.
      bodySizeLimit: "6mb",
    },
    // app/global-not-found.tsx: a real 404 for unmatched URLs, which the
    // [locale] root layout can't provide on its own.
    globalNotFound: true,
  },
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      // Downloads and page renders of user documents.
      { source: "/api/:path*", headers: NOINDEX },
      // A user's own translation, backing up the page's robots meta.
      { source: "/:locale/translate/:documentId/edit", headers: NOINDEX },
    ];
  },
};

export default nextConfig;

initOpenNextCloudflareForDev();
