import { defineConfig } from "vitest/config";
import path from "node:path";

const root = import.meta.dirname;

export default defineConfig({
  test: {
    environment: "node",
    // scripts/: tooling tests (e.g. the deploy configuration check), plain ESM.
    include: ["src/**/*.test.ts", "scripts/**/*.test.mjs"],
  },
  resolve: {
    alias: {
      "@/": path.resolve(root, "./src/") + "/",
      "@components/": path.resolve(root, "./src/components/") + "/",
      "@lib/": path.resolve(root, "./src/lib/") + "/",
      "@styles/": path.resolve(root, "./src/styles/") + "/",
    },
  },
});
