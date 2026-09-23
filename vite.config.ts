import vinext from "vinext";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { readExecutionProfile } from "./scripts/execution-profile.mjs";
import { sites } from "./build/sites-vite-plugin";


const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  "00000000-0000-4000-8000-000000000000";

// Clean binding config — no d1, no r2, no hostingConfig
const localBindingConfig = {
  main: "vinext/server/fetch-handler",
  compatibility_flags: ["nodejs_compat"],
  d1_databases: [],
  r2_buckets: [],
};

const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";
const managedLinux = readExecutionProfile() === "managed-linux";

export default defineConfig(async () => {
  process.env.CLOUDFLARE_CF_FETCH_ENABLED ??= "false";
  process.env.WRANGLER_SEND_METRICS ??= "false";
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.WRANGLER_REGISTRY_PATH ??= ".wrangler/dev-registry";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    plugins: [
      cloudflare(),   // ← FIXED
      tailwindcss(),
      sites(),
      vinext(),
    ],

    server: {
      watch: {
        usePolling: isCodexSeatbeltSandbox || managedLinux,
      },
    },
  };
});
