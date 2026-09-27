import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Document uploads go through a Server Action; the service accepts up
      // to 5 MB, plus room for the multipart envelope.
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
