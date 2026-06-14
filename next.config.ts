import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/api/Vehicles",
        destination: "/api/vehicles",
      },
      {
        source: "/api/Vehicles/:path*",
        destination: "/api/vehicles/:path*",
      },
    ];
  },
};

export default nextConfig;
