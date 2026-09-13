import { Badge } from "@/components/ui/badge";
import type { KpiMetric } from "@/lib/execution-metrics";
import {
  buildAssortmentRows,
  buildFacingSkuRows,
  buildKpiDetailsContext,
  buildLocationCells,
  buildMslRows,
  buildOsaEvidence,
  buildPlanogramCells,
  buildPriceRows,
  buildPromoChecks,
  shelvesFromCells,
  type KpiDetailsContext,
  type PositionStatus,
  type ShelfPositionCell,
} from "@/lib/kpi-details-data";
import { scoringFromResult } from "@/lib/kpi-results-display";
import type { ScoringTargets } from "@/lib/planogram-audit-package";
import type { AuditKpiId } from "@/lib/role-kpi-config";
import type { ScanResult } from "@/lib/scan-results";
import { cn } from "@/lib/utils";
import { formatCoverage } from "@/components/scan-results/kpi-details/KpiDetailCard";

const KPI_TARGET_KEY: Partial<Record<AuditKpiId, keyof ScoringTargets>> = {
  osa: "osa_target",
  planogram_compliance: "planogram_target",
  assortment_compliance: "assortment_target",
  price_compliance: "price_target",
  promotional_compliance: "promotional_target",
  msl_compliance: "msl_target",
  share_of_shelf: "share_of_shelf_target",
};

function targetPercent(result: ScanResult, kpiId: AuditKpiId): number | null {
  const key = KPI_TARGET_KEY[kpiId];
  if (!key) return null;
  const raw = scoringFromResult(result)[key];
  return raw != null && Number.isFinite(Number(raw)) ? Number(raw) : null;
}

function clampPct(n: number): number {
  return Math.max(0, Math.min(100, n));
}

function StatusLegend({ mode }: { mode: "location" | "planogram" }) {
  const items =
    mode === "location"
      ? [
          { label: "Correct", className: "bg-emerald-500/20 border-emerald-500/40" },
          { label: "Needs review", className: "bg-amber-500/20 border-amber-500/40" },
          { label: "Incorrect", className: "bg-destructive/15 border-destructive/40" },
        ]
      : [
          { label: "Match", className: "bg-emerald-500/20 border-emerald-500/40" },
          { label: "Needs review", className: "bg-amber-500/20 border-amber-500/40" },
          { label: "Mismatch", className: "bg-destructive/15 border-destructive/40" },
        ];
  return (
    <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground">
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          <span className={cn("size-2.5 rounded-sm border", item.className)} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

function cellColor(status: PositionStatus): string {
  if (status === "correct") return "bg-emerald-500/20 border-emerald-500/35 text-emerald-900 dark:text-emerald-200";
  if (status === "incorrect") return "bg-destructive/12 border-destructive/35 text-destructive";
  return "bg-amber-500/15 border-amber-500/35 text-amber-900 dark:text-amber-200";
}

function ShelfHeatmap({
  cells,
  mode,
}: {
  cells: ShelfPositionCell[];
  mode: "location" | "planogram";
}) {
  const shelves = shelvesFromCells(cells);
  if (!cells.length) {
    return <p className="text-xs text-muted-foreground">No shelf positions configured for this audit.</p>;
  }
  return (
    <div className="space-y-3">
      {shelves.map((shelf) => {
        const shelfCells = cells.filter((c) => c.shelf === shelf);
        return (
          <div key={shelf}>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Shelf {shelf}
            </p>
            <div className="flex flex-wrap gap-1">
              {shelfCells.map((cell) => (
                <div
                  key={cell.position_id}
                  className={cn(
                    "flex min-w-[2.75rem] flex-col items-center rounded border px-1 py-1 text-[9px] leading-tight",
                    cellColor(cell.status),
                  )}
                  title={`${cell.expected_label} · ${cell.detail ?? cell.observed_label}`}
                >
                  <span className="font-semibold">{cell.slot || cell.position_id}</span>
                  <span className="mt-0.5 max-w-[3rem] truncate opacity-80">
                    {cell.expected_label.split(" ")[0]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      <StatusLegend mode={mode} />
    </div>
  );
}

function BulletProgress({
  percent,
  target,
  label,
}: {
  percent: number;
  target: number | null;
  label?: string;
}) {
  const pct = clampPct(percent);
  return (
    <div className="space-y-2">
      <p className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">{label ?? `${Math.round(pct)}%`}</p>
      <div className="relative h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
        {target != null ? (
          <div
            className="absolute inset-y-0 w-0.5 bg-foreground/40"
            style={{ left: `${clampPct(target)}%` }}
            title={`Target ${Math.round(target)}%`}
          />
        ) : null}
      </div>
      <p className="text-[10px] text-muted-foreground">
        Actual {Math.round(pct)}%
        {target != null ? ` · Target ${Math.round(target)}%` : " · Target not configured"}
      </p>
    </div>
  );
}

export function OsaDetailVisual({ ctx, metric }: { ctx: KpiDetailsContext; metric?: KpiMetric }) {
  const evidence = buildOsaEvidence(ctx);
  const pct = metric?.numeric ?? (evidence.assessed ? (evidence.available / evidence.assessed) * 100 : 0);
  const target = targetPercent(ctx.result, "osa");
  const coverage = formatCoverage(metric);
  return (
    <div className="space-y-3">
      <BulletProgress percent={pct} target={target} />
      <p className="text-sm font-medium tabular-nums text-foreground">
        {evidence.available} / {evidence.assessed} SKUs available
      </p>
      {coverage ? <p className="text-[10px] text-muted-foreground">{coverage}</p> : null}
    </div>
  );
}

export function LocationDetailVisual({ ctx }: { ctx: KpiDetailsContext; metric?: KpiMetric }) {
  const cells = buildLocationCells(ctx);
  return <ShelfHeatmap cells={cells} mode="location" />;
}

export function PlanogramDetailVisual({ ctx }: { ctx: KpiDetailsContext; metric?: KpiMetric }) {
  const cells = buildPlanogramCells(ctx);
  return <ShelfHeatmap cells={cells} mode="planogram" />;
}

export function AssortmentDetailVisual({
  ctx,
  kpiId,
}: {
  ctx: KpiDetailsContext;
  metric?: KpiMetric;
  kpiId: "assortment_compliance" | "msl_compliance";
}) {
  const rows = kpiId === "msl_compliance" ? buildMslRows(ctx) : buildAssortmentRows(ctx);
  const present = rows.filter((r) => r.present).length;
  const total = rows.length;
  const missing = rows.filter((r) => !r.present);
  const pct = total ? (present / total) * 100 : 0;

  return (
    <div className="space-y-2.5">
      <div className="flex gap-4 text-[11px]">
        <span>
          <span className="font-semibold text-emerald-700 dark:text-emerald-300">{present}</span> Present
        </span>
        <span>
          <span className="font-semibold text-destructive">{missing.length}</span> Missing
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-brand" style={{ width: `${clampPct(pct)}%` }} />
      </div>
      <p className="text-[10px] text-muted-foreground">
        {present} / {total} = {Math.round(pct)}%
      </p>
      {missing.length > 0 ? (
        <ul className="space-y-1 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-[10px]">
          {missing.map((r) => (
            <li key={r.sku} className="text-destructive">
              {r.brand} {r.product_name} ({r.sku})
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[10px] text-muted-foreground">All required products are present.</p>
      )}
    </div>
  );
}

export function FacingDetailVisual({ ctx, metric }: { ctx: KpiDetailsContext; metric?: KpiMetric }) {
  const brand = ctx.role === "fmcg" ? ctx.auditPackage.primary_brand : undefined;
  const rows = buildFacingSkuRows(ctx, brand);
  const max = Math.max(1, ...rows.map((r) => Math.max(r.actual, r.planned)));

  return (
    <div className="space-y-2.5">
      {rows.map((row) => (
        <div key={row.sku} className="space-y-1">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span className="truncate pr-2 font-medium text-foreground">
              {row.brand} {row.product_name}
            </span>
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="w-10 shrink-0 text-[9px] text-muted-foreground">Actual</span>
              <div className="h-1.5 flex-1 rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-brand"
                  style={{ width: `${(row.actual / max) * 100}%` }}
                />
              </div>
              <span className="w-6 shrink-0 text-right text-[9px] tabular-nums">{row.actual}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-10 shrink-0 text-[9px] text-muted-foreground">Planned</span>
              <div className="h-1.5 flex-1 rounded-full bg-muted/70">
                <div
                  className="h-full rounded-full bg-brand/40"
                  style={{ width: `${(row.planned / max) * 100}%` }}
                />
              </div>
              <span className="w-6 shrink-0 text-right text-[9px] tabular-nums">{row.planned}</span>
            </div>
          </div>
        </div>
      ))}
      {!rows.length ? (
        <p className="text-[10px] text-muted-foreground">No facing data for this audit.</p>
      ) : null}
    </div>
  );
}

export function ShareOfShelfDetailVisual({ ctx, metric }: { ctx: KpiDetailsContext; metric?: KpiMetric }) {
  const brands = ctx.result.charts?.top_brands ?? [];
  const primary = ctx.auditPackage.primary_brand ?? brands[0]?.brand ?? "Your brand";
  const primaryShare =
    metric?.numeric ??
    brands.find((b) => b.brand.toLowerCase() === primary.toLowerCase())?.share ??
    brands[0]?.share ??
    0;
  const other = Math.max(0, 100 - primaryShare);
  const planned = targetPercent(ctx.result, "share_of_shelf");
  const coverage = formatCoverage(metric);

  return (
    <div className="space-y-3">
      <p className="text-2xl font-semibold tabular-nums">{Math.round(primaryShare)}%</p>
      <div className="flex h-3 overflow-hidden rounded-full bg-muted">
        <div className="bg-brand" style={{ width: `${clampPct(primaryShare)}%` }} />
        <div className="bg-brand/20" style={{ width: `${clampPct(other)}%` }} />
      </div>
      <div className="flex flex-wrap gap-x-4 text-[10px] text-muted-foreground">
        <span>
          <span className="font-medium text-foreground">{primary}</span> {Math.round(primaryShare)}%
        </span>
        <span>Other brands {Math.round(other)}%</span>
      </div>
      {planned != null ? (
        <div className="space-y-1">
          <p className="text-[10px] text-muted-foreground">Planned vs actual shelf share</p>
          <div className="flex h-1.5 overflow-hidden rounded-full bg-muted/80">
            <div className="bg-brand/45" style={{ width: `${clampPct(planned)}%` }} title={`Planned ${planned}%`} />
            <div
              className="bg-brand"
              style={{ width: `${clampPct(primaryShare)}%`, opacity: 0.7 }}
              title={`Actual ${primaryShare}%`}
            />
          </div>
          <p className="text-[10px] text-muted-foreground">
            Planned {Math.round(planned)}% · Actual {Math.round(primaryShare)}%
          </p>
        </div>
      ) : null}
      {coverage ? <p className="text-[10px] text-muted-foreground">{coverage}</p> : null}
    </div>
  );
}

export function PriceDetailVisual({ ctx, metric }: { ctx: KpiDetailsContext; metric?: KpiMetric }) {
  const rows = buildPriceRows(ctx).slice(0, 8);
  const coverage = formatCoverage(metric);
  if (!rows.length) {
    return <p className="text-xs text-muted-foreground">Price requirements not configured.</p>;
  }
  return (
    <div className="space-y-2">
      <p className="text-2xl font-semibold tabular-nums">{metric?.value ?? "—"}</p>
      <div className="overflow-x-auto rounded-md border border-border/60">
        <table className="w-full min-w-[16rem] text-left text-[10px]">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-muted-foreground">
              <th className="px-2 py-1.5 font-medium">SKU</th>
              <th className="px-2 py-1.5 font-medium text-right">Expected</th>
              <th className="px-2 py-1.5 font-medium text-right">Observed</th>
              <th className="px-2 py-1.5 font-medium text-right">Diff</th>
              <th className="px-2 py-1.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.sku}
                className={cn(
                  "border-b border-border/50 last:border-0",
                  r.status === "Mismatch" && "bg-destructive/5",
                )}
              >
                <td className="max-w-[6rem] truncate px-2 py-1.5">{r.product}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">${r.expected_price.toFixed(2)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">${r.observed_price.toFixed(2)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {r.difference >= 0 ? "+" : ""}
                  {r.difference.toFixed(2)}
                </td>
                <td className="px-2 py-1.5">
                  <Badge
                    variant="secondary"
                    className={cn(
                      "h-4 px-1 text-[9px]",
                      r.status === "Mismatch"
                        ? "bg-destructive/10 text-destructive"
                        : r.status === "Compliant"
                          ? "bg-emerald-500/10 text-emerald-700"
                          : "",
                    )}
                  >
                    {r.status}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {coverage ? <p className="text-[10px] text-muted-foreground">{coverage}</p> : null}
    </div>
  );
}

export function PromoDetailVisual({ ctx, metric }: { ctx: KpiDetailsContext; metric?: KpiMetric }) {
  const checks = buildPromoChecks(ctx);
  const pass = checks.filter((c) => c.status === "Compliant").length;
  const fail = checks.filter((c) => c.status === "Non-compliant").length;
  const na = checks.filter((c) => c.status === "Not assessable").length;
  const total = checks.length || 1;
  const coverage = formatCoverage(metric);

  if (!checks.length) {
    return <p className="text-xs text-muted-foreground">No active promotions in scope.</p>;
  }

  const segments = [
    { label: "Compliant", count: pass, className: "bg-emerald-500" },
    { label: "Non-compliant", count: fail, className: "bg-destructive" },
    { label: "Not assessable", count: na, className: "bg-muted-foreground/40" },
  ].filter((s) => s.count > 0);

  return (
    <div className="space-y-3">
      <p className="text-2xl font-semibold tabular-nums">{metric?.value ?? "—"}</p>
      <div className="flex h-2.5 overflow-hidden rounded-full">
        {segments.map((s) => (
          <div
            key={s.label}
            className={cn(s.className, "transition-all")}
            style={{ width: `${(s.count / total) * 100}%` }}
            title={`${s.label}: ${s.count}`}
          />
        ))}
      </div>
      <ul className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
        {segments.map((s) => (
          <li key={s.label}>
            {s.label} ({s.count})
          </li>
        ))}
      </ul>
      <ul className="space-y-1">
        {checks.map((c) => (
          <li key={c.check} className="flex items-center justify-between text-[10px]">
            <span>{c.check}</span>
            <span
              className={cn(
                "font-medium",
                c.status === "Non-compliant"
                  ? "text-destructive"
                  : c.status === "Compliant"
                    ? "text-emerald-700 dark:text-emerald-300"
                    : "text-muted-foreground",
              )}
            >
              {c.status}
            </span>
          </li>
        ))}
      </ul>
      {coverage ? <p className="text-[10px] text-muted-foreground">{coverage}</p> : null}
    </div>
  );
}

export function NotConfiguredVisual({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-dashed border-border bg-muted/20 px-4 py-5 text-center text-xs text-muted-foreground">
      {label}: Not configured — add products with SKU, facings, and requirements in the planogram editor.
    </div>
  );
}

export function NotApplicableVisual({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 px-4 py-5 text-center text-xs text-muted-foreground">
      {label}: Not applicable for this audit scope.
    </div>
  );
}

function isNotConfigured(metric?: KpiMetric): boolean {
  return (
    (metric?.state === "not_configured" || metric?.audit_status === "not_configured") &&
    metric.numeric == null &&
    metric.value !== "Not applicable"
  );
}

function isNotApplicable(metric?: KpiMetric): boolean {
  return metric?.audit_status === "not_applicable" || metric?.value === "Not applicable";
}

/** Heavy drill-down visuals — shown only when the user expands a KPI card. */
export function KpiDetailExpandedVisual({
  kpiId,
  ctx,
  metric,
}: {
  kpiId: AuditKpiId;
  ctx: KpiDetailsContext;
  metric?: KpiMetric;
}) {
  if (isNotConfigured(metric)) {
    return <NotConfiguredVisual label={metric!.label} />;
  }
  if (isNotApplicable(metric)) {
    return <NotApplicableVisual label={metric!.label} />;
  }

  switch (kpiId) {
    case "location_accuracy":
      return <LocationDetailVisual ctx={ctx} metric={metric} />;
    case "planogram_compliance":
      return <PlanogramDetailVisual ctx={ctx} metric={metric} />;
    case "assortment_compliance":
      return <AssortmentDetailVisual ctx={ctx} metric={metric} kpiId="assortment_compliance" />;
    case "msl_compliance":
      return <AssortmentDetailVisual ctx={ctx} metric={metric} kpiId="msl_compliance" />;
    case "facing_count":
      return <FacingDetailVisual ctx={ctx} metric={metric} />;
    case "price_compliance":
      return <PriceDetailVisual ctx={ctx} metric={metric} />;
    case "promotional_compliance":
      return <PromoDetailVisual ctx={ctx} metric={metric} />;
    case "share_of_shelf":
      return <ShareOfShelfDetailVisual ctx={ctx} metric={metric} />;
    default:
      return null;
  }
}

/** @deprecated Use KpiDetailSummary + KpiDetailExpandedVisual instead. */
export function KpiDetailVisualBody({
  kpiId,
  ctx,
  metric,
}: {
  kpiId: AuditKpiId;
  ctx: KpiDetailsContext;
  metric?: KpiMetric;
}) {
  if (isNotConfigured(metric)) {
    return <NotConfiguredVisual label={metric!.label} />;
  }
  if (isNotApplicable(metric)) {
    return <NotApplicableVisual label={metric!.label} />;
  }

  switch (kpiId) {
    case "osa":
      return <OsaDetailVisual ctx={ctx} metric={metric} />;
    case "location_accuracy":
      return <LocationDetailVisual ctx={ctx} metric={metric} />;
    case "planogram_compliance":
      return <PlanogramDetailVisual ctx={ctx} metric={metric} />;
    case "assortment_compliance":
      return <AssortmentDetailVisual ctx={ctx} metric={metric} kpiId="assortment_compliance" />;
    case "msl_compliance":
      return <AssortmentDetailVisual ctx={ctx} metric={metric} kpiId="msl_compliance" />;
    case "facing_count":
      return <FacingDetailVisual ctx={ctx} metric={metric} />;
    case "share_of_shelf":
      return <ShareOfShelfDetailVisual ctx={ctx} metric={metric} />;
    case "price_compliance":
      return <PriceDetailVisual ctx={ctx} metric={metric} />;
    case "promotional_compliance":
      return <PromoDetailVisual ctx={ctx} metric={metric} />;
    default:
      return <OsaDetailVisual ctx={ctx} metric={metric} />;
  }
}
