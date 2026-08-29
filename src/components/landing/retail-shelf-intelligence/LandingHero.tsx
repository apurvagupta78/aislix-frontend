import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trackLandingEvent } from "@/lib/landing-analytics";
import { scrollToSection } from "@/lib/landing-utm";
import { DEFAULT_SAMPLE_IMAGE } from "@/lib/landing-scan-api";
import { SignupCta } from "./shared";

const TRUST = ["No card required", "3 free scans per day", "Results in seconds"];

const TOP_ISSUES = [
  { label: "Out of stock" },
  { label: "Wrong placement" },
  { label: "Low stock" },
  { label: "Planogram break" },
];

export type HeroStats = {
  products?: number;
  outOfStock?: number;
  shelfHealth?: number;
};

export function LandingHero({ stats }: { stats?: HeroStats }) {
  return (
    <section id="top" className="relative overflow-hidden bg-landing-navy">
      <div className="mx-auto grid max-w-6xl gap-12 px-5 pb-16 pt-12 sm:px-8 sm:pb-20 sm:pt-16 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-14">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-foreground/15 bg-brand-foreground/5 px-3 py-1 text-xs font-medium text-brand-foreground/85">
            AI-Powered Retail Shelf Intelligence
          </span>

          <h1 className="mt-5 text-4xl font-semibold leading-[1.08] tracking-tight text-brand-foreground sm:text-5xl">
            Audit Every Aisle.
            <br />
            <span className="text-landing-cyan">From a Single Photo.</span>
          </h1>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-brand-foreground/70">
            Aislix turns a single shelf photo into a complete retail audit — products detected,
            brands counted, out-of-stocks flagged and shelf health scored.
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <SignupCta location="hero" event="hero_cta_click" size="xl" className="w-full sm:w-auto" />
            <Button
              variant="outline"
              size="xl"
              className="w-full border-brand-foreground/25 bg-transparent text-brand-foreground hover:bg-brand-foreground/10 hover:text-brand-foreground sm:w-auto"
              onClick={() => {
                trackLandingEvent("demo_click", { location: "hero" });
                scrollToSection("demo");
              }}
            >
              View live demo
            </Button>
          </div>

          <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2">
            {TRUST.map((t) => (
              <li key={t} className="flex items-center gap-2 text-sm text-brand-foreground/70">
                <CheckCircle2 className="size-4 text-landing-cyan" /> {t}
              </li>
            ))}
          </ul>
        </div>

        {/* Product visual */}
        <button
          type="button"
          aria-label="View the live shelf demo"
          onClick={() => {
            trackLandingEvent("demo_click", { location: "hero_visual" });
            scrollToSection("demo");
          }}
          className="group w-full text-left"
        >
          <div className="grid gap-4 rounded-2xl border border-brand-foreground/10 bg-brand-foreground/5 p-4 shadow-lift sm:grid-cols-2">
            <div className="overflow-hidden rounded-xl border border-brand-foreground/10 bg-landing-navy-soft">
              <p className="border-b border-brand-foreground/10 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-brand-foreground/60">
                Shelf photo
              </p>
              <img
                src={DEFAULT_SAMPLE_IMAGE}
                alt="Retail shelf photo analyzed by Aislix"
                loading="eager"
                className="h-44 w-full object-cover transition-transform duration-500 group-hover:scale-[1.03] sm:h-56"
              />
            </div>

            <div className="grid gap-4">
              <div className="rounded-xl border border-landing-border bg-card p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  AI analysis
                </p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {[
                    { label: "Products", value: stats?.products },
                    { label: "Out of stock", value: stats?.outOfStock },
                    {
                      label: "Shelf health",
                      value: stats?.shelfHealth != null ? `${Math.round(stats.shelfHealth)}%` : undefined,
                    },
                  ].map((m) => (
                    <div key={m.label}>
                      <p className="text-lg font-semibold tracking-tight text-foreground">
                        {m.value ?? "—"}
                      </p>
                      <p className="text-[10px] leading-tight text-muted-foreground">{m.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-landing-border bg-card p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Top issues detected
                </p>
                <ul className="mt-2 space-y-1.5">
                  {TOP_ISSUES.map((i) => (
                    <li key={i.label} className="flex items-center gap-2 text-xs text-foreground">
                      <span className="size-1.5 rounded-full bg-landing-cyan" />
                      {i.label}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </button>
      </div>
    </section>
  );
}
