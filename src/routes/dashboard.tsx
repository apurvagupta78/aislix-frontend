import { lazy, Suspense, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { AiDigitalDashboardShell } from "@/components/dashboard/AiDigitalDashboardShell";
import { supabase } from "@/integrations/supabase/client";
import { markGuestMode } from "@/lib/guest-mode";

const LiveDemoSection = lazy(() =>
  import("@/components/landing/retail-shelf-intelligence/LiveDemoSection").then((m) => ({
    default: m.LiveDemoSection,
  })),
);

type DashboardSearch = {
  tab?: "ai" | "digital";
  intent?: "sample" | "upload";
};

export const Route = createFileRoute("/dashboard")({
  validateSearch: (search: Record<string, unknown>): DashboardSearch => ({
    tab: search.tab === "digital" ? ("digital" as const) : ("ai" as const),
    intent:
      search.intent === "sample" || search.intent === "upload"
        ? search.intent
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Dashboard — Aislix" },
      {
        name: "description",
        content: "AI Audits and Digital Audits operational dashboard with deterministic KPIs.",
      },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { intent } = Route.useSearch();

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (!data.session) markGuestMode();
    });
  }, []);

  useEffect(() => {
    if (!intent) return;
    const t = window.setTimeout(() => {
      document.querySelector("#start-scanning")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 500);
    return () => window.clearTimeout(t);
  }, [intent]);

  return (
    <AppShell title="" hidePageHeader>
      <div className="space-y-10">
        <AiDigitalDashboardShell />
        {intent ? (
          <Suspense
            fallback={
              <div className="min-h-[20rem] rounded-xl border border-border bg-card" aria-hidden="true" />
            }
          >
            <LiveDemoSection showWorkspaceCta guestIntent={intent} />
          </Suspense>
        ) : null}
      </div>
    </AppShell>
  );
}
