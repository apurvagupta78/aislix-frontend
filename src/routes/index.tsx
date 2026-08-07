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
  Check,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { plans } from "@/lib/aislix-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Aislix — AI Retail Shelf Intelligence & Shelf Auditing" },
      {
        name: "description",
        content:
          "Aislix audits retail shelves automatically with computer vision — detect products, brands, out-of-stocks and planogram gaps from a single photo.",
      },
      { property: "og:title", content: "Aislix — AI Retail Shelf Intelligence" },
      {
        property: "og:description",
        content:
          "Automated shelf audits for supermarkets, FMCG brands, distributors and Kirana stores.",
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
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-6">
          <Logo />
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#platform" className="transition-colors hover:text-foreground">Platform</a>
            <a href="#how" className="transition-colors hover:text-foreground">How it works</a>
            <a href="#pricing" className="transition-colors hover:text-foreground">Pricing</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="rounded-xl">
              <Link to="/login">Log in</Link>
            </Button>
            <Button asChild variant="brand" size="sm" className="rounded-xl">
              <Link to="/signup">Start free</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden bg-hero-glow">
        <div className="absolute inset-0 grid-lines opacity-40 [mask-image:radial-gradient(70%_50%_at_50%_0%,black,transparent)]" />
        <div className="relative mx-auto max-w-4xl px-6 py-24 text-center sm:py-32">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs text-muted-foreground shadow-soft">
            <span className="size-1.5 rounded-full bg-brand" />
            Retail Shelf Intelligence, powered by computer vision
          </span>
          <h1 className="mt-7 text-4xl font-semibold leading-[1.08] tracking-tight text-foreground sm:text-6xl">
            Audit every shelf.
            <br />
            <span className="text-brand">Without walking the aisle.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Aislix turns a single shelf photo into a full retail audit — products detected, brands
            counted, out-of-stocks flagged and shelf health scored. Built for supermarkets, FMCG
            teams, distributors and Kirana stores.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Button asChild variant="hero" size="xl">
              <Link to="/signup">
                Start scanning free <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="subtle" size="xl">
              <Link to="/dashboard">View live demo</Link>
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            No card required · 50 free scans · Live in under 10 minutes
          </p>
        </div>

        <div className="relative mx-auto max-w-5xl px-6 pb-24">
          <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-lift">
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <span className="size-2.5 rounded-full bg-muted" />
              <span className="size-2.5 rounded-full bg-muted" />
              <span className="size-2.5 rounded-full bg-muted" />
              <span className="ml-3 text-xs text-muted-foreground">app.aislix.com/dashboard</span>
            </div>
            <div className="grid gap-4 p-6 sm:grid-cols-4">
              {[
                { l: "Total scans", v: "1,284" },
                { l: "Products detected", v: "74,210" },
                { l: "Avg. confidence", v: "94.6%" },
                { l: "Shelf health", v: "88 / 100" },
              ].map((k) => (
                <div key={k.l} className="rounded-2xl border border-border bg-surface p-4">
                  <p className="text-xs text-muted-foreground">{k.l}</p>
                  <p className="mt-2 text-xl font-semibold tracking-tight">{k.v}</p>
                </div>
              ))}
              <div className="sm:col-span-4 rounded-2xl border border-border bg-surface p-5">
                <div className="flex items-end gap-2">
                  {[38, 52, 46, 64, 58, 76, 71, 88, 82, 94, 90, 100].map((h, i) => (
                    <div
                      key={i}
                      style={{ height: `${h}%` }}
                      className="h-full flex-1 rounded-t-md bg-gradient-brand opacity-90"
                    />
                  ))}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Products detected per week · last 12 weeks
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="platform" className="border-t border-border py-24">
        <div className="mx-auto max-w-6xl px-6">
          <p className="text-xs font-medium uppercase tracking-widest text-brand">Platform</p>
          <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
            Everything a retail audit team does manually — automated.
          </h2>
          <div className="mt-12 grid gap-5 sm:grid-cols-2">
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
        <div className="mx-auto max-w-6xl px-6">
          <p className="text-xs font-medium uppercase tracking-widest text-brand">How it works</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            From photo to decision in three steps.
          </h2>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
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
        <div className="mx-auto max-w-7xl px-6">
          <p className="text-xs font-medium uppercase tracking-widest text-brand">Pricing</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Plans that scale from one Kirana to a national chain.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Start free with 3 scans a day. Move to Starter at ₹999, unlimited scans on Professional
            at ₹4,999, or talk to us about an Enterprise rollout.
          </p>
          <div className="mt-8">
            <CycleToggle cycle={cycle} onChange={setCycle} />
          </div>
          <div className="mt-10">
            <PricingGrid cycle={cycle} />
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
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
            Join retail teams cutting audit time by 90% with automated shelf intelligence.
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
