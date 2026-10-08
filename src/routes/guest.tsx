import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { GuestAiAuditFlow } from "@/components/guest/GuestAiAuditFlow";
import { markGuestMode } from "@/lib/guest-mode";

type GuestSearch = {
  intent?: "sample" | "upload";
};

/** Guest AI audit — the signed-in New audit → AI audit flow inside the app layout, no login. */
export const Route = createFileRoute("/guest")({
  validateSearch: (search: Record<string, unknown>): GuestSearch => ({
    intent:
      search.intent === "sample" || search.intent === "upload"
        ? search.intent
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Live demo — Aislix" },
      {
        name: "description",
        content:
          "Try a real Aislix AI shelf audit — sample photo or your own upload. No login required.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: GuestDemoPage,
});

function GuestDemoPage() {
  const { intent } = Route.useSearch();

  useEffect(() => {
    markGuestMode();
  }, []);

  return (
    <AppShell title="" hidePageHeader>
      <GuestAiAuditFlow key={intent ?? "default"} intent={intent} />
    </AppShell>
  );
}
