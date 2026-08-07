import { createFileRoute } from "@tanstack/react-router";
import { Check, CreditCard, Download } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { invoices, plans } from "@/lib/aislix-data";

export const Route = createFileRoute("/billing")({
  head: () => ({
    meta: [
      { title: "Subscription & Billing — Aislix" },
      {
        name: "description",
        content: "Manage your Aislix plan, scan usage, payment method and download past invoices.",
      },
      { property: "og:title", content: "Subscription & billing — Aislix" },
      { property: "og:description", content: "Plans, usage and invoices for your Aislix workspace." },
    ],
  }),
  component: Billing,
});

function Billing() {
  return (
    <AppShell
      title="Subscription & billing"
      description="You're on the Growth plan, renewing Sep 1, 2026."
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card-surface p-6 lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Badge className="rounded-full bg-brand-soft text-brand hover:bg-brand-soft">
                Current plan
              </Badge>
              <h2 className="mt-3 text-xl font-semibold tracking-tight">Growth · ₹24,999 / month</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                2,000 shelf scans, 25 stores, 20 seats included.
              </p>
            </div>
            <Button variant="subtle" size="sm" className="rounded-xl">
              Cancel plan
            </Button>
          </div>

          <div className="mt-7 grid gap-5 sm:grid-cols-3">
            {[
              { l: "Scans used", v: "1,284 / 2,000", p: 64 },
              { l: "Stores connected", v: "42 / 25", p: 100 },
              { l: "Seats used", v: "14 / 20", p: 70 },
            ].map((u) => (
              <div key={u.l}>
                <p className="text-xs text-muted-foreground">{u.l}</p>
                <p className="mt-1 text-sm font-medium">{u.v}</p>
                <Progress value={u.p} className="mt-2 h-1.5 rounded-full" />
              </div>
            ))}
          </div>
          <p className="mt-5 rounded-xl bg-warning/10 px-4 py-3 text-xs text-warning">
            You've exceeded the store limit on Growth. Upgrade to Enterprise for unlimited stores.
          </p>
        </div>

        <div className="card-surface p-6">
          <h2 className="text-sm font-semibold tracking-tight">Payment method</h2>
          <div className="mt-5 flex items-center gap-3 rounded-xl border border-border bg-surface p-4">
            <span className="grid size-9 place-items-center rounded-lg bg-brand-soft text-brand">
              <CreditCard className="size-4" />
            </span>
            <div>
              <p className="text-sm font-medium">HDFC •••• 4218</p>
              <p className="text-xs text-muted-foreground">Expires 09 / 2029</p>
            </div>
          </div>
          <Button variant="subtle" size="sm" className="mt-4 w-full rounded-xl">
            Update payment method
          </Button>
          <div className="mt-6 space-y-1 border-t border-border pt-5 text-sm">
            <p className="text-muted-foreground">Billing contact</p>
            <p className="font-medium">accounts@moremart.in</p>
            <p className="text-muted-foreground">GSTIN 29ABCDE1234F1Z5</p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {plans.map((p) => (
          <div
            key={p.name}
            className={
              p.popular
                ? "rounded-3xl border-2 border-brand bg-card p-6 shadow-card"
                : "card-surface card-hover p-6"
            }
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">{p.name}</h3>
              {p.popular && (
                <Badge className="rounded-full bg-brand text-brand-foreground hover:bg-brand">
                  Current
                </Badge>
              )}
            </div>
            <p className="mt-2 text-2xl font-semibold tracking-tight">{p.price}</p>
            <p className="mt-1 text-sm text-brand">{p.scans}</p>
            <ul className="mt-5 space-y-2.5">
              {p.features.map((f) => (
                <li key={f} className="flex gap-2 text-sm text-muted-foreground">
                  <Check className="mt-0.5 size-4 shrink-0 text-brand" />
                  {f}
                </li>
              ))}
            </ul>
            <Button
              variant={p.popular ? "soft" : "brand"}
              className="mt-6 w-full rounded-xl"
              disabled={p.popular}
            >
              {p.popular ? "Current plan" : p.price === "Custom" ? "Contact sales" : "Switch plan"}
            </Button>
          </div>
        ))}
      </div>

      <div className="card-surface mt-4 p-6">
        <h2 className="text-sm font-semibold tracking-tight">Invoice history</h2>
        <Table className="mt-5">
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Status</TableHead>
              <TableHead className="text-right">PDF</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((i) => (
              <TableRow key={i.id}>
                <TableCell className="font-medium">{i.id}</TableCell>
                <TableCell className="text-muted-foreground">{i.date}</TableCell>
                <TableCell className="text-muted-foreground">{i.plan}</TableCell>
                <TableCell className="text-right">{i.amount}</TableCell>
                <TableCell className="text-right">
                  <Badge className="rounded-full bg-brand-soft text-brand hover:bg-brand-soft">
                    {i.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" className="rounded-lg">
                    <Download className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </AppShell>
  );
}
