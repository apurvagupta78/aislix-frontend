// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import path from "node:path";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from "vite";

// Server-side code (email routes, server functions) reads non-VITE_ env vars
// through process.env; the base config only injects VITE_* into the client.
const serverEnv = loadEnv(process.env["NODE_ENV"] ?? "development", process.cwd(), "");
Object.assign(process.env, serverEnv);

// Lovable defaults to Cloudflare; only override Nitro preset on Vercel builds.
const isVercel = Boolean(process.env["VERCEL"]);

/** Legacy scan URLs → audit routes (server redirects; keeps the route tree smaller). */
const legacyAuditRedirects = {
  "/scan": { redirect: { to: "/audit", statusCode: 301 } },
  "/my-scans": { redirect: { to: "/my-audits", statusCode: 301 } },
  "/assign-scan": { redirect: { to: "/assign-audit", statusCode: 301 } },
  "/assigned-scans": { redirect: { to: "/assigned-audits", statusCode: 301 } },
  "/admin/scans": { redirect: { to: "/admin/audits", statusCode: 301 } },
  "/admin/demo-scans": { redirect: { to: "/admin/demo-audits", statusCode: 301 } },
  "/demo-scans": { redirect: { to: "/admin/demo-audits", statusCode: 301 } },
} as const;

export default defineConfig({
  nitro: {
    ...(isVercel ? { preset: "vercel" as const } : {}),
    routeRules: legacyAuditRedirects,
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    resolve: {
      alias: {
        // React Email needs entities v4.5.0; pin every import to the hoisted copy.
        "entities/lib/decode.js": path.resolve(import.meta.dirname, "node_modules/entities/lib/decode.js"),
        "entities/lib/encode.js": path.resolve(import.meta.dirname, "node_modules/entities/lib/encode.js"),
        entities: path.resolve(import.meta.dirname, "node_modules/entities"),
      },
    },
  },
});
