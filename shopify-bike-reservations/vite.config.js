import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";

// Related: https://github.com/remix-run/remix/issues/2835#issuecomment-1144102176
// Replace the host env var with your expected host.
if (
  process.env.HOST &&
  (!process.env.SHOPIFY_APP_URL ||
    process.env.SHOPIFY_APP_URL === process.env.HOST)
) {
  process.env.SHOPIFY_APP_URL = process.env.HOST;
}

const host = new URL(
  process.env.SHOPIFY_APP_URL || "http://localhost:3000"
).hostname;

let hmrConfig;
if (host === "localhost") {
  hmrConfig = {
    protocol: "ws",
    host: "localhost",
    port: 64999,
    clientPort: 64999,
  };
}

export default defineConfig({
  server: {
    port: Number(process.env.PORT || 3000),
    hmr: hmrConfig,
    fs: {
      allow: ["app", "node_modules"],
    },
  },
  plugins: [
    remix({
      ignoredRouteFiles: ["**/.*"],
    }),
  ],
});
