import { ArrowRight, PlayCircle, ShieldCheck, Timer, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HomeShelfPreview } from "@/components/home/HomeShelfPreview";

const assurances = [
  { icon: ShieldCheck, label: "No card required" },
  { icon: Zap, label: "5 free audits/day" },
  { icon: Timer, label: "Results in 60–90 sec" },
];

export function HomeHero() {
  return (
    <section id="top" className="relative overflow-hidden bg-card">
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 pb-20 pt-14 lg:grid-cols-[1fr_1.05fr] lg:gap-16 lg:px-8 lg:pb-28 lg:pt-20">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-[#2A6FA8]">
            <span className="size-1.5 rounded-full bg-[#2A6FA8]" aria-hidden="true" />
            AI shelf intelligence for retail execution
          </p>
          <h1 className="mt-5 text-[40px] font-bold leading-[1.05] tracking-[-0.03em] text-foreground sm:text-5xl lg:text-[62px]">
            Turn every shelf visit into accountable retail intelligence.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Snap a shelf photo. Aislix detects products, availability, pricing, promotions and
            planogram compliance — then assigns corrective actions and keeps the evidence until the
            issue is verified closed.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              variant="hero"
              size="xl"
              className="w-full rounded-xl px-6 sm:w-auto"
              onClick={() =>
                document.querySelector("#live-dashboard")?.scrollIntoView({ behavior: "smooth" })
              }
            >
              Start your first audit free
              <ArrowRight className="size-4" />
            </Button>
            <Button asChild variant="outline" size="xl" className="w-full rounded-xl px-6 sm:w-auto">
              <a href="#photo-to-action">
                <PlayCircle className="size-4" />
                See how it works
              </a>
            </Button>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
            {assurances.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Icon className="size-4 text-[var(--aislix-primary)]" aria-hidden="true" />
                {label}
              </li>
            ))}
          </ul>
        </div>
        <HomeShelfPreview />
      </div>
    </section>
  );
}
