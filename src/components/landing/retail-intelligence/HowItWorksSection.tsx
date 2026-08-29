import { Camera, Cpu, Target } from "lucide-react";

const steps = [
  { n: "01", icon: Camera, title: "Capture", body: "Take a shelf photo using a smartphone." },
  {
    n: "02",
    icon: Cpu,
    title: "Analyze",
    body: "Aislix's AI identifies products, brands, quantities, availability and shelf conditions.",
  },
  {
    n: "03",
    icon: Target,
    title: "Act",
    body: "Turn shelf-level observations into actionable retail intelligence.",
  },
] as const;

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="border-t border-border py-20">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <p className="text-xs font-medium uppercase tracking-widest text-brand">How it works</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-4xl">
          From Shelf Photo to Action in Minutes
        </h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="card-surface card-hover p-6">
              <div className="flex items-center justify-between">
                <span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand">
                  <s.icon className="size-5" />
                </span>
                <span className="text-sm text-muted-foreground">{s.n}</span>
              </div>
              <h3 className="mt-4 text-lg font-semibold tracking-tight">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
