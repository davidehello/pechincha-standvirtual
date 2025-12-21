import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ireland.apollo.olxcdn.com",
        pathname: "/v1/files/**",
      },
      {
        protocol: "https",
        hostname: "*.apollo.olxcdn.com",
        pathname: "/v1/files/**",
      },
    ],
  },
};

export default nextConfig;
