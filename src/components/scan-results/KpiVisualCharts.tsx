/**
 * Role-appropriate KPI visualizations — brand theme colors, deterministic values from audit dashboard.
 */

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/States";
import { buildRoleKpiMetrics, type KpiMetric } from "@/lib/execution-metrics";
import {
  KPI_CHART_KIND,
  type AuditRoleTab,
  type KpiChartKind,
  primaryKpiIds,
  roleTabLabel,
} from "@/lib/role-audit-ui";
import type { AuditKpiId } from "@/lib/role-kpi-config";
import type { ScanResult } from "@/lib/scan-results";
import { cn } from "@/lib/utils";

function ProgressBarChart({ kpi }: { kpi: KpiMetric }) {
  const pct = kpi.numeric ?? 0;
  const target = 90;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-foreground">{kpi.label}</span>
        <span className="tabular-nums text-muted-foreground">Target {target}%</span>
      </div>
      <div className="relative h-3 overflow-hidden rounded-full bg-muted">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-brand transition-all"
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
        <div
          className="absolute inset-y-0 w-0.5 bg-brand-muted/80"
          style={{ left: `${target}%` }}
          title={`Target ${target}%`}
        />
      </div>
      <div className="flex justify-between text-[0.65rem] text-muted-foreground">
        <span>{kpi.value}</span>
        {kpi.coverage_label ? <span>{kpi.coverage_label}</span> : null}
      </div>
      {kpi.formula ? (
        <p className="text-[0.65rem] text-muted-foreground">
          {kpi.formula}
          {kpi.numerator != null && kpi.denominator != null
            ? ` · ${kpi.numerator}/${kpi.denominator}`
            : ""}
        </p>
      ) : null}
    </div>
  );
}

function ChecklistChart({ kpi, role }: { kpi: KpiMetric; role: AuditRoleTab }) {
  const items = useMemo(() => {
    const summary = (role === "distributor" ? "MSL" : "Assortment") + " scope";
    return [
      { label: `${summary} — assessed`, done: kpi.numerator ?? 0, total: kpi.denominator ?? 0 },
    ];
  }, [kpi, role]);
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-foreground">{kpi.label}</p>
      {items.map((item) => (
        <div key={item.label} className="rounded-lg border border-border bg-surface px-3 py-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{item.label}</span>
            <Badge variant="outline" className="rounded-full border-brand/25 bg-brand-soft/40 text-brand">
              {item.done}/{item.total || "—"}
            </Badge>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-brand"
              style={{
                width: item.total
                  ? `${Math.min(100, (item.done / item.total) * 100)}%`
                  : "0%",
              }}
            />
          </div>
        </div>
      ))}
      <p className="text-[0.65rem] text-muted-foreground">{kpi.detail}</p>
    </div>
  );
}

function HeatmapChart({ kpi }: { kpi: KpiMetric }) {
  const cells = 12;
  const passCount = kpi.numerator ?? 0;
  const total = kpi.denominator ?? cells;
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-foreground">{kpi.label}</p>
      <div className="grid grid-cols-4 gap-1 sm:grid-cols-6">
        {Array.from({ length: Math.min(cells, total || cells) }, (_, i) => {
          const ok = i < passCount;
          return (
            <div
              key={i}
              className={cn(
                "aspect-square rounded-md border text-[0.55rem] font-medium flex items-center justify-center",
                ok
                  ? "border-success/30 bg-success/15 text-success"
                  : "border-destructive/30 bg-destructive/10 text-destructive",
              )}
              title={ok ? "Pass" : "Fail"}
            >
              {i + 1}
            </div>
          );
        })}
      </div>
      <p className="text-sm font-semibold tabular-nums text-brand">{kpi.value}</p>
      {kpi.coverage_label ? (
        <p className="text-[0.65rem] text-muted-foreground">{kpi.coverage_label}</p>
      ) : null}
    </div>
  );
}

function StackedPromoChart({ kpi }: { kpi: KpiMetric }) {
  const pass = kpi.numerator ?? 0;
  const total = kpi.denominator ?? 0;
  const fail = Math.max(0, total - pass);
  const na = kpi.audit_status === "not_assessable" ? 1 : 0;
  if (kpi.audit_status === "not_applicable") {
    return (
      <div className="rounded-lg border border-border bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
        {kpi.label}: Not applicable — no active promotions in scope.
      </div>
    );
  }
  const segments = [
    { label: "Compliant", count: pass, className: "bg-success" },
    { label: "Non-compliant", count: fail, className: "bg-destructive" },
    { label: "Not assessable", count: na, className: "bg-muted-foreground/40" },
  ].filter((s) => s.count > 0);
  const sum = segments.reduce((a, s) => a + s.count, 0) || 1;
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-foreground">{kpi.label}</p>
      <div className="flex h-4 overflow-hidden rounded-full">
        {segments.map((s) => (
          <div
            key={s.label}
            className={cn(s.className, "transition-all")}
            style={{ width: `${(s.count / sum) * 100}%` }}
            title={`${s.label}: ${s.count}`}
          />
        ))}
      </div>
      <ul className="flex flex-wrap gap-2 text-[0.65rem]">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-1 text-muted-foreground">
            <span className={cn("size-2 rounded-full", s.className)} />
            {s.label} ({s.count})
          </li>
        ))}
      </ul>
      <p className="text-sm font-semibold tabular-nums">{kpi.value}</p>
    </div>
  );
}

function FacingBarsChart({ kpi, data }: { kpi: KpiMetric; data?: ScanResult }) {
  const rows = useMemo(() => {
    const inv = data?.inventory ?? [];
    const top = inv.slice(0, 6);
    return top.map((item) => ({
      name: item.name ?? item.brand ?? "SKU",
      actual: item.facings ?? 1,
      planned: item.expected_facings ?? item.facings ?? 1,
    }));
  }, [data]);
  const max = Math.max(1, ...rows.map((r) => Math.max(r.actual, r.planned)));
  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-foreground">{kpi.label}</p>
      <p className="text-lg font-semibold tabular-nums text-brand">{kpi.value}</p>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">No facing data in scope.</p>
      ) : (
        rows.map((row) => (
          <div key={row.name} className="space-y-1">
            <div className="flex justify-between text-[0.65rem] text-muted-foreground">
              <span className="truncate pr-2">{row.name}</span>
              <span>
                {row.actual} / {row.planned} planned
              </span>
            </div>
            <div className="space-y-0.5">
              <div className="h-2 rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-brand"
                  style={{ width: `${(row.actual / max) * 100}%` }}
                />
              </div>
              <div className="h-1 rounded-full bg-muted/60">
                <div
                  className="h-full rounded-full bg-brand-muted/70"
                  style={{ width: `${(row.planned / max) * 100}%` }}
                />
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function SosStackedChart({ kpi, data }: { kpi: KpiMetric; data?: ScanResult }) {
  const brands = data?.charts?.top_brands ?? [];
  if (!brands.length) {
    return (
      <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
        Share of shelf requires category geometry and brand attribution — {kpi.value}.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-foreground">{kpi.label}</p>
      <div className="flex h-5 overflow-hidden rounded-full">
        {brands.slice(0, 8).map((b, i) => (
          <div
            key={b.brand}
            className={cn(
              "transition-all",
              i === 0 ? "bg-brand" : i === 1 ? "bg-brand-muted" : "bg-muted-foreground/30",
            )}
            style={{ width: `${Math.max(2, b.share ?? 0)}%` }}
            title={`${b.brand}: ${b.share}%`}
          />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[0.65rem] text-muted-foreground">
        {brands.slice(0, 6).map((b) => (
          <li key={b.brand}>
            <span className="font-medium text-foreground">{b.brand}</span> {b.share}%
          </li>
        ))}
      </ul>
      <p className="text-sm font-semibold tabular-nums text-brand">{kpi.value}</p>
    </div>
  );
}

function ChartForKpi({
  kpiId,
  kpi,
  kind,
  role,
  data,
}: {
  kpiId: AuditKpiId;
  kpi: KpiMetric;
  kind: KpiChartKind;
  role: AuditRoleTab;
  data?: ScanResult;
}) {
  if (
    (kpi.state === "not_configured" || kpi.audit_status === "not_configured") &&
    kpi.numeric == null &&
    kpi.value !== "Not applicable"
  ) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-5 text-center text-xs text-muted-foreground">
        {kpi.label}: Not configured — add products with SKU, facings, and MRP in the planogram editor.
      </div>
    );
  }
  if (kpi.audit_status === "not_applicable" || kpi.value === "Not applicable") {
    return (
      <div className="rounded-xl border border-border bg-muted/40 px-4 py-5 text-center text-xs text-muted-foreground">
        {kpi.label}: Not applicable for this audit scope.
      </div>
    );
  }
  switch (kind) {
    case "progress_bar":
      return <ProgressBarChart kpi={kpi} />;
    case "checklist":
      return <ChecklistChart kpi={kpi} role={role} />;
    case "heatmap":
      return <HeatmapChart kpi={kpi} />;
    case "stacked_bar":
      return <StackedPromoChart kpi={kpi} />;
    case "facing_bars":
      return <FacingBarsChart kpi={kpi} data={data} />;
    case "sos_stacked":
      return <SosStackedChart kpi={kpi} data={data} />;
    default:
      return <ProgressBarChart kpi={kpi} />;
  }
}

export function KpiVisualChartsPanel({
  data,
  role,
  loading,
}: {
  data?: ScanResult;
  role: AuditRoleTab;
  loading?: boolean;
}) {
  const kpis = useMemo(() => buildRoleKpiMetrics(data, role), [data, role]);
  const kpiById = Object.fromEntries(kpis.map((k) => [k.key, k]));
  const ids = primaryKpiIds(role);

  return (
    <section className="card-surface p-5 sm:p-6">
      <h2 className="text-sm font-semibold tracking-tight">KPI visuals</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Charts for {roleTabLabel(role)} audit metrics — values from deterministic formulas, not AI estimates.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ids.map((id) => {
          const kpi = kpiById[id];
          if (!kpi) return null;
          const kind = KPI_CHART_KIND[id];
          return (
            <div key={id} className="rounded-xl border border-brand/15 bg-brand-soft/20 p-4">
              {loading ? (
                <Skeleton className="h-24 w-full" />
              ) : (
                <ChartForKpi kpiId={id} kpi={kpi} kind={kind} role={role} data={data} />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
