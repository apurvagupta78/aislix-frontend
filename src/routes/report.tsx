import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Download,
  Printer,
  Share2,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { detectedProducts, topBrands } from "@/lib/aislix-data";

export const Route = createFileRoute("/report")({
  head: () => ({
    meta: [
      { title: "PDF Audit Report — Aislix" },
      {
        name: "description",
        content: "Preview, download and share the PDF shelf audit report generated from your scan.",
      },
      { property: "og:title", content: "Shelf audit PDF report — Aislix" },
      { property: "og:description", content: "A shareable, print-ready retail shelf audit." },
    ],
  }),
  component: ReportViewer,
});

function ReportViewer() {
  return (
    <AppShell
      title="Audit report"
      description="AIS-RPT-10428 · MoreMart Superstore · Aisle 4 · Generated Aug 6, 2026"
      actions={
        <>
          <Button variant="subtle" size="sm" className="rounded-xl">
            <Share2 className="size-4" /> Share
          </Button>
          <Button variant="subtle" size="sm" className="rounded-xl">
            <Printer className="size-4" /> Print
          </Button>
          <Button variant="brand" size="sm" className="rounded-xl">
            <Download className="size-4" /> Download PDF
          </Button>
        </>
      }
    >
      <div className="grid gap-4 lg:grid-cols-4">
        <div className="card-surface order-2 h-fit p-5 lg:order-1">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Pages
          </p>
          <div className="mt-4 space-y-3">
            {["Summary", "Detections", "Compliance", "Actions"].map((p, i) => (
              <div
                key={p}
                className={`cursor-pointer rounded-xl border p-3 transition-colors ${
                  i === 0 ? "border-brand bg-brand-soft/50" : "border-border hover:border-brand/40"
                }`}
              >
                <div className="aspect-[3/4] rounded-lg border border-border bg-surface" />
                <p className="mt-2 text-xs font-medium">
                  {i + 1}. {p}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="order-1 lg:order-2 lg:col-span-3">
          <div className="card-surface overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border px-5 py-3">
              <Button variant="ghost" size="icon" className="rounded-lg">
                <ChevronLeft className="size-4" />
              </Button>
              <span className="text-xs text-muted-foreground">Page 1 of 4</span>
              <Button variant="ghost" size="icon" className="rounded-lg">
                <ChevronRight className="size-4" />
              </Button>
              <div className="ml-auto flex items-center gap-1">
                <Button variant="ghost" size="icon" className="rounded-lg">
                  <ZoomOut className="size-4" />
                </Button>
                <span className="text-xs text-muted-foreground">100%</span>
                <Button variant="ghost" size="icon" className="rounded-lg">
                  <ZoomIn className="size-4" />
                </Button>
              </div>
            </div>

            <div className="bg-surface p-6 sm:p-10">
              <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-card p-8 shadow-card sm:p-12">
                <div className="flex items-start justify-between border-b border-border pb-6">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-widest text-brand">
                      Aislix shelf audit
                    </p>
                    <h2 className="mt-2 text-xl font-semibold tracking-tight">
                      MoreMart Superstore — Aisle 4
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Beverages · Bengaluru, KA · Aug 6, 2026 11:42
                    </p>
                  </div>
                  <Badge className="rounded-full bg-accent-green/12 text-accent-green hover:bg-accent-green/12">
                    Health 92
                  </Badge>
                </div>

                <div className="mt-7 grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {[
                    { l: "Products", v: "218" },
                    { l: "Brands", v: "24" },
                    { l: "Confidence", v: "96.4%" },
                    { l: "Empty facings", v: "4" },
                  ].map((k) => (
                    <div key={k.l} className="rounded-xl border border-border bg-surface p-3">
                      <p className="text-lg font-semibold tracking-tight">{k.v}</p>
                      <p className="text-[0.7rem] text-muted-foreground">{k.l}</p>
                    </div>
                  ))}
                </div>

                <h3 className="mt-8 text-sm font-semibold tracking-tight">Executive summary</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Shelf condition in Aisle 4 is healthy at 92/100, up 6 points week-on-week. 218
                  facings were detected across 24 brands with 96.4% average model confidence. Four
                  empty facings were identified, concentrated on the middle shelf. Promo compliance
                  remains the weakest dimension at 65%, driven by a missing festive end-cap pack.
                </p>

                <h3 className="mt-7 text-sm font-semibold tracking-tight">Top brands by facings</h3>
                <div className="mt-3 space-y-2">
                  {topBrands.slice(0, 4).map((b) => (
                    <div key={b.brand} className="flex items-center gap-3">
                      <span className="w-24 text-xs text-muted-foreground">{b.brand}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-border">
                        <div
                          className="h-full rounded-full bg-gradient-brand"
                          style={{ width: `${b.share * 4}%` }}
                        />
                      </div>
                      <span className="w-10 text-right text-xs">{b.share}%</span>
                    </div>
                  ))}
                </div>

                <h3 className="mt-7 text-sm font-semibold tracking-tight">Priority SKUs</h3>
                <table className="mt-3 w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="pb-2 font-medium">SKU</th>
                      <th className="pb-2 text-right font-medium">Facings</th>
                      <th className="pb-2 text-right font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detectedProducts.slice(0, 5).map((p) => (
                      <tr key={p.name} className="border-b border-border/60">
                        <td className="py-2">{p.name}</td>
                        <td className="py-2 text-right">{p.facings}</td>
                        <td className="py-2 text-right text-muted-foreground">{p.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <p className="mt-8 border-t border-border pt-4 text-[0.7rem] text-muted-foreground">
                  Generated automatically by Aislix Retail Shelf Intelligence · Report
                  AIS-RPT-10428 · Page 1 of 4
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Button asChild variant="subtle" size="sm" className="rounded-xl">
              <Link to="/results">Back to results</Link>
            </Button>
            <Button asChild variant="brand" size="sm" className="rounded-xl">
              <Link to="/history">Scan history</Link>
            </Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
