import { lazy, Suspense } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ScanLine,
  BarChart3,
  ArrowRight,
  Camera,
  CircleCheck,
  LayoutGrid,
  BadgePercent,
  Wrench,
  Sparkles,
  History,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { SiteFooter, SiteHeader } from "@/components/MarketingLayout";
import { HomeTrustRow } from "@/components/home/HomeTrustRow";
import { LazyOnVisible } from "@/components/LazyOnVisible";

const LiveDemoSection = lazy(() =>
  import("@/components/landing/retail-shelf-intelligence/LiveDemoSection").then((m) => ({
    default: m.LiveDemoSection,
  })),
);
const HomeRetailWorkflows = lazy(() =>
  import("@/components/home/HomeRetailWorkflows").then((m) => ({
    default: m.HomeRetailWorkflows,
  })),
);
const HomeWhatsAppProblem = lazy(() =>
  import("@/components/home/HomeWhatsAppProblem").then((m) => ({
    default: m.HomeWhatsAppProblem,
  })),
);
const HomeAuditHistory = lazy(() =>
  import("@/components/home/HomeAuditHistory").then((m) => ({
    default: m.HomeAuditHistory,
  })),
);
const HomeLeadCapture = lazy(() =>
  import("@/components/home/HomeLeadCapture").then((m) => ({
    default: m.HomeLeadCapture,
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
      { title: "Aislix — AI Retail Shelf Intelligence & Shelf Auditing" },
      {
        name: "description",
        content:
          "Aislix audits retail shelves automatically with computer vision — detect products, brands, out-of-stocks and planogram gaps from a single photo.",
      },
      { property: "og:title", content: "Aislix — AI-Powered Retail Shelf Auditing" },
      {
        property: "og:description",
        content:
          "Turn a shelf photo into a complete retail audit in ~60 seconds. Product detection, planogram compliance and actionable insights.",
      },
      { property: "og:image", content: "https://aislix.com/og-image.png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:title", content: "Aislix — AI-Powered Retail Shelf Auditing" },
      {
        name: "twitter:description",
        content: "Turn a shelf photo into a complete retail audit in ~60 seconds.",
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
                "AI Retail Shelf Intelligence — automated shelf audits, out-of-stock detection, share of shelf and planogram compliance from a single photo.",
              publisher: { "@id": "https://aislix.com/#organization" },
            },
            {
              "@type": "Organization",
              "@id": "https://aislix.com/#organization",
              name: "Aislix",
              url: "https://aislix.com",
              logo: "https://aislix.com/apple-touch-icon.png",
              description:
                "Aislix is an AI-powered retail shelf intelligence platform for supermarkets, dark stores, warehouses, FMCG brands, distributors and local stores.",
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

const features = [
  {
    icon: ScanLine,
    title: "One Photo. Full Shelf Audit.",
    body: "Upload a shelf photo and let Aislix identify products, brands, facings and visible shelf conditions.",
  },
  {
    icon: CircleCheck,
    title: "Know What's Actually Available.",
    body: "Measure on-shelf availability and identify products that are missing or need attention.",
  },
  {
    icon: LayoutGrid,
    title: "Measure Shelf Execution.",
    body: "Compare actual shelf placement and facings against the expected planogram when one is configured.",
  },
  {
    icon: BadgePercent,
    title: "Check Prices & Promotions.",
    body: "Detect visible price and promotional issues and highlight where shelf execution does not match the configured requirements.",
  },
  {
    icon: BarChart3,
    title: "Measure Your Shelf Presence.",
    body: "For FMCG brands, measure facings and Share of Shelf against relevant competitors and planned allocation.",
  },
  {
    icon: Wrench,
    title: "Turn Issues Into Actions.",
    body: "See what needs to be fixed, review the evidence, rescan the shelf and track whether the issue was resolved.",
  },
];

const steps = [
  {
    icon: Camera,
    title: "Capture",
    subtitle: "Take a photo.",
    body: "Capture the shelf using your phone or upload an existing shelf image.",
  },
  {
    icon: Sparkles,
    title: "Understand",
    subtitle: "Let Aislix read the shelf.",
    body: "Aislix identifies products, brands, facings and visible shelf conditions, then calculates the configured retail KPIs.",
  },
  {
    icon: Wrench,
    title: "Act",
    subtitle: "Know what needs attention.",
    body: "Review issues, inspect the image evidence and see what needs to be fixed.",
  },
  {
    icon: History,
    title: "Track",
    subtitle: "Rescan and measure improvement.",
    body: "Keep every audit, compare previous visits and verify whether the shelf improved after corrective action.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />


      <section className="relative overflow-hidden bg-hero-glow">
        <div className="absolute inset-0 grid-lines opacity-40 [mask-image:radial-gradient(70%_50%_at_50%_0%,black,transparent)]" />
        <div className="relative mx-auto max-w-3xl px-6 pb-14 pt-16 text-center sm:pb-16 sm:pt-20">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs text-muted-foreground shadow-soft">
            <span className="size-1.5 rounded-full bg-brand" />
            AI-Powered Retail Shelf Intelligence
          </span>
          <h1 className="mt-7 text-4xl font-semibold leading-[1.08] tracking-tight text-foreground sm:text-6xl">
            Turn One Shelf Photo Into Actionable Retail Intelligence.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Aislix uses AI to turn shelf photos into retail intelligence — highlighting what needs
            attention while keeping every store visit and audit in one searchable history, so teams
            can track issues, measure improvement and stop losing shelf insights in WhatsApp or
            Emails.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Button
              variant="hero"
              size="xl"
              onClick={() =>
                document.querySelector("#live-dashboard")?.scrollIntoView({ behavior: "smooth" })
              }
            >
              Try Your First Audit Free <ArrowRight className="size-4" />
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            No card required · 30 free scans/month · Up to 5 scans/day
          </p>
        </div>
      </section>

      <HomeTrustRow />

      <section id="live-dashboard">
        <LazyOnVisible
          fallback={
            <div className="bg-surface py-16 sm:py-20">
              <div className="mx-auto max-w-6xl px-5 sm:px-8">
                <p className="text-xs font-medium uppercase tracking-widest text-brand">
                  TRY AISLIX FREE
                </p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                  See What Aislix Can Find on Your Shelf.
                </h2>
                <div className="mt-8 min-h-[22rem] rounded-xl border border-border bg-card" />
              </div>
            </div>
          }
        >
          <Suspense
            fallback={
              <div className="min-h-[28rem] bg-surface" aria-hidden="true" />
            }
          >
            <LiveDemoSection showWorkspaceCta homepageIntro />
          </Suspense>
        </LazyOnVisible>
      </section>

      <section id="platform" className="border-t border-border py-24">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <p className="text-xs font-medium uppercase tracking-widest text-brand">
            THE AISLIX PLATFORM
          </p>
          <h2 className="mx-auto mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
            Turn Shelf Visits Into Structured Retail Intelligence.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Stop relying on manual counting, scattered photos and subjective store reports. Aislix
            turns shelf images into consistent, measurable and actionable retail audits.
          </p>
          <div className="mt-12 grid gap-5 text-left sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="card-surface p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-lift"
              >
                <span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand">
                  <f.icon className="size-5" />
                </span>
                <h3 className="mt-5 text-lg font-semibold tracking-tight">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <LazyOnVisible fallback={<div className="min-h-[24rem]" aria-hidden="true" />}>
        <Suspense fallback={null}>
          <HomeRetailWorkflows />
        </Suspense>
      </LazyOnVisible>

      <LazyOnVisible fallback={<div className="min-h-[20rem]" aria-hidden="true" />}>
        <Suspense fallback={null}>
          <HomeWhatsAppProblem />
        </Suspense>
      </LazyOnVisible>

      <LazyOnVisible fallback={<div className="min-h-[20rem]" aria-hidden="true" />}>
        <Suspense fallback={null}>
          <HomeAuditHistory />
        </Suspense>
      </LazyOnVisible>

      <section id="how" className="border-t border-border bg-background py-24">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <p className="text-xs font-medium uppercase tracking-widest text-brand">HOW IT WORKS</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            From Shelf Photo to Retail Action in Four Steps.
          </h2>
          <div className="mt-12 grid gap-5 text-left sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s, i) => (
              <div key={s.title} className="card-surface card-hover p-7">
                <div className="flex items-center justify-between">
                  <span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand">
                    <s.icon className="size-5" />
                  </span>
                  <span className="text-sm text-muted-foreground">0{i + 1}</span>
                </div>
                <h3 className="mt-5 text-lg font-semibold tracking-tight">{s.title}</h3>
                <p className="mt-1 text-sm font-medium text-foreground/90">{s.subtitle}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <LazyOnVisible fallback={<div className="min-h-[22rem]" aria-hidden="true" />}>
        <Suspense fallback={null}>
          <HomeLeadCapture />
        </Suspense>
      </LazyOnVisible>

      <LazyOnVisible
        fallback={
          <section id="pricing" className="border-t border-border py-24">
            <div className="mx-auto max-w-[90rem] px-6 text-center sm:px-8">
              <p className="text-xs font-medium uppercase tracking-widest text-brand">Pricing</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                Plans that scale from one local store to a national chain.
              </h2>
              <div className="mt-10 min-h-[28rem]" />
            </div>
          </section>
        }
      >
        <Suspense
          fallback={
            <section id="pricing" className="border-t border-border py-24">
              <div className="mx-auto min-h-[28rem] max-w-[90rem]" />
            </section>
          }
        >
          <HomePricingIsland />
        </Suspense>
      </LazyOnVisible>


      <section className="border-t border-border bg-surface py-20">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Turn Every Shelf Visit Into Measurable Action.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            From one shelf photo to actionable insights, corrective actions and a complete audit
            history — Aislix helps retail teams see more, act faster and track what changes.
          </p>
          <Button asChild variant="hero" size="xl" className="mt-8">
            <Link to="/signup">
              Create Your Free Workspace <ArrowRight className="size-4" />
            </Link>
          </Button>
          <p className="mt-4 text-xs text-muted-foreground">
            No card required · Start with your first shelf audit
          </p>
        </div>
      </section>

      <SiteFooter />

    </div>
  );
}
