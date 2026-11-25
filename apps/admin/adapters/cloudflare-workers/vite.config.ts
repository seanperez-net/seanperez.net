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
      },
    },
    // Departure, logged in QWIK-DEFAULTS.md (2026-11-25, "packages/data"; as apps/web
    // 2026-11-24): resolve packages' Worker builds (`workerd` / `worker` export conditions)
    // before their `browser` (DOM) builds. Without it the SSR build takes micromark's DOM-only
    // entity decoder (the post editor's preview) and the Worker fails with "document is not
    // defined".
    ssr: {
      resolve: {
        conditions: ["workerd", "worker", ...defaultClientConditions],
      },
    },
    plugins: [cloudflareWorkersAdapter()],
  };
});
