import { Check } from "lucide-react";

const bullets = [
  "Products detected with confidence",
  "Brand and SKU-level inventory",
  "Planogram compliance when configured",
  "Needs-review facings flagged for human verification",
] as const;

export function ProductVisualizationSection() {
  return (
    <section id="product-output" className="border-t border-border py-20">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 sm:px-8 lg:grid-cols-2">
        <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-lift">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <span className="size-2.5 rounded-full bg-muted" />
            <span className="size-2.5 rounded-full bg-muted" />
            <span className="size-2.5 rounded-full bg-muted" />
            <span className="ml-3 text-xs text-muted-foreground">aislix.com/results</span>
          </div>
          <img
            src="/marketing/dashboard-preview.webp"
            alt="Aislix scan results with detected products, inventory table and shelf metrics"
            className="block h-auto w-full"
            loading="lazy"
            decoding="async"
          />
        </div>

        <div>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-4xl">
            This is not just image recognition.
          </h2>
          <p className="mt-3 text-base text-muted-foreground">
            This converts shelf images into business intelligence.
          </p>
          <ul className="mt-7 space-y-3">
            {bullets.map((b) => (
              <li key={b} className="flex items-start gap-3 text-sm text-foreground">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
                  <Check className="size-3.5" />
                </span>
                {b}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
