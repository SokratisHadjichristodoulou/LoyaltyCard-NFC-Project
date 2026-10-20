import type { NextConfig } from "next";

// Host-agnostic: no adapter-specific options. Works with `next start`,
// Vercel, or Cloudflare via @opennextjs/cloudflare.
const nextConfig: NextConfig = {
  poweredByHeader: false,
  agentRules: false,
  // The only image is the small logo; serving it as-is keeps every host
  // (including Cloudflare, which would need an image binding) the same.
  images: { unoptimized: true },
  async headers() {
    return [
      {
        // This site lives on a hidden subdomain and must never be indexed.
        source: "/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          // Security headers. Camera stays allowed for the staff QR scanner.
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000" },
        ],
      },
    ];
  },
};

export default nextConfig;
