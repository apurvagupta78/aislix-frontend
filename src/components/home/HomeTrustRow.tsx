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
      <div className="mx-auto max-w-6xl px-5 text-center sm:px-8">
        <h2 className="text-2xl font-normal leading-tight tracking-tight text-foreground sm:text-3xl">
          Built for modern retail teams
        </h2>
        <div className="mx-auto mt-7 grid max-w-5xl grid-cols-2 gap-7 sm:grid-cols-3 lg:grid-cols-5">
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
