import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { RetailIntelligenceNav } from "@/components/landing/retail-intelligence/RetailIntelligenceNav";
import { HeroSection } from "@/components/landing/retail-intelligence/HeroSection";
import { ProductDemoSection } from "@/components/landing/retail-intelligence/ProductDemoSection";
import { ProblemSection } from "@/components/landing/retail-intelligence/ProblemSection";
import { HowItWorksSection } from "@/components/landing/retail-intelligence/HowItWorksSection";
import { CapabilitiesSection } from "@/components/landing/retail-intelligence/CapabilitiesSection";
import { ProductVisualizationSection } from "@/components/landing/retail-intelligence/ProductVisualizationSection";
import { UseCasesSection } from "@/components/landing/retail-intelligence/UseCasesSection";
import { BusinessValueSection } from "@/components/landing/retail-intelligence/BusinessValueSection";
import { TrustSection } from "@/components/landing/retail-intelligence/TrustSection";
import { FinalCtaSection } from "@/components/landing/retail-intelligence/FinalCtaSection";
import { trackLandingEvent } from "@/lib/landing-analytics";
import { persistUtmSession } from "@/lib/utm";

const TITLE = "Aislix | AI-Powered Retail Shelf Intelligence";
const DESCRIPTION =
  "Turn shelf photos into retail intelligence with AI-powered product detection, availability insights and retail execution monitoring.";
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
      <main className="pb-20 lg:pb-0">
        <HeroSection />
        <ProductDemoSection />
        <ProblemSection />
        <HowItWorksSection />
        <CapabilitiesSection />
        <ProductVisualizationSection />
        <UseCasesSection />
        <BusinessValueSection />
        <TrustSection />
        <FinalCtaSection />
      </main>
      <footer className="border-t border-border py-10 pb-24 lg:pb-10">
        <div className="mx-auto max-w-6xl px-5 text-center text-xs text-muted-foreground sm:px-8">
          © {new Date().getFullYear()} Aislix — AI Retail Shelf Intelligence.
        </div>
      </footer>
      <MobileStickyCta />
    </div>
  );
}

