import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { globalIgnores } from "eslint/config";

/**
 * Source-only server package: the apps' typescript-eslint setup without the Qwik plugin (no
 * components here). QWIK-DEFAULTS.md 2026-11-25 "packages/data" and "Drizzle ORM; packages/data split".
 */
export default tseslint.config(
  globalIgnores(["**/node_modules", "eslint.config.js"]),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2021,
        ...globals.serviceworker,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
);
