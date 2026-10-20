import type { NextConfig } from "next";

// Host-agnostic: no adapter-specific options. Works with `next start`,
// Vercel, or Cloudflare via @opennextjs/cloudflare.
const nextConfig: NextConfig = {
  poweredByHeader: false,
  agentRules: false,
  async headers() {
    return [
      {
        // This site lives on a hidden subdomain and must never be indexed.
        source: "/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }],
      },
    ];
  },
};

export default nextConfig;
