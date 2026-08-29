const items = [
  { title: "Product Detection", body: "Detect individual product facings on the shelf." },
  { title: "SKU Identification", body: "Match visible products to known SKUs when available." },
  { title: "Brand Recognition", body: "Identify brands present on the shelf." },
  { title: "Variant Recognition", body: "Distinguish variants where packaging differs." },
  { title: "Product Count", body: "Count facings per product for availability visibility." },
  { title: "Out-of-Stock Detection", body: "Surface empty facings and low-stock signals." },
  { title: "Shelf Position", body: "Understand where products appear on the shelf." },
  { title: "Planogram Compliance", body: "Compare shelf execution against an expected planogram." },
  { title: "Shelf Health", body: "Summarize overall shelf execution in one score." },
  { title: "Retail Execution", body: "Turn observations into actionable field intelligence." },
] as const;

export function CapabilitiesSection() {
  return (
    <section id="capabilities" className="border-t border-border bg-surface py-20">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <p className="text-xs font-medium uppercase tracking-widest text-brand">Capabilities</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-4xl">
          One Photo. Multiple Layers of Intelligence.
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((i) => (
            <div key={i.title} className="card-surface card-hover p-5">
              <h3 className="text-base font-semibold tracking-tight">{i.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{i.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
