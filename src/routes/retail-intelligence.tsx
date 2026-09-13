import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { RetailIntelligenceNav } from "@/components/landing/retail-intelligence/RetailIntelligenceNav";
import { HeroSection } from "@/components/landing/retail-intelligence/HeroSection";
import { RetailIntelligenceDemo } from "@/components/landing/retail-intelligence/RetailIntelligenceDemo";

import { trackLandingEvent } from "@/lib/landing-analytics";
import { persistUtmSession } from "@/lib/utm";

const TITLE = "Aislix | AI-Powered Retail Shelf Intelligence";
const DESCRIPTION =
  "Run a live AI shelf audit in your browser. Aislix turns a shelf photo into product detection, SKU counts and availability insights in under a minute.";
const URL = "https://aislix.com/retail-intelligence";

export const Route = createFileRoute("/retail-intelligence")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: URL },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: URL }],
  }),
  component: RetailIntelligencePage,
});

function RetailIntelligencePage() {
  useEffect(() => {
    persistUtmSession();
    trackLandingEvent("landing_page_view");
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <RetailIntelligenceNav />
      <main>
        <HeroSection />
        <RetailIntelligenceDemo />
      </main>
      <footer className="border-t border-border bg-card py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-5 text-xs text-muted-foreground sm:flex-row sm:justify-between sm:px-8">
          <span>© {new Date().getFullYear()} Aislix</span>
          <span className="flex items-center gap-4">
            <a href="/privacy" className="hover:text-foreground">
              Privacy
            </a>
            <a href="/terms" className="hover:text-foreground">
              Terms
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}
