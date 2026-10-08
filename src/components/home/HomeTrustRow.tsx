import { Building2, PackageSearch, ShoppingCart, Store, Warehouse } from "lucide-react";

const audiences = [
  {
    dot: "#7DB7D6",
    label: "Local stores",
    Icon: Store,
    body: "Turn everyday store visits into measurable shelf execution.",
  },
  {
    dot: "#79E2A8",
    label: "Supermarkets",
    Icon: ShoppingCart,
    body: "Improve availability, assortment, pricing, promotions and shelf execution.",
  },
  {
    dot: "#ECBDCC",
    label: "Dark stores",
    Icon: Building2,
    body: "Know what is available and whether products are in the right location.",
  },
  {
    dot: "#8EC9E8",
    label: "Warehouses",
    Icon: Warehouse,
    body: "Verify receiving, bin accuracy, putaway, picking and dispatch.",
  },
  {
    dot: "#9B86D9",
    label: "FMCG / Distributors",
    Icon: PackageSearch,
    body: "Measure shelf presence, outlet execution, pricing and Share of Shelf.",
  },
];

export function HomeTrustRow() {
  return (
    <section className="border-b border-border bg-card py-14 sm:py-16">
      <div className="mx-auto max-w-6xl px-5 text-center sm:px-8">
        <p className="home-kicker">Built for retail leaders</p>
        <h2 className="mt-3 text-2xl font-semibold leading-tight text-foreground sm:text-4xl">
          One view of execution across every retail format.
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          One platform for retailers, brands, distributors and store teams.
        </p>
        <div className="mx-auto mt-8 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {audiences.map(({ label, Icon, body, dot }) => (
            <div
              key={label}
              className="card-hover flex flex-col items-center rounded-lg border border-border bg-white p-5 text-center"
            >
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-[var(--aislix-primary)]">
                <Icon className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
              </div>
              <h3 className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <span className="size-1.5 shrink-0 rounded-full" style={{ background: dot }} aria-hidden="true" />
                {label}
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
