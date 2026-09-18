import { Building2, PackageSearch, ShoppingCart, Store, Warehouse } from "lucide-react";
import { SectionHeading } from "@/components/landing/retail-shelf-intelligence/shared";

const WORKFLOWS = [
  {
    modelClass: "border-[var(--aislix-local-border)] bg-[var(--aislix-local-bg)]",
    Icon: Store,
    title: "Local Stores",
    headline: "Turn every store visit into measurable execution.",
    body: "Track availability, assortment, facings, pricing and promotions without complicated retail systems.",
  },
  {
    modelClass: "border-[var(--aislix-supermarket-border)] bg-[var(--aislix-supermarket-bg)]",
    Icon: ShoppingCart,
    title: "Supermarkets",
    headline: "Know what's on the shelf — and what's not.",
    body: "Track availability, planogram compliance, assortment, pricing and promotions.",
  },
  {
    modelClass: "border-[var(--aislix-darkstore-border)] bg-[var(--aislix-darkstore-bg)]",
    Icon: Building2,
    title: "Dark Stores",
    headline: "Know if products are where they should be.",
    body: "Monitor availability, location accuracy, planogram compliance, assortment and facings.",
  },
  {
    modelClass: "border-[var(--aislix-warehouse-border)] bg-[var(--aislix-warehouse-bg)]",
    Icon: Warehouse,
    title: "Warehouses",
    headline: "Know whether inventory is accurate and in the right place.",
    body: "Audit receiving, bin accuracy, putaway, picking and dispatch without a separate warehouse tool.",
  },
  {
    modelClass: "border-[var(--aislix-fmcg-border)] bg-[var(--aislix-fmcg-bg)]",
    Icon: PackageSearch,
    title: "FMCG / Distributors",
    headline: "Know how the brand and outlet network are executing.",
    body: "Measure Share of Shelf, availability, facings, must-stock, planogram, pricing and promotions.",
  },
];

export function HomeRetailWorkflows() {
  return (
    <section id="workflows" className="home-section scroll-mt-16 bg-surface">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <SectionHeading
          eyebrow="ONE PLATFORM"
          title="Five Retail Workflows. One Source of Truth."
          subtitle="Every retail team sees the shelf differently. Aislix adapts the audit to what matters most for your role."
        />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {WORKFLOWS.map(({ Icon, title, headline, body, modelClass }) => (
            <div key={title} className={`card-hover rounded-lg border p-5 shadow-soft ${modelClass}`}>
              <Icon className="size-5 text-[var(--aislix-primary)]" strokeWidth={1.75} aria-hidden="true" />
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
