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
    <section className="bg-background py-10">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <p className="text-center text-sm font-medium text-muted-foreground">
          Built for modern retail teams
        </p>
        <div className="mt-6 grid grid-cols-2 gap-7 sm:grid-cols-3 lg:grid-cols-5">
          {audiences.map(({ label, Icon }) => (
            <div key={label} className="flex flex-col items-center gap-2 text-center">
              <Icon
                className="size-9 fill-landing-navy text-landing-navy"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              <span className="text-xs font-medium text-foreground">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
