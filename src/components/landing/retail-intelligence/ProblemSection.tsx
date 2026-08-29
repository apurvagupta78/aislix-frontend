import { Clock, EyeOff, ScanSearch, ShuffleIcon } from "lucide-react";

const cards = [
  {
    icon: ScanSearch,
    title: "Manual Shelf Audits",
    body: "Teams spend hours collecting and reviewing shelf photos.",
  },
  {
    icon: Clock,
    title: "Delayed Visibility",
    body: "Managers often receive shelf information after the situation has already changed.",
  },
  {
    icon: ShuffleIcon,
    title: "Inconsistent Execution",
    body: "Different store visits can produce inconsistent reporting and visibility.",
  },
  {
    icon: EyeOff,
    title: "Hidden Retail Gaps",
    body: "Out-of-stock products, poor placement and execution issues can remain invisible.",
  },
] as const;

export function ProblemSection() {
  return (
    <section id="problem" className="border-t border-border bg-surface py-20">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <p className="text-xs font-medium uppercase tracking-widest text-brand">The problem</p>
        <h2 className="mt-3 max-w-2xl text-2xl font-semibold tracking-tight sm:text-4xl">
          Retail Teams Can't Fix What They Can't See
        </h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {cards.map((c) => (
            <div key={c.title} className="card-surface card-hover p-6">
              <span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand">
                <c.icon className="size-5" />
              </span>
              <h3 className="mt-4 text-lg font-semibold tracking-tight">{c.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
