import { createFileRoute, Link } from "@tanstack/react-router";
import { UploadCloud, Image as ImageIcon, MapPin, Layers, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/upload")({
  head: () => ({
    meta: [
      { title: "Upload Shelf Scan — Aislix" },
      {
        name: "description",
        content: "Upload shelf photos and let Aislix detect products, brands and out-of-stocks automatically.",
      },
      { property: "og:title", content: "Upload a shelf scan — Aislix" },
      { property: "og:description", content: "Turn shelf photos into a full retail audit in seconds." },
    ],
  }),
  component: UploadScan,
});

function UploadScan() {
  return (
    <AppShell
      title="Upload scan"
      description="Add shelf photos and tag the store so Aislix can benchmark the aisle correctly."
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="card-surface p-6">
            <div className="group grid cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-border bg-surface px-6 py-16 text-center transition-colors hover:border-brand/50 hover:bg-brand-soft/40">
              <span className="grid size-14 place-items-center rounded-2xl bg-brand-soft text-brand transition-transform group-hover:scale-105">
                <UploadCloud className="size-6" />
              </span>
              <p className="mt-5 text-sm font-medium">Drop shelf images here, or click to browse</p>
              <p className="mt-1.5 text-xs text-muted-foreground">
                JPG, PNG or HEIC · up to 25 MB each · max 10 images per scan
              </p>
              <Button variant="brand" size="sm" className="mt-5 rounded-xl">
                Select images
              </Button>
            </div>

            <div className="mt-5 space-y-3">
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Queued images
              </p>
              {[
                { name: "aisle4-beverages-left.jpg", size: "4.2 MB" },
                { name: "aisle4-beverages-right.jpg", size: "3.8 MB" },
              ].map((f) => (
                <div
                  key={f.name}
                  className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3"
                >
                  <span className="grid size-9 place-items-center rounded-lg bg-brand-soft text-brand">
                    <ImageIcon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{f.name}</p>
                    <p className="text-xs text-muted-foreground">{f.size} · ready</p>
                  </div>
                  <Button variant="ghost" size="icon" className="rounded-lg">
                    <X className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="card-surface p-6">
            <h2 className="text-sm font-semibold tracking-tight">Scan details</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="store">Store</Label>
                <Select>
                  <SelectTrigger id="store" className="h-11 rounded-xl">
                    <SelectValue placeholder="Select store" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="moremart">MoreMart Superstore · Bengaluru</SelectItem>
                    <SelectItem value="freshpick">FreshPick Hypermarket · Pune</SelectItem>
                    <SelectItem value="metro">Metro Cash & Carry · Delhi NCR</SelectItem>
                    <SelectItem value="kirana">Sri Balaji Kirana · Hyderabad</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="aisle">Aisle / rack</Label>
                <Input id="aisle" placeholder="Aisle 4 · Beverages" className="h-11 rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select>
                  <SelectTrigger id="category" className="h-11 rounded-xl">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beverages">Beverages</SelectItem>
                    <SelectItem value="snacks">Snacks & Confectionery</SelectItem>
                    <SelectItem value="dairy">Dairy</SelectItem>
                    <SelectItem value="personal">Personal Care</SelectItem>
                    <SelectItem value="staples">Staples</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="planogram">Planogram version</Label>
                <Select>
                  <SelectTrigger id="planogram" className="h-11 rounded-xl">
                    <SelectValue placeholder="PG-2026-Q3" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="q3">PG-2026-Q3</SelectItem>
                    <SelectItem value="q2">PG-2026-Q2</SelectItem>
                    <SelectItem value="none">No planogram</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="notes">Notes for the auditor</Label>
                <Textarea
                  id="notes"
                  rows={3}
                  placeholder="Promo end-cap was moved to the front of the aisle."
                  className="rounded-xl"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card-surface p-6">
            <h2 className="text-sm font-semibold tracking-tight">Analysis options</h2>
            <div className="mt-5 space-y-4">
              {[
                { l: "Planogram compliance", d: "Compare against approved layout", on: true },
                { l: "Out-of-stock detection", d: "Flag empty facings by severity", on: true },
                { l: "Share of shelf", d: "Brand facings vs competitors", on: true },
                { l: "Price tag OCR", d: "Read MRP and promo tags", on: false },
                { l: "Auto PDF report", d: "Generate a shareable audit PDF", on: true },
              ].map((o) => (
                <div key={o.l} className="flex items-start gap-3">
                  <Switch defaultChecked={o.on} className="mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">{o.l}</p>
                    <p className="text-xs text-muted-foreground">{o.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card-surface p-6">
            <h2 className="text-sm font-semibold tracking-tight">Capture quality tips</h2>
            <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-2.5">
                <Layers className="mt-0.5 size-4 shrink-0 text-brand" /> Shoot the full shelf height
                in one frame.
              </li>
              <li className="flex gap-2.5">
                <ImageIcon className="mt-0.5 size-4 shrink-0 text-brand" /> Stand 1.5–2m back, avoid
                glare and blur.
              </li>
              <li className="flex gap-2.5">
                <MapPin className="mt-0.5 size-4 shrink-0 text-brand" /> Keep location enabled for
                store verification.
              </li>
            </ul>
          </div>

          <Button asChild variant="hero" size="xl" className="w-full">
            <Link to="/processing">Run AI analysis</Link>
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Uses 2 of your 716 remaining scans this month.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
