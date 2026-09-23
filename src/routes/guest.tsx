import { lazy, Suspense, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { GuestPageChrome } from "@/components/guest/GuestPageChrome";
import { GuestDashboardPreview } from "@/components/guest/GuestDashboardPreview";

const LiveDemoSection = lazy(() =>
  import("@/components/landing/retail-shelf-intelligence/LiveDemoSection").then((m) => ({
    default: m.LiveDemoSection,
  })),
);

type GuestSearch = {
  intent?: "sample" | "upload";
};

export const Route = createFileRoute("/guest")({
  validateSearch: (search: Record<string, unknown>): GuestSearch => ({
    intent:
      search.intent === "sample" || search.intent === "upload"
        ? search.intent
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Guest dashboard — Aislix" },
      {
        name: "description",
        content:
          "Try the Aislix operations dashboard in guest mode. Run a sample shelf audit or upload your own photo — no login required.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: GuestPage,
});

function GuestPage() {
  const { intent } = Route.useSearch();

  useEffect(() => {
    if (!intent) return;
    const t = window.setTimeout(() => {
      document.querySelector("#start-scanning")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 400);
    return () => window.clearTimeout(t);
  }, [intent]);

  return (
    <GuestPageChrome>
      <div className="mx-auto flex max-w-7xl flex-col gap-10">
        <GuestDashboardPreview />
        <Suspense
          fallback={
            <div className="min-h-[24rem] rounded-xl border border-border bg-card" aria-hidden="true" />
          }
        >
          <LiveDemoSection
            showWorkspaceCta
            homepageIntro={false}
            guestIntent={intent}
          />
        </Suspense>
      </div>
    </GuestPageChrome>
  );
}
