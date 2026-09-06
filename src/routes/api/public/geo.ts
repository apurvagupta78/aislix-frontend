import { createFileRoute } from "@tanstack/react-router";

/**
 * Returns the visitor's ISO country code, resolved from the edge network's
 * geo headers. Public + non-sensitive: used only to pick a display currency.
 */
export const Route = createFileRoute("/api/public/geo")({
  server: {
    handlers: {
      GET: ({ request }) => {
        const h = request.headers;
        const raw =
          h.get("cf-ipcountry") ??
          h.get("x-vercel-ip-country") ??
          h.get("x-country-code") ??
          h.get("x-appengine-country") ??
          "";
        const country = /^[A-Za-z]{2}$/.test(raw) ? raw.toUpperCase() : null;
        return new Response(JSON.stringify({ country }), {
          headers: {
            "content-type": "application/json",
            "cache-control": "no-store",
          },
        });
      },
    },
  },
});
