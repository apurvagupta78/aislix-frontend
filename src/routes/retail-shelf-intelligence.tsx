import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { SiteFooter, SiteHeader } from "@/components/MarketingLayout";
import { LandingHero, type HeroStats } from "@/components/landing/retail-shelf-intelligence/LandingHero";
import { TrustBar } from "@/components/landing/retail-shelf-intelligence/TrustBar";
import { ProblemSection } from "@/components/landing/retail-shelf-intelligence/ProblemSection";
import { HowItWorks } from "@/components/landing/retail-shelf-intelligence/HowItWorks";
import { FeaturesGrid } from "@/components/landing/retail-shelf-intelligence/FeaturesGrid";
import { LiveDemoSection } from "@/components/landing/retail-shelf-intelligence/LiveDemoSection";
import { WideLeadCapture } from "@/components/landing/retail-shelf-intelligence/WideLeadCapture";
import { UseCasesGrid } from "@/components/landing/retail-shelf-intelligence/UseCasesGrid";
import { RoiSection } from "@/components/landing/retail-shelf-intelligence/RoiSection";
import { FaqSection } from "@/components/landing/retail-shelf-intelligence/FaqSection";
import { FinalCtaSection } from "@/components/landing/retail-shelf-intelligence/FinalCtaSection";
import { MobileStickyCta } from "@/components/landing/retail-shelf-intelligence/MobileStickyCta";

import { trackLandingEvent } from "@/lib/landing-analytics";
import { persistLandingUtm } from "@/lib/landing-utm";
import { signupUrl } from "@/lib/landing-scan-api";
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

  useEffect(() => {
    persistLandingUtm();
    setSessionId(loadLandingSessionId());
    trackLandingEvent("landing_page_view", { page_variant: "retail-shelf-intelligence" });

    const preserveSignupAttribution = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest<HTMLAnchorElement>('header a[href="/signup"]');
      if (!link) return;
      event.preventDefault();
      window.location.assign(signupUrl());
    };
    document.addEventListener("click", preserveSignupAttribution);
    return () => document.removeEventListener("click", preserveSignupAttribution);
  }, []);

  function handleResult(result: LandingScanResult) {
    setSessionId(result.landing_session_id);
    setHeroStats({
      products: result.metrics?.total_products,
      shelfHealth: result.metrics?.shelf_health_score,
    });
    document.getElementById("lead")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="min-h-screen bg-background pb-16 md:pb-0">
      <SiteHeader />
      <main>
        <LandingHero stats={heroStats} />
        <TrustBar />
        <ProblemSection />
        <HowItWorks />
        <FeaturesGrid />
        <LiveDemoSection onResult={handleResult} />
        <WideLeadCapture landingSessionId={sessionId} />
        <UseCasesGrid />
        <RoiSection />
        <FaqSection />
        <div id="final-cta">
          <FinalCtaSection />
        </div>
      </main>
      <SiteFooter />
      <MobileStickyCta hideWhenVisibleId="final-cta" />
    </div>
  );
}
