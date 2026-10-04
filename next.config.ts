import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["localhost", "127.0.0.1", "192.168.1.113"],
  serverExternalPackages: ["sharp"],
  compress: true,
  experimental: {
    cpus: 1,
    optimizePackageImports: ["lucide-react", "motion/react"],
  },
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 604800, // 7 days cache
    remotePatterns: [
      {
        protocol: "https",
        hostname: "jagqvyfnychnoxarebgv.supabase.co",
        port: "",
        pathname: "/storage/v1/object/sign/profiles/**",
      },
      {
        protocol: "https",
        hostname: "jagqvyfnychnoxarebgv.supabase.co",
        port: "",
        pathname: "/storage/v1/object/public/blog-covers/**",
      },
    ],
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(self)" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
        ],
      },
    ];
  },
};

export default nextConfig;
