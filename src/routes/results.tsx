import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, FileText, MapPin, Calendar, Gauge, AlertTriangle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { detectedProducts, topBrands } from "@/lib/aislix-data";

export const Route = createFileRoute("/results")({
  head: () => ({
    meta: [
      { title: "Scan Results — Aislix Shelf Audit" },
      {
        name: "description",
        content:
          "Detected products, brand share of shelf, out-of-stock gaps and planogram compliance for a single shelf scan.",
      },
      { property: "og:title", content: "Shelf scan results — Aislix" },
      { property: "og:description", content: "Full AI breakdown of a single shelf audit." },
    ],
  }),
  component: Results,
});

const summary = [
  { label: "Products detected", value: "218" },
  { label: "Brands detected", value: "24" },
  { label: "AI confidence", value: "96.4%" },
  { label: "Empty facings", value: "4" },
];

const boxes = [
  { top: "12%", left: "6%", w: "16%", h: "20%", label: "Amul Gold · 98%" },
  { top: "12%", left: "26%", w: "14%", h: "20%", label: "Britannia · 97%" },
  { top: "12%", left: "44%", w: "15%", h: "20%", label: "Parle-G · 95%" },
  { top: "42%", left: "8%", w: "18%", h: "22%", label: "Nescafé · 94%" },
  { top: "42%", left: "32%", w: "16%", h: "22%", label: "Coca-Cola · 92%" },
  { top: "42%", left: "54%", w: "14%", h: "22%", label: "Empty · OOS" },
  { top: "70%", left: "10%", w: "20%", h: "20%", label: "Dabur Honey · 92%" },
  { top: "70%", left: "38%", w: "18%", h: "20%", label: "Maggi · 91%" },
];

function Results() {
  return (
    <AppShell
      title="Scan SCN-10428"
      description="MoreMart Superstore · Aisle 4 · Beverages"
      actions={
        <>
          <Button asChild variant="subtle" size="sm" className="rounded-xl">
            <Link to="/history">All scans</Link>
          </Button>
          <Button asChild variant="brand" size="sm" className="rounded-xl">
            <Link to="/report">
              <FileText className="size-4" /> View PDF report
            </Link>
          </Button>
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <MapPin className="size-4 text-brand" /> Bengaluru, KA
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Calendar className="size-4 text-brand" /> Aug 6, 2026 · 11:42
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Gauge className="size-4 text-brand" /> Shelf health 92 / 100
        </span>
        <Badge className="rounded-full bg-brand-soft text-brand hover:bg-brand-soft">Completed</Badge>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summary.map((s) => (
          <div key={s.label} className="card-surface p-5">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <div className="card-surface p-6 lg:col-span-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-tight">Annotated shelf</h2>
            <Button variant="ghost" size="sm" className="rounded-xl">
              <Download className="size-4" /> Export image
            </Button>
          </div>
          <div className="relative mt-5 aspect-[4/3] overflow-hidden rounded-2xl border border-border bg-surface">
            <div className="absolute inset-0 grid-lines opacity-60" />
            {[24, 54, 84].map((t) => (
              <div
                key={t}
                className="absolute left-0 right-0 h-px bg-border"
                style={{ top: `${t}%` }}
              />
            ))}
            {boxes.map((b) => (
              <div
                key={b.label}
                className={`absolute rounded-lg border-2 ${
                  b.label.includes("Empty")
                    ? "border-destructive bg-destructive/10"
                    : "border-brand bg-brand/10"
                }`}
                style={{ top: b.top, left: b.left, width: b.w, height: b.h }}
              >
                <span
                  className={`absolute -top-2 left-1 rounded px-1.5 py-0.5 text-[0.6rem] font-medium ${
                    b.label.includes("Empty")
                      ? "bg-destructive text-brand-foreground"
                      : "bg-brand text-brand-foreground"
                  }`}
                >
                  {b.label}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            8 of 218 detections shown · green = identified SKU, red = empty facing
          </p>
        </div>

        <div className="space-y-4 lg:col-span-2">
          <div className="card-surface p-6">
            <h2 className="text-sm font-semibold tracking-tight">Planogram compliance</h2>
            <div className="mt-5 space-y-4">
              {[
                { l: "Correct placement", v: 92 },
                { l: "Facing count match", v: 86 },
                { l: "Sequence adherence", v: 78 },
                { l: "Promo compliance", v: 65 },
              ].map((r) => (
                <div key={r.l}>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{r.l}</span>
                    <span className="font-medium">{r.v}%</span>
                  </div>
                  <Progress value={r.v} className="mt-2 h-1.5 rounded-full" />
                </div>
              ))}
            </div>
          </div>

          <div className="card-surface p-6">
            <h2 className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight">
              <AlertTriangle className="size-4 text-warning" /> Action items
            </h2>
            <ul className="mt-4 space-y-3 text-sm">
              {[
                "Refill Maggi Masala 70g — 0 facings on middle shelf.",
                "Coca-Cola 750ml down to 3 facings, below 6-facing planogram.",
                "Parle-G Gold 1kg misplaced in Beverages row 2.",
                "Promo end-cap missing Britannia festive pack.",
              ].map((a) => (
                <li key={a} className="flex gap-2.5 text-muted-foreground">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand" />
                  {a}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="card-surface mt-4 p-6">
        <Tabs defaultValue="products">
          <TabsList className="rounded-xl">
            <TabsTrigger value="products" className="rounded-lg">Detected products</TabsTrigger>
            <TabsTrigger value="brands" className="rounded-lg">Brand breakdown</TabsTrigger>
          </TabsList>
          <TabsContent value="products" className="mt-5">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead className="text-right">Facings</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Confidence</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detectedProducts.map((p) => (
                  <TableRow key={p.name}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-muted-foreground">{p.brand}</TableCell>
                    <TableCell className="text-right">{p.facings}</TableCell>
                    <TableCell className="text-right">{p.price}</TableCell>
                    <TableCell className="text-right">{p.confidence}%</TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant="secondary"
                        className={`rounded-full ${
                          p.status === "In stock"
                            ? "bg-brand-soft text-brand hover:bg-brand-soft"
                            : p.status === "Low stock"
                              ? "bg-warning/15 text-warning hover:bg-warning/15"
                              : "bg-destructive/10 text-destructive hover:bg-destructive/10"
                        }`}
                      >
                        {p.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>
          <TabsContent value="brands" className="mt-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {topBrands.map((b) => (
                <div key={b.brand} className="rounded-2xl border border-border bg-surface p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{b.brand}</p>
                    <span className="text-sm text-brand">{b.share}%</span>
                  </div>
                  <Progress value={b.share * 4} className="mt-3 h-1.5 rounded-full" />
                  <p className="mt-2 text-xs text-muted-foreground">{b.facings} facings detected</p>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
