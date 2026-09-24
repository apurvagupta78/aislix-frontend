import { lazy, Suspense, useEffect } from "react";
import { createFileRoute, useRouterState } from "@tanstack/react-router";

import { SiteFooter, SiteHeader } from "@/components/MarketingLayout";
import { LazyOnVisible } from "@/components/LazyOnVisible";
import { HomeHero } from "@/components/home/HomeHero";
import { HomeRetailFormats } from "@/components/home/HomeRetailFormats";
import { HomeTryAislix } from "@/components/home/HomeTryAislix";
import { HomePhotoToActionFlow } from "@/components/home/HomePhotoToActionFlow";

const HomeLeadCapture = lazy(() =>
  import("@/components/home/HomeLeadCapture").then((m) => ({
    default: m.HomeLeadCapture,
  })),
);
const HomePlatformSection = lazy(() =>
  import("@/components/home/HomePlatformSection").then((m) => ({
    default: m.HomePlatformSection,
  })),
);
const HomeHowItWorks = lazy(() =>
  import("@/components/home/HomeHowItWorks").then((m) => ({
    default: m.HomeHowItWorks,
  })),
);
const HomePricingIsland = lazy(() =>
  import("@/components/home/HomePricingIsland").then((m) => ({
    default: m.HomePricingIsland,
  })),
);
const HomeFinalCta = lazy(() =>
  import("@/components/home/HomeFinalCta").then((m) => ({
    default: m.HomeFinalCta,
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

function SectionSkeleton({ minHeight = "16rem" }: { minHeight?: string }) {
  return <div className="w-full bg-background" style={{ minHeight }} aria-hidden="true" />;
}

function Landing() {
  const hash = useRouterState({ select: (s) => s.location.hash });

  useEffect(() => {
    const id = hash.replace(/^#/, "");
    if (!id) return;
    const t = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
    return () => window.clearTimeout(t);
  }, [hash]);

  return (
    <div className="home-modern min-h-screen bg-background">
      <SiteHeader />

      <HomeHero />
      <HomeRetailFormats />
      <HomeTryAislix />
      <HomePhotoToActionFlow />

      <LazyOnVisible fallback={<SectionSkeleton />}>
        <Suspense fallback={null}>
          <HomeLeadCapture />
        </Suspense>
      </LazyOnVisible>

      <LazyOnVisible fallback={<SectionSkeleton minHeight="24rem" />}>
        <Suspense fallback={<SectionSkeleton minHeight="24rem" />}>
          <HomePlatformSection />
        </Suspense>
      </LazyOnVisible>

      <LazyOnVisible fallback={<SectionSkeleton minHeight="20rem" />}>
        <Suspense fallback={<SectionSkeleton minHeight="20rem" />}>
          <HomeHowItWorks />
        </Suspense>
      </LazyOnVisible>

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

      <LazyOnVisible fallback={<SectionSkeleton minHeight="18rem" />}>
        <Suspense fallback={<SectionSkeleton minHeight="18rem" />}>
          <HomeFinalCta />
        </Suspense>
      </LazyOnVisible>

      <SiteFooter />
    </div>
  );
}
