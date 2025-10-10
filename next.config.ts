import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "http2.mlstatic.com", pathname: "/**" },
      { protocol: "https", hostname: "ae01.alicdn.com", pathname: "/**" },
      { protocol: "https", hostname: "ae04.alicdn.com", pathname: "/**" },
      { protocol: "https", hostname: "deo.shopeemobile.com", pathname: "/**" },
    ],
  },
};

export default nextConfig;
