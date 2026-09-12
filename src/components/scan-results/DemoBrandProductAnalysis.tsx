/**
 * Brand & product share analysis for demo oral-care shelf audits.
 */

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { formatCompetitorBrandLabel } from "@/lib/brand-intel";
import { DEMO_PLANOGRAM_LABEL, isDemoOralCareResult } from "@/lib/demo-oral-care-planogram";
import type { ScanResult } from "@/lib/scan-results";
import { cn } from "@/lib/utils";

const BRAND_COLORS = [
  "bg-brand",
  "bg-brand-muted",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-sky-500",
  "bg-violet-500",
  "bg-rose-400",
  "bg-slate-400",
];

function DonutChart({
  segments,
  centerLabel,
  centerValue,
}: {
  segments: { label: string; value: number; color: string }[];
  centerLabel: string;
  centerValue: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  let cumulative = 0;
  const gradient = segments
    .map((seg) => {
      const start = (cumulative / total) * 100;
      cumulative += seg.value;
      const end = (cumulative / total) * 100;
      return `${seg.color} ${start}% ${end}%`;
    })
    .join(", ");

  return (
    <div className="relative mx-auto size-36 sm:size-40">
      <div
        className="size-full rounded-full shadow-inner"
        style={{ background: `conic-gradient(${gradient})` }}
      />
      <div className="absolute inset-[18%] flex flex-col items-center justify-center rounded-full bg-card text-center shadow-sm">
        <span className="text-[0.6rem] uppercase tracking-wider text-muted-foreground">
          {centerLabel}
        </span>
        <span className="text-lg font-bold tabular-nums text-brand">{centerValue}</span>
      </div>
    </div>
  );
}

export function DemoBrandProductAnalysis({
  data,
  loading,
}: {
  data?: ScanResult;
  loading?: boolean;
}) {
  const snapshot = data?.competitor_intel;
  const inventory = data?.inventory ?? [];

  const productRows = useMemo(() => {
    const map = new Map<string, { brand: string; product: string; qty: number }>();
    for (const item of inventory) {
      const brand = String(item.brand ?? "Unknown");
      const product = String(item.name ?? item.product ?? "Product");
      const key = `${brand}::${product}`;
      const prev = map.get(key);
      map.set(key, {
        brand,
        product,
        qty: (prev?.qty ?? 0) + (item.quantity ?? item.facings ?? 1),
      });
    }
    return [...map.values()].sort((a, b) => b.qty - a.qty).slice(0, 12);
  }, [inventory]);

  const brandBars = snapshot?.competitor_shares ?? [];
  const maxShare = Math.max(1, ...brandBars.map((b) => b.share ?? 0));

  if (loading) {
    return (
      <section className="card-surface animate-pulse p-6">
        <div className="h-6 w-48 rounded bg-muted" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="h-40 rounded-xl bg-muted" />
          <div className="h-40 rounded-xl bg-muted" />
        </div>
      </section>
    );
  }

  if (!snapshot?.primary_brand && productRows.length === 0) return null;

  const isDemo = isDemoOralCareResult(data);
  const primaryBrand = snapshot?.primary_brand ?? productRows[0]?.brand ?? "Leading brand";
  const ownShare =
    snapshot?.own_brand_share_percent ??
    brandBars.find((b) => b.is_primary)?.share ??
    brandBars[0]?.share ??
    0;

  const donutSource =
    brandBars.length > 0
      ? brandBars
      : productRows.map((row) => ({
          brand: row.brand,
          share: row.qty,
          is_primary: row.brand === primaryBrand,
        }));

  const donutSegments = donutSource.slice(0, 7).map((row, i) => ({
    label: row.brand,
    value: Math.max(row.share ?? 0, row.is_primary ? 0.1 : 0.05),
    color: row.is_primary ? "hsl(var(--brand))" : `var(--chart-${(i % 6) + 1}, #94a3b8)`,
  }));

  return (
    <section className="card-surface overflow-hidden p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Competitor brand &amp; product analysis</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {isDemo
              ? "Share of facings and product mix on this shelf photograph — compared to demo plan targets."
              : "Share of facings and product mix detected on this shelf photograph — no planogram required."}
          </p>
        </div>
        {isDemo ? (
          <Badge variant="outline" className="text-[10px]">
            {DEMO_PLANOGRAM_LABEL}
          </Badge>
        ) : null}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface/80 p-4">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Brand share of shelf
          </p>
          <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <DonutChart
              segments={donutSegments.map((s, i) => ({
                ...s,
                color: donutSource[i]?.is_primary
                  ? "hsl(220 90% 56%)"
                  : ["#0ea5e9", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#64748b"][i % 6],
              }))}
              centerLabel={primaryBrand}
              centerValue={`${ownShare.toFixed(0)}%`}
            />
            <ul className="w-full flex-1 space-y-2">
              {donutSource.slice(0, 8).map((row, i) => (
                <li key={row.brand} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span
                      className={cn(
                        "font-medium",
                        row.is_primary ? "text-brand" : "text-foreground",
                      )}
                    >
                      {formatCompetitorBrandLabel(row.brand, row.different_category)}
                      {row.is_primary ? " (target brand)" : ""}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {(row.share ?? 0).toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        row.is_primary ? "bg-brand" : BRAND_COLORS[(i + 1) % BRAND_COLORS.length],
                      )}
                      style={{ width: `${((row.share ?? 0) / maxShare) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
          {isDemo && snapshot && snapshot.own_brand_share_percent > 55 ? (
            <p className="mt-3 rounded-lg border border-amber-200/80 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
              {snapshot.primary_brand} observed ~{snapshot.own_brand_share_percent.toFixed(0)}% vs planned
              55% target — above planned share of shelf.
            </p>
          ) : null}
        </div>

        <div className="rounded-xl border border-border bg-surface/80 p-4">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Product mix (detected)
          </p>
          <div className="mt-4 max-h-64 space-y-2 overflow-y-auto pr-1">
            {productRows.map((row) => {
              const maxQty = productRows[0]?.qty ?? 1;
              return (
                <div key={`${row.brand}-${row.product}`} className="space-y-1">
                  <div className="flex justify-between gap-2 text-xs">
                    <span className="truncate font-medium text-foreground">
                      {row.brand}{" "}
                      <span className="font-normal text-muted-foreground">{row.product}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {row.qty} facings
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-brand-muted"
                      style={{ width: `${(row.qty / maxQty) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {snapshot?.upper_hand?.length ? (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand">Insights</p>
          {snapshot.upper_hand.map((edge) => (
            <div
              key={edge.brand}
              className="rounded-lg border border-brand/15 bg-brand-soft/25 px-3 py-2 text-xs text-muted-foreground"
            >
              {edge.note}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
