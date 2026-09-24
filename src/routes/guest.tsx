import { lazy, Suspense, useEffect } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { markGuestMode } from "@/lib/guest-mode";

const LiveDemoSection = lazy(() =>
  import("@/components/landing/retail-shelf-intelligence/LiveDemoSection").then((m) => ({
    default: m.LiveDemoSection,
  })),
);

type GuestSearch = {
  intent?: "sample" | "upload";
};

/** Dedicated Live Demo session — sample shelf or upload, no AppShell dashboard. */
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
          "Try a real Aislix shelf audit — sample photo or your own upload. No login required.",
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
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-5 sm:px-8">
          <Logo to="/" />
          <p className="hidden text-sm text-muted-foreground sm:block">Live demo · no login</p>
          <div className="ml-auto flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="rounded-lg">
              <Link to="/">Back to home</Link>
            </Button>
            <Button asChild variant="brand" size="sm" className="rounded-lg">
              <Link to="/signup">Start free</Link>
            </Button>
          </div>
        </div>
      </header>

      <Suspense
        fallback={
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
            <div className="mx-auto h-8 w-48 animate-pulse rounded bg-muted" />
            <div className="mx-auto mt-4 h-4 w-72 animate-pulse rounded bg-muted" />
            <div className="mt-10 min-h-[22rem] rounded-xl border border-border bg-card" />
          </div>
        }
      >
        <LiveDemoSection showWorkspaceCta guestIntent={intent} />
      </Suspense>
    </div>
  );
}
