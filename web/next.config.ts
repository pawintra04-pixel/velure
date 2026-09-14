import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev server is reached over the LAN (the user views it from a different
  // device on the same network than the one running `npm run dev`), which
  // Next.js otherwise blocks as a cross-origin dev request by default.
  allowedDevOrigins: ["192.168.1.109"],
};

export default nextConfig;
