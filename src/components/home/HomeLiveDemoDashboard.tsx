import { ArrowRight, BadgeAlert, Box, PackageSearch, ScanLine } from "lucide-react";

import { Button } from "@/components/ui/button";

const SAMPLE_IMAGE =
  "https://aislix-backend-production.up.railway.app/landing/samples/shampoo-a1z/image";

const metrics = [
  { label: "Products detected", value: "31", Icon: ScanLine },
  { label: "Unique SKUs", value: "8", Icon: PackageSearch },
  { label: "Shelf health", value: "91%", Icon: Box },
  { label: "Out of stock", value: "4", Icon: BadgeAlert },
];

const inventory = [
  ["Head & Shoulders", "Cool Menthol Shampoo", "3", "92%", "Detected"],
  ["Dove", "Intense Repair Shampoo", "2", "88%", "Detected"],
  ["Tresemme", "Keratin Smooth Shampoo", "2", "85%", "Detected"],
  ["L'Oreal", "Hyaluron Moisture Shampoo", "1", "90%", "Detected"],
  ["Pantene", "Daily Moisture Renewal", "2", "87%", "Detected"],
  ["Unknown", "Unidentified facing", "1", "41%", "Needs review"],
];

export function HomeLiveDemoDashboard({ expanded }: { expanded: boolean }) {
  if (!expanded) return null;

  return (
    <section id="live-demo-dashboard" className="scroll-mt-20 border-y border-border bg-surface py-16">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="rounded-lg border border-border bg-card shadow-lift">
          <div className="border-b border-border bg-secondary px-5 py-3 text-sm font-medium text-primary sm:px-7">
            Live demo — sample dashboard with illustrative data
          </div>

          <div className="p-5 sm:p-7">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {metrics.map(({ label, value, Icon }) => (
                <div key={label} className="rounded-lg border border-border bg-background p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-medium text-muted-foreground">{label}</p>
                    <Icon className="size-4 text-primary" aria-hidden="true" />
                  </div>
                  <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
              <div className="overflow-hidden rounded-lg border border-border bg-background">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Annotated shelf</p>
                  <span className="rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground">
                    Demo data
                  </span>
                </div>
                <img
                  src={SAMPLE_IMAGE}
                  alt="Sample shampoo shelf used in the Aislix live dashboard demo"
                  className="aspect-[4/3] w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              </div>

              <div className="min-w-0">
                <h2 className="text-xl font-semibold text-foreground">Shelf audit results</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  This shelf audit detected 31 product facings across 8 unique SKUs. Shelf utilization
                  is 78% with average AI confidence of 89%.
                </p>

                <div className="mt-5 overflow-x-auto rounded-lg border border-border">
                  <table className="w-full min-w-[660px] text-left text-sm">
                    <thead className="bg-secondary text-xs text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 font-medium">Brand</th>
                        <th className="px-4 py-3 font-medium">Product</th>
                        <th className="px-4 py-3 font-medium">Qty.</th>
                        <th className="px-4 py-3 font-medium">Confidence</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {inventory.map(([brand, product, quantity, confidence, status]) => (
                        <tr key={`${brand}-${product}`}>
                          <td className="px-4 py-3 font-medium text-foreground">{brand}</td>
                          <td className="px-4 py-3 text-muted-foreground">{product}</td>
                          <td className="px-4 py-3 text-foreground">{quantity}</td>
                          <td className="px-4 py-3 text-foreground">{confidence}</td>
                          <td className="px-4 py-3">
                            <span
                              className={
                                status === "Detected"
                                  ? "font-medium text-primary"
                                  : "font-medium text-destructive"
                              }
                            >
                              {status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="mt-7 flex justify-center">
              <Button
                size="xl"
                onClick={() => document.querySelector("#lead")?.scrollIntoView({ behavior: "smooth" })}
              >
                Start scanning free <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}