import { ArrowRight, Camera, ScanSearch, TrendingUp } from "lucide-react";
import { SectionHeading } from "./shared";

const STEPS = [
  { n: "01", Icon: Camera, title: "Capture", body: "Take a shelf photo using any smartphone." },
  {
    n: "02",
    Icon: ScanSearch,
    title: "Analyze",
    body: "Aislix AI detects products, brands, quantities, shelf position and issues.",
  },
  {
    n: "03",
    Icon: TrendingUp,
    title: "Act",
    body: "Turn shelf intelligence into faster retail execution.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-16 bg-background py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <SectionHeading eyebrow="How it works" title="From Shelf Photo to Action in 3 Simple Steps" />

        <div className="mt-10 flex flex-col items-stretch gap-4 lg:flex-row lg:items-center">
          {STEPS.map(({ n, Icon, title, body }, i) => (
            <div key={n} className="flex flex-1 items-center gap-4">
              <div className="flex-1 rounded-xl border border-border bg-card p-6 shadow-soft">
                <div className="flex items-center gap-3">
                  <span className="grid size-8 place-items-center rounded-lg bg-brand text-xs font-semibold text-brand-foreground">
                    {n}
                  </span>
                  <Icon className="size-5 text-brand" strokeWidth={1.7} />
                </div>
                <h3 className="mt-4 text-base font-semibold text-foreground">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </div>
              {i < STEPS.length - 1 && (
                <ArrowRight className="hidden size-5 shrink-0 text-muted-foreground lg:block" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
