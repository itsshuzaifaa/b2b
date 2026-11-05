import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Automatically expose non-prefixed environment variables to browser client bundles */
  env: {
    SUPABASE_URL: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    NEXT_PUBLIC_SUPABASE_URL: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    APP_URL: process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || '',
    NEXT_PUBLIC_APP_URL: process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || '',
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
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
        permanent: false,
      },
      {
        source: '/admin/:path*',
        destination: '/site-admin/:path*',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
