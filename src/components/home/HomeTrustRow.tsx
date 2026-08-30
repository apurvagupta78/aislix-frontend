import { Building2, PackageSearch, ShoppingCart, Store, Truck } from "lucide-react";

const audiences = [
  { label: "Supermarkets", Icon: ShoppingCart },
  { label: "Dark Stores", Icon: Building2 },
  { label: "FMCG Brands", Icon: PackageSearch },
  { label: "Distributors", Icon: Truck },
  { label: "Local Stores", Icon: Store },
];

export function HomeTrustRow() {
  return (
    <section className="bg-background py-8">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <p className="text-center text-base font-medium text-muted-foreground sm:text-lg">
          Built for modern retail teams
        </p>
        <div className="mt-6 grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-5">
          {audiences.map(({ label, Icon }) => (
            <div key={label} className="flex flex-col items-center gap-2 text-center">
              <div className="flex size-6 shrink-0 items-center justify-center rounded-full border border-landing-navy text-landing-navy">
                <Icon className="size-3" strokeWidth={1.75} aria-hidden="true" />
              </div>
              <span className="text-sm font-medium text-foreground">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
