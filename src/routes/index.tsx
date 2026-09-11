import { Suspense, lazy, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ScanLine,
  BarChart3,
  Boxes,
  ShieldCheck,
  ArrowRight,
  Camera,
  Cpu,
  FileText,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { SiteFooter, SiteHeader } from "@/components/MarketingLayout";
import { CurrencySelect, CycleToggle, PricingGrid } from "@/components/pricing/PricingPlans";
import { useDisplayCurrency } from "@/lib/display-currency";
import { HomeTrustRow } from "@/components/home/HomeTrustRow";
import { LiveDemoSection } from "@/components/landing/retail-shelf-intelligence/LiveDemoSection";

const HomeLeadCapture = lazy(() =>
  import("@/components/home/HomeLeadCapture").then((m) => ({ default: m.HomeLeadCapture })),
);
import type { BillingCycle, Plan } from "@/lib/pricing";


export const Route = createFileRoute("/")({
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
    title: "One photo, full audit",
    body: "Upload a shelf image from any phone. Aislix segments facings, reads packs and returns a complete SKU inventory in seconds.",
  },
  {
    icon: Boxes,
    title: "Out-of-stock detection",
    body: "Empty facings and misplaced SKUs are flagged instantly, with severity so store teams know what to refill first.",
  },
  {
    icon: BarChart3,
    title: "Share of shelf",
    body: "Track your brand's facings against competitors across stores, cities and categories over time.",
  },
  {
    icon: ShieldCheck,
    title: "Planogram compliance",
    body: "Compare live shelves to the approved planogram and score compliance per aisle, per store, per visit.",
  },
];

const steps = [
  { icon: Camera, title: "Capture", body: "Field rep photographs the shelf in the Aislix app." },
  { icon: Cpu, title: "Detect", body: "Vision models identify every product, brand and empty slot." },
  { icon: FileText, title: "Act", body: "Get a shelf health score, alerts and a shareable PDF audit." },
];

function Landing() {
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const { currency, setCurrency, isBase, format } = useDisplayCurrency();
  const navigate = Route.useNavigate();

  const onSelectPlan = (plan: Plan) => {
    if (plan.contactSales) void navigate({ to: "/contact", search: { subject: "Sales enquiry" } });
    else void navigate({ to: "/signup" });
  };


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
            Audit Every Aisle.
            <br />
            <span className="text-brand">From a Single Photo.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Aislix turns a single shelf photo into a full retail audit — products detected, brands
            counted, out-of-stocks flagged and shelf health scored.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Button
              variant="hero"
              size="xl"
              onClick={() =>
                document.querySelector("#live-dashboard")?.scrollIntoView({ behavior: "smooth" })
              }
            >
              Start scanning free <ArrowRight className="size-4" />
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            No card required · 5 free scans per day · Results in 60~90 seconds
          </p>
        </div>
      </section>

      <HomeTrustRow />

      <section id="live-dashboard">
        <LiveDemoSection showWorkspaceCta homepageIntro />
      </section>

      <Suspense fallback={null}>
        <HomeLeadCapture />
      </Suspense>

      <section id="platform" className="border-t border-border py-24">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <p className="text-xs font-medium uppercase tracking-widest text-brand">Platform</p>
          <h2 className="mx-auto mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
            Everything a retail audit team does manually — automated.
          </h2>
          <div className="mt-12 grid gap-5 text-left sm:grid-cols-2">
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

      <section id="how" className="border-t border-border bg-surface py-24">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <p className="text-xs font-medium uppercase tracking-widest text-brand">How it works</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            From photo to decision in three steps.
          </h2>
          <div className="mt-12 grid gap-5 text-left md:grid-cols-3">
            {steps.map((s, i) => (
              <div key={s.title} className="card-surface card-hover p-7">
                <div className="flex items-center justify-between">
                  <span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand">
                    <s.icon className="size-5" />
                  </span>
                  <span className="text-sm text-muted-foreground">0{i + 1}</span>
                </div>
                <h3 className="mt-5 text-lg font-semibold tracking-tight">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="border-t border-border py-24">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <p className="text-xs font-medium uppercase tracking-widest text-brand">Pricing</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Plans that scale from one local store to a national chain.
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Start free with 5 scans a day. Move to Starter at {format(999)}, 5,000 scans a month on
            Professional at {format(4999)}, or talk to us about an Enterprise rollout.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <CycleToggle cycle={cycle} onChange={setCycle} />
            <CurrencySelect currency={currency} onChange={setCurrency} />
          </div>
          {!isBase && (
            <p className="mt-3 text-xs text-muted-foreground">
              Converted from INR at indicative rates; billed in INR.
            </p>
          )}
          <div className="mt-10 text-left">
            <PricingGrid cycle={cycle} onSelect={onSelectPlan} currency={currency} />
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild variant="subtle" className="rounded-xl">
              <Link to="/pricing">
                Compare every feature <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="ghost" className="rounded-xl">
              <Link to="/contact" search={{ subject: "Sales enquiry" }}>Talk to sales</Link>
            </Button>
          </div>
        </div>
      </section>


      <section className="border-t border-border bg-surface py-20">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Your shelves are talking. Start listening.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Join retail teams turning every shelf photo into a complete retail audit in seconds.
          </p>
          <Button asChild variant="hero" size="xl" className="mt-8">
            <Link to="/signup">
              Create your workspace <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>

      <SiteFooter />

    </div>
  );
}
