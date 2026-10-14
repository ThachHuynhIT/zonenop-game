import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle, only for the Docker image (the Dockerfile sets NEXT_STANDALONE=1).
  // Not on Vercel: Vercel's build breaks next/font/google with output "standalone"
  // ("next/font/google queries have exactly one entry").
  ...(process.env.NEXT_STANDALONE === "1" && { output: "standalone" as const }),
};

export default nextConfig;
