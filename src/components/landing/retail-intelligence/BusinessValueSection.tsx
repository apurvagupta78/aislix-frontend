import { Gauge, Eye, ShieldCheck, Sparkles } from "lucide-react";

const outcomes = [
  { icon: Gauge, title: "Faster Shelf Audits" },
  { icon: Eye, title: "Better Store-Level Visibility" },
  { icon: ShieldCheck, title: "Fewer Execution Gaps" },
  { icon: Sparkles, title: "Actionable Retail Intelligence" },
] as const;

export function BusinessValueSection() {
  return (
    <section id="value" className="border-t border-border py-20">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <p className="text-xs font-medium uppercase tracking-widest text-brand">Business value</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-4xl">
          From Photos to Decisions
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {outcomes.map((o) => (
            <div key={o.title} className="card-surface card-hover p-6">
              <span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand">
                <o.icon className="size-5" />
              </span>
              <h3 className="mt-4 text-base font-semibold tracking-tight">{o.title}</h3>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
