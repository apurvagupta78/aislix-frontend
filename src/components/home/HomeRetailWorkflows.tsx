import { Building2, PackageSearch, ShoppingCart, Store, Truck } from "lucide-react";
import { SectionHeading } from "@/components/landing/retail-shelf-intelligence/shared";

const WORKFLOWS = [
  {
    Icon: ShoppingCart,
    title: "Supermarkets",
    headline: "Know what's on the shelf — and what's not.",
    body: "Track availability, planogram compliance, assortment, pricing and promotions.",
  },
  {
    Icon: Building2,
    title: "Dark Stores",
    headline: "Know if products are where they should be.",
    body: "Monitor availability, location accuracy, planogram compliance, assortment and facings.",
  },
  {
    Icon: PackageSearch,
    title: "FMCG Brands",
    headline: "Know how your brand is performing on the shelf.",
    body: "Measure Share of Shelf, availability, facings, planogram execution and promotional compliance.",
  },
  {
    Icon: Truck,
    title: "Distributors",
    headline: "Know whether every outlet is executing the range.",
    body: "Track availability, must-stock compliance, planogram, pricing and promotions.",
  },
  {
    Icon: Store,
    title: "Local Stores",
    headline: "Turn every store visit into measurable execution.",
    body: "Track availability, assortment, facings, pricing and promotions without complicated retail systems.",
  },
];

export function HomeRetailWorkflows() {
  return (
    <section id="workflows" className="scroll-mt-16 border-t border-border bg-surface py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <SectionHeading
          eyebrow="ONE PLATFORM"
          title="Five Retail Workflows. One Source of Truth."
          subtitle="Every retail team sees the shelf differently. Aislix adapts the audit to what matters most for your role."
        />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {WORKFLOWS.map(({ Icon, title, headline, body }) => (
            <div key={title} className="rounded-xl border border-border bg-card p-5 shadow-soft">
              <Icon className="size-5 text-brand" strokeWidth={1.75} aria-hidden="true" />
              <h3 className="mt-3 text-sm font-semibold text-foreground">{title}</h3>
              <p className="mt-2 text-xs font-medium leading-snug text-foreground/90">{headline}</p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
