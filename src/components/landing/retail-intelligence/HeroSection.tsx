import { ArrowRight, Camera, Cpu, LineChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trackLandingEvent } from "@/lib/landing-analytics";
import { scrollToDemo } from "./demoBus";


const flow = [
  { icon: Camera, label: "Shelf Photo" },
  { icon: Cpu, label: "AI Analysis" },
  { icon: LineChart, label: "Retail Intelligence" },
] as const;

export function HeroSection() {
  return (
    <section id="hero" className="relative overflow-hidden bg-hero-glow">
      <div className="absolute inset-0 grid-lines opacity-40 [mask-image:radial-gradient(70%_50%_at_50%_0%,black,transparent)]" />
      <div className="relative mx-auto max-w-4xl px-5 py-16 text-center sm:px-8 sm:py-24">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs text-muted-foreground shadow-soft">
          <span className="size-1.5 rounded-full bg-brand" />
          AI-Powered Retail Shelf Intelligence
        </span>
        <h1 className="mt-7 text-3xl font-semibold leading-[1.1] tracking-tight text-foreground sm:text-5xl">
          Turn Any Shelf Photo Into Retail Intelligence
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          Capture a shelf photo. Aislix uses AI to identify products, availability and shelf
          execution issues — turning every store visit into actionable retail intelligence.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild variant="hero" size="xl" className="min-h-11 w-full sm:w-auto">
            <a href="#demo" onClick={() => trackLandingEvent("cta_click", { location: "hero" })}>
              Analyze a Shelf Photo <ArrowRight className="size-4" />
            </a>
          </Button>
          <Button asChild variant="outline" size="xl" className="min-h-11 w-full rounded-xl sm:w-auto">
            <a href="#how-it-works">See How Aislix Works</a>
          </Button>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          3 free shelf scans • No credit card required
        </p>

        <div className="mt-12 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {flow.map((f, i) => (
            <div key={f.label} className="flex items-center gap-3">
              <div className="card-surface flex items-center gap-2.5 px-4 py-3">
                <span className="grid size-9 place-items-center rounded-xl bg-brand-soft text-brand">
                  <f.icon className="size-4" />
                </span>
                <span className="text-sm font-medium text-foreground">{f.label}</span>
              </div>
              {i < flow.length - 1 && (
                <ArrowRight className="size-4 rotate-90 text-muted-foreground sm:rotate-0" />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="relative mx-auto max-w-5xl px-5 pb-16 sm:px-8 sm:pb-24">
        <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-lift">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <span className="size-2.5 rounded-full bg-muted" />
            <span className="size-2.5 rounded-full bg-muted" />
            <span className="size-2.5 rounded-full bg-muted" />
            <span className="ml-3 text-xs text-muted-foreground">aislix.com/dashboard</span>
          </div>
          <img
            src="/marketing/dashboard-preview.webp"
            alt="Aislix dashboard showing shelf health, scan analytics and recent audits"
            className="block h-auto w-full"
            loading="lazy"
            decoding="async"
          />
        </div>
      </div>
    </section>
  );
}
