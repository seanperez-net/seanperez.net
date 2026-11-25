import { cloudflarePagesAdapter as cloudflareWorkersAdapter } from "@qwik.dev/router/adapters/cloudflare-pages/vite";
import { extendConfig } from "@qwik.dev/router/vite";
import { defaultClientConditions } from "vite";
import baseConfig from "../../vite.config";

export default extendConfig(baseConfig, () => {
  return {
    build: {
      ssr: true,
      rolldownOptions: {
        input: ["src/entry.cloudflare-pages.tsx"],
        // Departure, logged in QWIK-DEFAULTS.md (2026-11-24, "live nodes"): the Durable Object
        // base class comes from the runtime (`cloudflare:workers`), never from a bundle. (Vite's
        // `ssr.external` does not apply: the adapter sets `ssr.noExternal: true`.)
        external: ["cloudflare:workers"],
      },
    },
    // Departure, logged in QWIK-DEFAULTS.md (2026-11-24): resolve packages' Worker builds
    // (`workerd` / `worker` export conditions) before their `browser` (DOM) builds. Without it
    // the SSR webworker build takes e.g. micromark's DOM-only entity decoder and the Worker fails
    // at load with "document is not defined".
    ssr: {
      resolve: {
        conditions: ["workerd", "worker", ...defaultClientConditions],
      },
    },
    plugins: [cloudflareWorkersAdapter()],
  };
});
