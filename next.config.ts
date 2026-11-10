import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentUpgrade: 'security' as any,
  },
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async redirects() {
    return [
      {
        source: '/admin',
        destination: '/site-admin',
        permanent: true,
      },
      {
        source: '/admin/:path*',
        destination: '/site-admin/:path*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
