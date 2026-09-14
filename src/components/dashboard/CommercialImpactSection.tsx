import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Download, Search, X } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DashboardCompactFilterToolbar } from "@/components/dashboard/DashboardFilterBar";
import type { CommercialImpactDashboardData } from "@/lib/dashboard-commercial-impact";
import { exportCommercialImpactCsv } from "@/lib/dashboard-commercial-impact";
import type { WorkspaceDashboardData } from "@/lib/dashboard-intelligence";
import {
  DEFAULT_DASHBOARD_FILTERS,
  isDefaultDashboardFilters,
  type DashboardFilterState,
} from "@/lib/dashboard-filters";
import { formatLostSales } from "@/lib/scan-execution";
import { cn } from "@/lib/utils";

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--card)",
  fontSize: 12,
  boxShadow: "0 4px 16px rgba(15, 23, 42, 0.06)",
} as const;

function KpiCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card px-3.5 py-3 shadow-sm">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight text-brand">{value}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{description}</p>
    </div>
  );
}

function RunRateSteppedBar({
  daily,
  weekly,
  monthly,
}: {
  daily: number;
  weekly: number;
  monthly: number;
}) {
  const max = Math.max(daily, weekly, monthly, 1);
  const bars = [
    { label: "Daily", value: daily },
    { label: "7 Days", value: weekly },
    { label: "30 Days", value: monthly },
  ];
  return (
    <div className="space-y-3">
      {bars.map((bar, i) => (
        <div key={bar.label}>
          <div className="mb-1 flex items-baseline justify-between text-xs">
            <span className="text-muted-foreground">{bar.label}</span>
            <span className="font-semibold tabular-nums text-brand">{formatLostSales(bar.value)}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-md bg-muted/40">
            <div
              className={cn("h-full rounded-md", i === 0 ? "bg-brand" : i === 1 ? "bg-brand/70" : "bg-brand/45")}
              style={{ width: `${Math.max((bar.value / max) * 100, bar.value > 0 ? 4 : 0)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function ProductExposureChart({ rows }: { rows: CommercialImpactDashboardData["by_product"] }) {
  if (!rows.length) return null;
  const max = Math.max(...rows.map((r) => r.daily_exposure_inr), 1);
  return (
    <div className="space-y-2">
      {rows.slice(0, 8).map((row) => {
        const width = Math.max(4, (row.daily_exposure_inr / max) * 100);
        return (
          <Link
            key={`${row.scan_id}|${row.brand}|${row.product}`}
            to="/results"
            search={{ audit: row.scan_id }}
            className="group grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] items-center gap-2 rounded-lg px-1 py-1 hover:bg-brand-soft/25"
          >
            <div className="min-w-0 truncate text-xs">
              <p className="truncate font-medium text-foreground">{row.product}</p>
              <p className="truncate text-[10px] text-muted-foreground">{row.brand}</p>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted/40">
              <div className="h-full rounded-full bg-brand" style={{ width: `${width}%` }} />
            </div>
            <span className="text-xs font-semibold tabular-nums text-brand">
              {formatLostSales(row.daily_exposure_inr)}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

export function CommercialImpactSection({
  data,
  filters,
  onFiltersChange,
}: {
  data: WorkspaceDashboardData;
  filters: DashboardFilterState;
  onFiltersChange: (next: DashboardFilterState) => void;
}) {
  const commercial = data.commercial_impact;
  const [search, setSearch] = useState("");

  const filteredProducts = useMemo(() => {
    if (!commercial) return [];
    const q = search.trim().toLowerCase();
    if (!q) return commercial.by_product;
    return commercial.by_product.filter(
      (r) => r.product.toLowerCase().includes(q) || r.brand.toLowerCase().includes(q),
    );
  }, [commercial, search]);

  const filtersActive = !isDefaultDashboardFilters(filters) || search.trim().length > 0;

  if (!commercial?.visible) return null;

  const issueChartData = commercial.by_issue.map((r) => ({
    name: r.label,
    value: r.daily_exposure_inr,
    scan_id: r.audit_ids[0],
  }));

  return (
    <section className="mt-8">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Commercial impact
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            See the estimated commercial exposure associated with shelf availability, stock and facing
            issues across your audits.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 rounded-lg border-border/60 text-xs"
          onClick={() => exportCommercialImpactCsv(commercial)}
          disabled={!commercial.detail_rows.length}
        >
          <Download className="size-3.5" />
          Download CSV
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <KpiCard
          label="Estimated Daily Exposure"
          value={formatLostSales(commercial.daily_exposure_inr)}
          description="Eligible affected products"
        />
        <KpiCard
          label="7-Day Run-Rate"
          value={formatLostSales(commercial.weekly_exposure_inr)}
          description="Illustrative exposure"
        />
        <KpiCard
          label="30-Day Run-Rate"
          value={formatLostSales(commercial.monthly_exposure_inr)}
          description="Illustrative exposure"
        />
        <KpiCard
          label="Audits with Estimate"
          value={`${commercial.audits_with_estimate}`}
          description="Audits with sales and price inputs"
        />
      </div>

      <div className="mt-4 rounded-2xl border border-border/60 bg-card shadow-sm">
        <div className="space-y-2 border-b border-border/40 p-3 sm:p-4">
          <DashboardCompactFilterToolbar
            filters={filters}
            onChange={onFiltersChange}
            options={data.filter_options}
          />
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[180px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products"
                aria-label="Search products"
                className="h-8 rounded-lg border-border/60 pl-8 text-xs"
              />
            </div>
            {filtersActive ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 rounded-lg text-xs text-muted-foreground"
                onClick={() => {
                  onFiltersChange({ ...DEFAULT_DASHBOARD_FILTERS });
                  setSearch("");
                }}
              >
                <X className="size-3.5" />
                Clear filters
              </Button>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 p-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border/60 bg-muted/10 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Estimated exposure by issue
            </p>
            {issueChartData.length ? (
              <div className="mt-3 h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={issueChartData} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                    <XAxis type="number" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                    <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(v: number) => [formatLostSales(v), "Daily exposure"]}
                    />
                    <Bar dataKey="value" fill="hsl(var(--brand))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">Not enough data</p>
            )}
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/10 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Products with highest estimated exposure
            </p>
            <div className="mt-3">
              {filteredProducts.length ? (
                <ProductExposureChart rows={filteredProducts} />
              ) : (
                <p className="text-xs text-muted-foreground">No products match your search.</p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/10 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Exposure run-rate
            </p>
            <div className="mt-3">
              <RunRateSteppedBar
                daily={commercial.daily_exposure_inr}
                weekly={commercial.weekly_exposure_inr}
                monthly={commercial.monthly_exposure_inr}
              />
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/10 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Estimated exposure over time
            </p>
            {commercial.has_trend ? (
              <div className="mt-3 h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={commercial.trend} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="date_label" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                    <YAxis tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(v: number) => [formatLostSales(v), "Daily exposure"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="daily_exposure_inr"
                      stroke="hsl(var(--brand))"
                      strokeWidth={2}
                      dot={{ r: 3, fill: "hsl(var(--brand))" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">
                Complete more audits with sales and price inputs to track commercial exposure over time.
              </p>
            )}
          </div>
        </div>

        <p className="border-t border-border/40 px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
          Illustrative estimate based on the sales and price inputs available for eligible audit records.
          It is not confirmed historical lost revenue.
        </p>
      </div>
    </section>
  );
}
