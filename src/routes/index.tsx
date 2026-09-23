import { lazy, Suspense } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { SiteFooter, SiteHeader } from "@/components/MarketingLayout";
import { LazyOnVisible } from "@/components/LazyOnVisible";
import { HomeHero } from "@/components/home/HomeHero";
import { HomeRetailFormats } from "@/components/home/HomeRetailFormats";
import { HomePlatformSection } from "@/components/home/HomePlatformSection";
import { HomeHowItWorks } from "@/components/home/HomeHowItWorks";
import { HomeFinalCta } from "@/components/home/HomeFinalCta";

const LiveDemoSection = lazy(() =>
  import("@/components/landing/retail-shelf-intelligence/LiveDemoSection").then((m) => ({
    default: m.LiveDemoSection,
  })),
);
const HomePricingIsland = lazy(() =>
  import("@/components/home/HomePricingIsland").then((m) => ({
    default: m.HomePricingIsland,
  })),
);

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
    links: [{ rel: "canonical", href: "https://aislix.com" }],
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
  return (
    <div className="home-modern min-h-screen bg-background">
      <SiteHeader />

      <HomeHero />
      <HomeRetailFormats />

      <section id="live-dashboard" className="scroll-mt-20">
        <LazyOnVisible
          fallback={
            <div className="bg-card py-16 sm:py-20">
              <div className="mx-auto max-w-7xl px-5 sm:px-8">
                <p className="text-sm font-semibold text-[#2A6FA8]">Try Aislix free</p>
                <h2 className="mt-3 text-3xl font-bold tracking-[-0.02em] text-foreground sm:text-4xl">
                  See what Aislix can find on your shelf.
                </h2>
                <div className="mt-8 min-h-[22rem] rounded-3xl border border-border bg-surface" />
              </div>
            </div>
          }
        >
          <Suspense fallback={<div className="min-h-[28rem] bg-card" aria-hidden="true" />}>
            <LiveDemoSection showWorkspaceCta homepageIntro />
          </Suspense>
        </LazyOnVisible>
      </section>

      <HomePlatformSection />
      <HomeHowItWorks />

      <LazyOnVisible
        fallback={
          <section id="pricing" className="border-t border-border bg-surface py-20 lg:py-28">
            <div className="mx-auto max-w-7xl px-5 lg:px-8">
              <p className="text-sm font-semibold text-[#2A6FA8]">Pricing</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                Plans that scale from one local store to a national chain.
              </h2>
              <div className="mt-10 min-h-[28rem]" />
            </div>
          </section>
        }
      >
        <Suspense
          fallback={
            <section id="pricing" className="border-t border-border bg-surface py-20">
              <div className="mx-auto min-h-[28rem] max-w-7xl" />
            </section>
          }
        >
          <HomePricingIsland />
        </Suspense>
      </LazyOnVisible>

      <HomeFinalCta />
      <SiteFooter />
    </div>
  );
}
