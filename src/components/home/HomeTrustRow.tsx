import { Building2, PackageSearch, ShoppingCart, Store, Warehouse } from "lucide-react";

const audiences = [
  {
    modelClass: "border-[var(--aislix-local-border)] bg-[var(--aislix-local-bg)]",
    label: "Local Stores",
    Icon: Store,
    body: "Turn everyday store visits into measurable shelf execution.",
  },
  {
    modelClass: "border-[var(--aislix-supermarket-border)] bg-[var(--aislix-supermarket-bg)]",
    label: "Supermarkets",
    Icon: ShoppingCart,
    body: "Improve availability, assortment, pricing, promotions and shelf execution.",
  },
  {
    modelClass: "border-[var(--aislix-darkstore-border)] bg-[var(--aislix-darkstore-bg)]",
    label: "Dark Stores",
    Icon: Building2,
    body: "Know what is available and whether products are in the right location.",
  },
  {
    modelClass: "border-[var(--aislix-warehouse-border)] bg-[var(--aislix-warehouse-bg)]",
    label: "Warehouses",
    Icon: Warehouse,
    body: "Verify receiving, bin accuracy, putaway, picking and dispatch.",
  },
  {
    modelClass: "border-[var(--aislix-fmcg-border)] bg-[var(--aislix-fmcg-bg)]",
    label: "FMCG / Distributors",
    Icon: PackageSearch,
    body: "Measure shelf presence, outlet execution, pricing and Share of Shelf.",
  },
];

export function HomeTrustRow() {
  return (
    <section className="border-b border-border bg-background py-12 sm:py-14">
      <div className="mx-auto max-w-6xl px-5 text-center sm:px-8">
        <h2 className="text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-3xl">
          Built for Every Retail Shelf.
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          One platform for retailers, brands, distributors and store teams.
        </p>
        <div className="mx-auto mt-8 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {audiences.map(({ label, Icon, body, modelClass }) => (
            <div
              key={label}
              className={`flex flex-col items-center rounded-xl border p-5 text-center shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card ${modelClass}`}
            >
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-[var(--aislix-border)] bg-white/80 text-[var(--aislix-primary)]">
                <Icon className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
              </div>
              <h3 className="mt-3 text-sm font-semibold text-foreground">{label}</h3>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
