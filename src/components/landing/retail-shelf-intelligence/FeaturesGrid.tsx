import {
  AlertTriangle,
  BarChart3,
  Boxes,
  ClipboardCheck,
  Gauge,
  LayoutGrid,
  PackageX,
  ScanBarcode,
  Sparkles,
  Tags,
} from "lucide-react";
import { SectionHeading } from "./shared";

const FEATURES = [
  { Icon: Boxes, title: "Product Detection", body: "Identify every product on the shelf." },
  { Icon: ScanBarcode, title: "SKU Recognition", body: "Identify SKU and variant-level details." },
  { Icon: Tags, title: "Brand Recognition", body: "Understand exactly which brands are present." },
  { Icon: BarChart3, title: "Product Count", body: "Count products automatically." },
  { Icon: PackageX, title: "Out-of-Stock Detection", body: "Identify missing products." },
  { Icon: AlertTriangle, title: "Low Stock Alerts", body: "Identify low-stock risks." },
  { Icon: LayoutGrid, title: "Shelf Position", body: "Understand where products are placed." },
  {
    Icon: ClipboardCheck,
    title: "Planogram Compliance",
    body: "Detect shelf and planogram violations.",
  },
  { Icon: Gauge, title: "Shelf Health Score", body: "Get an overall shelf-performance score." },
  { Icon: Sparkles, title: "Retail Execution", body: "Turn shelf data into actionable execution." },
];

export function FeaturesGrid() {
  return (
    <section id="features" className="scroll-mt-16 bg-surface py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <SectionHeading eyebrow="Capabilities" title="One Photo. Multiple Layers of Intelligence." />

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {FEATURES.map(({ Icon, title, body }) => (
            <div
              key={title}
              className="rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-card"
            >
              <Icon className="size-5 text-primary" strokeWidth={1.7} />
              <h3 className="mt-3 text-sm font-semibold text-foreground">{title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
