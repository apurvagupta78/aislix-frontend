import { createFileRoute, redirect } from "@tanstack/react-router";
import { markGuestMode } from "@/lib/guest-mode";

/** Legacy /guest bookmarks → real dashboard Guest mode. */
export const Route = createFileRoute("/guest")({
  validateSearch: (search: Record<string, unknown>) => ({
    intent:
      search.intent === "sample" || search.intent === "upload"
        ? (search.intent as "sample" | "upload")
        : undefined,
  }),
  beforeLoad: ({ search }) => {
    markGuestMode();
    throw redirect({
      to: "/dashboard",
      search: {
        tab: "ai" as const,
        ...(search.intent ? { intent: search.intent } : {}),
      },
    });
  },
});
