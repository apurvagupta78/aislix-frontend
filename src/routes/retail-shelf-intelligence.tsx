import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { LandingNav } from "@/components/landing/retail-shelf-intelligence/LandingNav";
import { LandingHero, type HeroStats } from "@/components/landing/retail-shelf-intelligence/LandingHero";
import { TrustBar } from "@/components/landing/retail-shelf-intelligence/TrustBar";
import { ProblemSection } from "@/components/landing/retail-shelf-intelligence/ProblemSection";
import { HowItWorks } from "@/components/landing/retail-shelf-intelligence/HowItWorks";
import { FeaturesGrid } from "@/components/landing/retail-shelf-intelligence/FeaturesGrid";
import { LiveDemoSection } from "@/components/landing/retail-shelf-intelligence/LiveDemoSection";
import { ProductShowcase } from "@/components/landing/retail-shelf-intelligence/ProductShowcase";
import { UseCasesGrid } from "@/components/landing/retail-shelf-intelligence/UseCasesGrid";
import { RoiSection } from "@/components/landing/retail-shelf-intelligence/RoiSection";
import { WideLeadCapture } from "@/components/landing/retail-shelf-intelligence/WideLeadCapture";
import { FaqSection } from "@/components/landing/retail-shelf-intelligence/FaqSection";
import { FinalCtaSection } from "@/components/landing/retail-shelf-intelligence/FinalCtaSection";
import { LandingFooter } from "@/components/landing/retail-shelf-intelligence/LandingFooter";
import { MobileStickyCta } from "@/components/landing/retail-shelf-intelligence/MobileStickyCta";

import { trackLandingEvent } from "@/lib/landing-analytics";
import { persistLandingUtm } from "@/lib/landing-utm";
import { loadLandingSessionId, type LandingScanResult } from "@/lib/landing-scan-api";

const TITLE = "AI Retail Shelf Intelligence | Aislix";
const DESCRIPTION =
  "Audit every aisle from a single photo. Aislix detects products, brands, out-of-stocks and shelf health in seconds. Try the live AI shelf demo free.";
const URL = "https://aislix.com/retail-shelf-intelligence";

export const Route = createFileRoute("/retail-shelf-intelligence")({
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
  component: RetailShelfIntelligencePage,
});

function RetailShelfIntelligencePage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [heroStats, setHeroStats] = useState<HeroStats | undefined>(undefined);
  const [analyzedImage, setAnalyzedImage] = useState<string | null>(null);

  useEffect(() => {
    persistLandingUtm();
    setSessionId(loadLandingSessionId());
    trackLandingEvent("landing_page_view", { page_variant: "retail-shelf-intelligence" });
  }, []);

  function handleResult(result: LandingScanResult, imageUrl: string | null) {
    setSessionId(result.landing_session_id);
    setAnalyzedImage(imageUrl);
    setHeroStats({
      products: result.metrics?.total_products,
      shelfHealth: result.metrics?.shelf_health_score,
    });
  }

  return (
    <div className="min-h-screen bg-background pb-16 md:pb-0">
      <LandingNav />
      <main>
        <LandingHero stats={heroStats} />
        <TrustBar />
        <ProblemSection />
        <HowItWorks />
        <FeaturesGrid />
        <LiveDemoSection onResult={handleResult} />
        <ProductShowcase imageUrl={analyzedImage} />
        <UseCasesGrid />
        <RoiSection />
        <WideLeadCapture landingSessionId={sessionId} />
        <FaqSection />
        <div id="final-cta">
          <FinalCtaSection />
        </div>
      </main>
      <LandingFooter />
      <MobileStickyCta hideWhenVisibleId="final-cta" />
    </div>
  );
}
