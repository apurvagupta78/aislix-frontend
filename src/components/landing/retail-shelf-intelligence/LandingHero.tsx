import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trackLandingEvent } from "@/lib/landing-analytics";
import { scrollToSection } from "@/lib/landing-utm";
import { DEFAULT_SAMPLE_IMAGE } from "@/lib/landing-scan-api";

const TRUST = ["No card required", "5 free audits per day", "Results in seconds"];

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
    <section id="top" className="relative overflow-hidden bg-hero-glow">
      <div className="mx-auto grid max-w-6xl gap-12 px-5 pb-16 pt-12 sm:px-8 sm:pb-20 sm:pt-16 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-14">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs text-muted-foreground shadow-soft">
            <span className="size-1.5 rounded-full bg-primary" />
            AI-Powered Retail Shelf Intelligence
          </span>

          <h1 className="mt-5 text-4xl font-semibold leading-[1.08] tracking-tight text-foreground sm:text-5xl">
            Audit Every Aisle.
            <br />
            <span className="text-primary">From a Single Photo.</span>
          </h1>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">
            Aislix turns a single shelf photo into a complete retail audit — products detected,
            brands counted, out-of-stocks flagged and shelf health scored.
          </p>

          <div className="mt-7">
            <Button
              variant="default"
              size="xl"
              className="w-full sm:w-auto"
              onClick={() => {
                trackLandingEvent("hero_cta_click", { location: "hero" });
                scrollToSection("demo");
              }}
            >
              Start auditning free <ArrowRight className="size-4" />
            </Button>
          </div>

          <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2">
            {TRUST.map((t) => (
              <li key={t} className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="size-4 text-primary" /> {t}
              </li>
            ))}
          </ul>
        </div>

        {/* Product visual */}
        <div className="grid gap-4 rounded-2xl border border-border bg-card p-4 shadow-lift sm:grid-cols-2">
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            <p className="border-b border-border px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Shelf photo
            </p>
            <img
              src={DEFAULT_SAMPLE_IMAGE}
              alt="Retail shelf photo analyzed by Aislix"
              loading="eager"
              className="h-44 w-full object-cover sm:h-56"
            />
          </div>

          <div className="grid gap-4">
            <div className="rounded-xl border border-border bg-surface p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                AI analysis
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {[
                  { label: "Products", value: stats?.products ?? 37 },
                  { label: "Out of stock", value: stats?.outOfStock ?? 4 },
                  {
                    label: "Shelf health",
                    value:
                      stats?.shelfHealth != null ? `${Math.round(stats.shelfHealth)}%` : "86%",
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

            <div className="rounded-xl border border-border bg-surface p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Top issues detected
              </p>
              <ul className="mt-2 space-y-1.5">
                {TOP_ISSUES.map((i) => (
                  <li key={i.label} className="flex items-center gap-2 text-xs text-foreground">
                    <span className="size-1.5 rounded-full bg-primary" />
                    {i.label}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
