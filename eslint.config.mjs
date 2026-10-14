import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Known tech debt: the game code was moved in from a Next 14 / React 18 codebase whose lint
  // had no React Compiler rules. It works as-is; these rules are off for the game folders only
  // until each table is refactored (new code elsewhere stays fully checked).
  {
    files: [
      "src/components/{games,game,tienlen,meono,typhu,splendor,bang,oanquan,cangua}/**",
    ],
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
      "react-hooks/immutability": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/purity": "off",
      "react-hooks/static-components": "off",
      "react-hooks/globals": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
