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
  ShieldCheck,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { SiteFooter, SiteHeader } from "@/components/MarketingLayout";
import { HomeTrustRow } from "@/components/home/HomeTrustRow";
import { LazyOnVisible } from "@/components/LazyOnVisible";
import { HomepageDemoAuditPreview } from "@/components/landing/retail-shelf-intelligence/HomepageDemoAuditPreview";

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

const FEATURE_SURFACES = [
  "border-[var(--aislix-warehouse-border)] bg-[var(--aislix-warehouse-bg)]",
  "border-[var(--aislix-supermarket-border)] bg-[var(--aislix-supermarket-bg)]",
  "border-[var(--aislix-darkstore-border)] bg-[var(--aislix-darkstore-bg)]",
  "border-[var(--aislix-custom-border)] bg-[var(--aislix-custom-bg)]",
  "border-[var(--aislix-local-border)] bg-[var(--aislix-local-bg)]",
  "border-[var(--aislix-supermarket-border)] bg-white",
];

const STEP_SURFACES = [
  "border-[var(--aislix-warehouse-border)] bg-[var(--aislix-warehouse-bg)]",
  "border-[var(--aislix-supermarket-border)] bg-[var(--aislix-supermarket-bg)]",
  "border-[var(--aislix-darkstore-border)] bg-[var(--aislix-darkstore-bg)]",
  "border-[var(--aislix-custom-border)] bg-[var(--aislix-custom-bg)]",
];

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
    body: "See what needs to be fixed, review the evidence, re-audit the shelf and track whether the issue was resolved.",
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
    subtitle: "Re-audit and measure improvement.",
    body: "Keep every audit, compare previous visits and verify whether the shelf improved after corrective action.",
  },
];

function Landing() {
  return (
    <div className="home-modern min-h-screen bg-background">
      <SiteHeader />

      <section className="relative overflow-hidden border-b border-border bg-background">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 pb-20 pt-14 sm:px-8 sm:pb-24 sm:pt-20 lg:grid-cols-[0.86fr_1.14fr] lg:items-center lg:gap-16">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--aislix-local-border)] bg-[var(--aislix-local-bg)] px-3.5 py-1.5 text-xs font-semibold text-foreground">
              <span className="size-1.5 rounded-full bg-brand" />
              AI-powered retail execution
            </span>
            <h1 className="mt-7 max-w-xl text-5xl font-semibold leading-[1.02] text-foreground sm:text-6xl lg:text-7xl">
              Turn Every Shelf Visit Into Accountable Retail Intelligence.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Capture a shelf photo or run a digital audit. Aislix turns every visit into structured
              findings — detecting products, availability, pricing, promotions and planogram
              compliance, assigning corrective actions, and keeping the evidence until the issue is
              verified closed.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button
              variant="hero"
              size="xl"
              className="w-full rounded-lg px-7 sm:w-auto"
              onClick={() =>
                document.querySelector("#live-dashboard")?.scrollIntoView({ behavior: "smooth" })
              }
            >
              Start Your First Audit Free <ArrowRight className="size-4" />
            </Button>
            </div>
            <div className="mt-7 grid max-w-xl gap-3 sm:grid-cols-3">
              {[
                { icon: ShieldCheck, text: "No card required" },
                { icon: Zap, text: "5 free audits/day" },
                { icon: CircleCheck, text: "Results in 60–90 sec" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <Icon className="size-4 text-brand" strokeWidth={1.8} aria-hidden="true" />
                  {text}
                </div>
              ))}
            </div>
          </div>

          <div className="home-product-frame relative overflow-hidden rounded-2xl p-3 sm:p-4">
            <div className="mb-3 flex items-center justify-between border-b border-border px-1 pb-3">
              <div className="flex items-center gap-1.5" aria-hidden="true">
                <span className="size-2 rounded-full bg-[var(--aislix-darkstore-border)]" />
                <span className="size-2 rounded-full bg-[var(--aislix-supermarket-border)]" />
                <span className="size-2 rounded-full bg-[var(--aislix-local-border)]" />
              </div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Shelf intelligence preview
              </p>
              <span className="w-9" />
            </div>
            <HomepageDemoAuditPreview />
          </div>
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

      <section id="platform" className="home-section bg-card">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <p className="home-kicker">
            THE AISLIX PLATFORM
          </p>
          <h2 className="mx-auto mt-4 max-w-2xl text-3xl font-semibold sm:text-5xl">
            Turn Shelf Visits Into Structured Retail Intelligence.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Stop relying on manual counting, scattered photos and subjective store reports. Aislix
            turns shelf images into consistent, measurable and actionable retail audits.
          </p>
          <div className="mt-12 grid gap-5 text-left sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <div
                key={f.title}
                className={`card-hover rounded-lg border p-7 shadow-soft ${FEATURE_SURFACES[i]}`}
              >
                <span className="grid size-11 place-items-center rounded-lg border border-[var(--aislix-border)] bg-white text-[var(--aislix-primary)]">
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

      <section id="how" className="home-section bg-card">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <p className="home-kicker">HOW IT WORKS</p>
          <h2 className="mt-4 text-3xl font-semibold sm:text-5xl">
            From Shelf Photo to Retail Action in Four Steps.
          </h2>
          <div className="mt-12 grid gap-5 text-left sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s, i) => (
              <div key={s.title} className={`card-hover rounded-lg border p-7 shadow-soft ${STEP_SURFACES[i]}`}>
                <div className="flex items-center justify-between">
                  <span className="grid size-10 place-items-center rounded-xl border border-[var(--aislix-border)] bg-white text-[var(--aislix-primary)]">
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


      <section className="home-dark-band border-t border-border py-20 sm:py-24">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--aislix-local-border)]">Start with one shelf</p>
          <h2 className="mt-4 text-3xl font-semibold text-primary-foreground sm:text-5xl">
            Turn Every Shelf Visit Into Measurable Action.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-sm leading-relaxed text-[var(--aislix-local-border)] sm:text-base">
            From one shelf photo to actionable insights, corrective actions and a complete audit
            history — Aislix helps retail teams see more, act faster and track what changes.
          </p>
          <Button asChild variant="secondary" size="xl" className="mt-8 rounded-lg">
            <Link to="/signup">
              Create Your Free Workspace <ArrowRight className="size-4" />
            </Link>
          </Button>
          <p className="mt-4 text-xs text-[var(--aislix-local-border)]">
            No card required · Start with your first shelf audit
          </p>
        </div>
      </section>

      <SiteFooter />

    </div>
  );
}
