import { useEffect } from "react";
import { createFileRoute, useRouterState } from "@tanstack/react-router";

import { SiteFooter, SiteHeader } from "@/components/MarketingLayout";
import { HomeHero } from "@/components/home/HomeHero";
import { HomeRetailFormats } from "@/components/home/HomeRetailFormats";
import { HomeTryAislix } from "@/components/home/HomeTryAislix";
import { HomePhotoToActionFlow } from "@/components/home/HomePhotoToActionFlow";
import { HomeLeadCapture } from "@/components/home/HomeLeadCapture";
import { HomePlatformSection } from "@/components/home/HomePlatformSection";
import { HomeHowItWorks } from "@/components/home/HomeHowItWorks";
import { HomePricingIsland } from "@/components/home/HomePricingIsland";
import { HomeFinalCta } from "@/components/home/HomeFinalCta";
import { scrollHomeSectionIntoView } from "@/lib/home/scroll-home-section";

export const Route = createFileRoute("/")({
  headers: () => ({
    "Cache-Control": "public, max-age=0, s-maxage=180, stale-while-revalidate=86400",
    "CDN-Cache-Control": "public, s-maxage=180, stale-while-revalidate=86400",
  }),
  head: () => ({
    meta: [
      { property: "og:url", content: "https://aislix.com" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Aislix — Retail Audit & Shelf Intelligence Platform" },
      {
        name: "description",
        content:
          "Enterprise retail audit management — plan, execute, review and learn from digital, manual and AI-assisted shelf audits in one accountable workflow.",
      },
      { property: "og:title", content: "Aislix — Retail Audit & Shelf Intelligence" },
      {
        property: "og:description",
        content:
          "Digital and AI-assisted collection, exception-first management, evidence traceability, and verified corrective actions for retail teams.",
      },
      { property: "og:image", content: "https://aislix.com/og-image.png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:title", content: "Aislix — Retail Audit & Shelf Intelligence" },
      {
        name: "twitter:description",
        content: "One platform for digital, manual and AI-assisted retail audits with accountable follow-through.",
      },
      { name: "twitter:image", content: "https://aislix.com/og-image.png" },
    ],
    links: [
      { rel: "canonical", href: "https://aislix.com" },
      { rel: "preload", href: "/home-hero-shelf.jpg", as: "image" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "WebSite",
              "@id": "https://aislix.com/#website",
              name: "Aislix",
              url: "https://aislix.com",
              description:
                "Retail Audit & Shelf Intelligence — digital and AI-assisted collection, review, exceptions and corrective actions in one platform.",
              publisher: { "@id": "https://aislix.com/#organization" },
            },
            {
              "@type": "Organization",
              "@id": "https://aislix.com/#organization",
              name: "Aislix",
              url: "https://aislix.com",
              logo: "https://aislix.com/apple-touch-icon.png",
              description:
                "Aislix is a retail audit management and shelf intelligence platform for supermarkets, dark stores, FMCG brands, distributors and local stores.",
              email: "hello@aislix.com",
              sameAs: [
                "https://www.linkedin.com/company/aislix/",
                "https://x.com/aislix_ai",
                "https://www.youtube.com/@AislixAI",
              ],
            },
          ],
        }),
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const hash = useRouterState({ select: (s) => s.location.hash });

  useEffect(() => {
    const id = hash.replace(/^#/, "");
    if (!id) return;
    scrollHomeSectionIntoView(id, "auto");
    const t = window.setTimeout(() => scrollHomeSectionIntoView(id, "smooth"), 120);
    return () => window.clearTimeout(t);
  }, [hash]);

  return (
    <div className="home-modern min-h-screen bg-background">
      <SiteHeader />

      <HomeHero />
      <HomeRetailFormats />
      <HomeTryAislix />
      <HomePhotoToActionFlow />
      <HomeLeadCapture />
      <HomePlatformSection />
      <HomeHowItWorks />
      <HomePricingIsland />
      <HomeFinalCta />

      <SiteFooter />
    </div>
  );
}
