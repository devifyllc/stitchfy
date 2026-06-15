import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export — the final site is plain HTML/CSS/JS
  output: "export",
  trailingSlash: true,
  images: {
    // Required for static export; swap for real optimization in hosted deploys
    unoptimized: true,
  },
};

export default nextConfig;
