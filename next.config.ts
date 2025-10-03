import type { NextConfig } from "next";
import { withBetterStack } from "@logtail/next";

const nextConfig: NextConfig = withBetterStack({
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "http2.mlstatic.com", pathname: "/**" },
      { protocol: "https", hostname: "ae01.alicdn.com", pathname: "/**" },
      { protocol: "https", hostname: "ae04.alicdn.com", pathname: "/**" },
    ],
  },
});

export default nextConfig;
