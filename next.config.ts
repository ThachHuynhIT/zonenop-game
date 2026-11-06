import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/security-headers";

const nextConfig: NextConfig = {
  // Self-contained server bundle, only for the Docker image (the Dockerfile sets NEXT_STANDALONE=1).
  // Not on Vercel: Vercel's build breaks next/font/google with output "standalone"
  // ("next/font/google queries have exactly one entry").
  ...(process.env.NEXT_STANDALONE === "1" && { output: "standalone" as const }),
  // CSP (Report-Only for now), nosniff and Referrer-Policy on every route: src/lib/security-headers.ts.
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders(process.env) }];
  },
};

export default nextConfig;
