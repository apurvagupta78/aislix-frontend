import { Badge } from "@/components/ui/badge";

const badges = ["PDF & CSV export", "Planogram compliance", "Learned SKU catalog"] as const;

export function TrustSection() {
  return (
    <section id="proof" className="border-t border-border bg-surface py-20">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <p className="text-xs font-medium uppercase tracking-widest text-brand">Inside the product</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-4xl">
          What You Get in Every Scan
        </h2>
        <div className="mt-6 flex flex-wrap gap-2">
          {badges.map((b) => (
            <Badge key={b} variant="secondary" className="rounded-lg px-3 py-1.5 text-sm">
              {b}
            </Badge>
          ))}
        </div>
        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          <figure className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
            <img
              src="/marketing/dashboard-preview.webp"
              alt="Aislix dashboard with shelf health score and recent scan activity"
              className="block h-auto w-full"
              loading="lazy"
              decoding="async"
            />
            <figcaption className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
              Shelf health, scan history and audit analytics in the Aislix workspace.
            </figcaption>
          </figure>
          <figure className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
            <img
              src="/landing/samples/lays-rack.jpg"
              alt="Retail snack shelf photo of the kind Aislix analyses"
              className="block h-auto w-full"
              loading="lazy"
              decoding="async"
              width={1280}
              height={960}
            />
            <figcaption className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
              A single shelf photo is all a field team needs to capture.
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
