import { Boxes, LayoutGrid, Store, Truck, Users } from "lucide-react";

const cases = [
  { icon: Store, title: "Retail Operations", body: "Monitor shelf execution across stores." },
  {
    icon: Boxes,
    title: "FMCG & Consumer Brands",
    body: "Understand how products are represented at retail.",
  },
  {
    icon: LayoutGrid,
    title: "Category Management",
    body: "Track assortment, availability and placement.",
  },
  { icon: Users, title: "Field Sales", body: "Turn store visits into structured intelligence." },
  { icon: Truck, title: "Merchandising", body: "Measure shelf and planogram compliance." },
] as const;

export function UseCasesSection() {
  return (
    <section id="use-cases" className="border-t border-border bg-surface py-20">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <p className="text-xs font-medium uppercase tracking-widest text-brand">Use cases</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-4xl">
          Built for Retail Teams
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cases.map((c) => (
            <div key={c.title} className="card-surface card-hover p-6">
              <span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand">
                <c.icon className="size-5" />
              </span>
              <h3 className="mt-4 text-base font-semibold tracking-tight">{c.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{c.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
