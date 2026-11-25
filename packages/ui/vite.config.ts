/// <reference types="vitest/config" />
import { qwikVite } from "@qwik.dev/core/optimizer";
import { qwikRouter } from "@qwik.dev/router/vite";
import { defineConfig } from "vite";
import pkg from "./package.json";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
const { dependencies = {}, peerDependencies = {} } = pkg as any;
const makeRegex = (dep) => new RegExp(`^${dep}(/.*)?$`);
const excludeAll = (obj) => Object.keys(obj).map(makeRegex);

export default defineConfig(({ mode }) => {
  return {
    build: {
      outDir: "lib",
      target: "es2020",
      lib: {
        entry: "./src/index",
        formats: ["es", "cjs"] as const,
        // This adds .qwik so all files are processed by the optimizer
        fileName: (format, entryName) =>
          `${entryName}.qwik.${format === "es" ? "mjs" : "cjs"}`,
      },
      rolldownOptions: {
        output: {
          preserveModules: true,
          preserveModulesRoot: "src",
        },
        // externalize deps that shouldn't be bundled into the library
        external: [
          /^node:.*/,
          ...excludeAll(dependencies),
          ...excludeAll(peerDependencies),
        ],
      },
    },
    plugins: [
      qwikVite(),
      // Not under Vitest: its closeBundle writes a package.json into Vitest's placeholder outDir
      // (QWIK-DEFAULTS.md 2026-11-25). The router runtime the tests use needs no plugin.
      mode !== "test" && qwikRouter(),
      tsconfigPaths({ root: "." }),
      tailwindcss(),
    ],
    // Vitest (`pnpm test`): unit specs beside the source. Focus, keys, overlays: Playwright.
    test: { include: ["src/**/*.spec.{ts,tsx}"] },
  };
});
