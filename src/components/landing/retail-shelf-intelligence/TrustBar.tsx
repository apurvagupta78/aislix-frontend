import { Building2, PackageSearch, ShoppingCart, Store, Truck } from "lucide-react";

const ITEMS = [
  { label: "Supermarkets", Icon: ShoppingCart },
  { label: "Dark Stores", Icon: Building2 },
  { label: "FMCG Brands", Icon: PackageSearch },
  { label: "Distributors", Icon: Truck },
  { label: "Local Stores", Icon: Store },
];

export function TrustBar() {
  return (
    <section className="border-b border-border bg-background py-10">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <h2 className="text-center text-sm font-medium text-muted-foreground">
          Built for modern retail teams
        </h2>
        <div className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
          {ITEMS.map(({ label, Icon }) => (
            <div key={label} className="flex flex-col items-center gap-2 text-center">
              <Icon className="size-6 text-brand" strokeWidth={1.6} />
              <span className="text-xs font-medium text-foreground">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
