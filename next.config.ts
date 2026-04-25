import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "*.space.z.ai",
  ],
  serverExternalPackages: ["@prisma/client", "prisma"],
};

export default nextConfig;
