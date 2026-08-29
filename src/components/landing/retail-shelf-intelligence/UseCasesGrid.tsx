import { Boxes, LineChart, Store, Truck, Users } from "lucide-react";
import { SectionHeading } from "./shared";

const CASES = [
  {
    Icon: Store,
    title: "Retail Operations",
    body: "Monitor store execution and improve compliance.",
  },
  { Icon: Boxes, title: "FMCG & Brands", body: "Understand how your products perform on the shelf." },
  { Icon: Truck, title: "Field Sales", body: "Turn store visits into structured insights." },
  {
    Icon: LineChart,
    title: "Category Management",
    body: "Track assortment, availability and shelf performance.",
  },
  { Icon: Users, title: "Merchandising Teams", body: "Drive consistent shelf execution every day." },
];

export function UseCasesGrid() {
  return (
    <section id="use-cases" className="scroll-mt-16 bg-surface py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <SectionHeading eyebrow="Use cases" title="Built for Every Retail Team" />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {CASES.map(({ Icon, title, body }) => (
            <div key={title} className="rounded-xl border border-border bg-card p-5 shadow-soft">
              <Icon className="size-5 text-primary" strokeWidth={1.7} />
              <h3 className="mt-3 text-sm font-semibold text-foreground">{title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
