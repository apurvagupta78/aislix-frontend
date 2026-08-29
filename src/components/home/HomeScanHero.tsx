import {
  ArrowRight,
  Building2,
  Check,
  PackageSearch,
  ShoppingCart,
  Store,
  Truck,
} from "lucide-react";

import { Button } from "@/components/ui/button";

const SAMPLE_IMAGE =
  "https://aislix-backend-production.up.railway.app/landing/samples/shampoo-a1z/image";

const audiences = [
  { label: "Supermarkets", Icon: ShoppingCart },
  { label: "Dark Stores", Icon: Building2 },
  { label: "FMCG Brands", Icon: PackageSearch },
  { label: "Distributors", Icon: Truck },
  { label: "Local Stores", Icon: Store },
];

export function HomeScanHero({ onLiveDemo }: { onLiveDemo: () => void }) {
  return (
    <section id="start-scanning" className="scroll-mt-20 border-t border-border bg-background py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <span className="inline-flex items-center rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium text-muted-foreground shadow-soft">
              AI-Powered Retail Shelf Intelligence
            </span>
            <h2 className="mt-6 text-4xl font-semibold leading-[1.08] text-foreground sm:text-5xl">
              Audit Every Aisle.
              <br />
              From a Single Photo.
            </h2>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Aislix turns a single shelf photo into a complete retail audit — products detected,
              brands counted, out-of-stocks flagged and shelf health scored.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button
                size="xl"
                className="w-full sm:w-auto"
                onClick={() => document.querySelector("#lead")?.scrollIntoView({ behavior: "smooth" })}
              >
                Start scanning free <ArrowRight className="size-4" />
              </Button>
              <Button size="xl" variant="outline" className="w-full sm:w-auto" onClick={onLiveDemo}>
                Live demo
              </Button>
            </div>
            <div className="mt-6 flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-x-5">
              {["No card required", "3 free scans per day", "Results in seconds"].map((item) => (
                <span key={item} className="flex items-center gap-1.5">
                  <Check className="size-4 text-primary" aria-hidden="true" />
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-lift">
            <div className="grid md:grid-cols-2">
              <div className="border-b border-border p-4 md:border-b-0 md:border-r">
                <p className="mb-3 text-xs font-semibold uppercase text-muted-foreground">Shelf photo</p>
                <img
                  src={SAMPLE_IMAGE}
                  alt="Shampoo products displayed on a retail shelf"
                  className="aspect-[4/3] w-full rounded-lg object-cover"
                  decoding="async"
                />
              </div>
              <div className="p-5 sm:p-6">
                <p className="text-xs font-semibold uppercase text-muted-foreground">AI analysis</p>
                <div className="mt-5 grid grid-cols-3 gap-2">
                  {[
                    ["8", "Products"],
                    ["4", "Out of stock"],
                    ["91%", "Shelf health"],
                  ].map(([value, label]) => (
                    <div key={label} className="rounded-lg bg-secondary p-3 text-center">
                      <p className="text-xl font-semibold text-foreground">{value}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-6 text-xs font-semibold uppercase text-primary">Top issues detected</p>
                <ul className="mt-3 space-y-2 text-sm text-foreground">
                  {["Out of stock", "Wrong placement", "Low stock", "Planogram break"].map(
                    (issue) => (
                      <li key={issue} className="flex items-center gap-2">
                        <span className="size-1.5 rounded-full bg-primary" />
                        {issue}
                      </li>
                    ),
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-14 border-t border-border pt-8">
          <p className="text-center text-sm font-medium text-muted-foreground">
            Built for modern retail teams
          </p>
          <div className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
            {audiences.map(({ label, Icon }) => (
              <div key={label} className="flex flex-col items-center gap-2 text-center">
                <Icon className="size-6 text-primary" strokeWidth={2} aria-hidden="true" />
                <span className="text-xs font-medium text-foreground">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}