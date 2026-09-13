import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Download, Search, X } from "lucide-react";
import {
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/States";
import { DashboardCompactFilterToolbar } from "@/components/dashboard/DashboardFilterBar";
import type { BrandAnalysisData } from "@/lib/dashboard-brand-analysis";
import { exportBrandAnalysisCsv } from "@/lib/dashboard-brand-analysis";
import type { WorkspaceDashboardData } from "@/lib/dashboard-intelligence";
import {
  DEFAULT_DASHBOARD_FILTERS,
  isDefaultDashboardFilters,
  type DashboardFilterState,
} from "@/lib/dashboard-filters";
import { cn } from "@/lib/utils";

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--card)",
  fontSize: 12,
  boxShadow: "0 4px 16px rgba(15, 23, 42, 0.06)",
} as const;

const BAR_TONES = ["bg-brand", "bg-brand/75", "bg-brand/55", "bg-brand/35", "bg-muted-foreground/30"];

function KpiCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  const muted = value === "Not enough data" || value === "Not assessable";
  return (
    <div className="rounded-xl border border-border/60 bg-card px-3.5 py-3 shadow-sm">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 text-xl font-semibold tabular-nums tracking-tight",
          muted ? "text-sm font-medium text-muted-foreground" : "text-brand",
        )}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{description}</p>
    </div>
  );
}

function StackedShareBar({ segments }: { segments: BrandAnalysisData["share_segments"] }) {
  if (!segments.length) return null;
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full border border-border/60">
        {segments.map((seg, i) => (
          <div
            key={seg.brand}
            className={cn("h-full", BAR_TONES[i % BAR_TONES.length])}
            style={{ width: `${Math.max(0, Math.min(100, seg.share))}%` }}
            title={`${seg.brand} ${Math.round(seg.share)}%`}
          />
        ))}
      </div>
      <ul className="mt-2.5 space-y-1 text-xs">
        {segments.map((seg, i) => (
          <li key={seg.brand} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5">
              <span className={cn("size-2 rounded-full", BAR_TONES[i % BAR_TONES.length])} />
              <span className={seg.is_primary ? "font-medium text-brand" : "text-muted-foreground"}>
                {seg.brand}
              </span>
            </span>
            <span className="tabular-nums">{Math.round(seg.share)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BrandMixDonut({ segments }: { segments: BrandAnalysisData["mix_segments"] }) {
  if (!segments.length) return null;
  const data = segments.map((s) => ({ name: s.brand, value: s.share, is_primary: s.is_primary }));
  return (
    <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-start sm:gap-4">
      <div className="size-[120px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={36}
              outerRadius={54}
              paddingAngle={1}
              stroke="none"
            >
              {data.map((entry, i) => (
                <Cell
                  key={entry.name}
                  fill={
                    entry.is_primary
                      ? "hsl(var(--brand))"
                      : i === 1
                        ? "hsl(var(--brand) / 0.65)"
                        : i === 2
                          ? "hsl(var(--brand) / 0.4)"
                          : "hsl(var(--muted-foreground) / 0.35)"
                  }
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(v: number) => [`${Math.round(v)}%`, "Share"]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex-1 space-y-1 text-xs">
        {segments.map((seg) => (
          <li key={seg.brand} className="flex justify-between gap-2">
            <span className={seg.is_primary ? "font-medium text-brand" : "text-muted-foreground"}>
              {seg.brand}
            </span>
            <span className="tabular-nums">{Math.round(seg.share)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BrandRankingChart({
  rows,
  metricLabel,
}: {
  rows: BrandAnalysisData["ranking"];
  metricLabel: string;
}) {
  if (!rows.length) return null;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="space-y-2">
      <p className="text-[10px] text-muted-foreground">{metricLabel}</p>
      {rows.slice(0, 8).map((row) => {
        const width = Math.max(4, (row.value / max) * 100);
        return (
          <div key={row.brand} className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] items-center gap-2">
            <span className={cn("truncate text-xs", row.is_primary ? "font-medium text-brand" : "text-foreground")}>
              {row.brand}
            </span>
            <div className="h-2 overflow-hidden rounded-full bg-muted/40">
              <div
                className={cn("h-full rounded-full", row.is_primary ? "bg-brand" : "bg-brand/60")}
                style={{ width: `${width}%` }}
              />
            </div>
            <span className="text-xs font-semibold tabular-nums text-brand">{Math.round(row.value)}%</span>
          </div>
        );
      })}
    </div>
  );
}

export function BrandAnalysisSection({
  data,
  filters,
  onFiltersChange,
}: {
  data: WorkspaceDashboardData;
  filters: DashboardFilterState;
  onFiltersChange: (next: DashboardFilterState) => void;
}) {
  const brand = data.brand_analysis;
  const [search, setSearch] = useState("");

  const filteredRanking = useMemo(() => {
    if (!brand) return [];
    const q = search.trim().toLowerCase();
    if (!q) return brand.ranking;
    return brand.ranking.filter((r) => r.brand.toLowerCase().includes(q));
  }, [brand, search]);

  const filtersActive = !isDefaultDashboardFilters(filters) || search.trim().length > 0;

  if (!brand?.visible) return null;

  const trendData = brand.trend.filter((p) => p.actual_share !== null);

  return (
    <section className="mt-8">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Brand analysis
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            See how your brands perform on the shelf and how their presence compares with competitors
            across your audits.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 rounded-lg border-border/60 text-xs"
          onClick={() => exportBrandAnalysisCsv(brand)}
          disabled={!brand.detail_rows.length}
        >
          <Download className="size-3.5" />
          Download CSV
        </Button>
      </div>

      {brand.kpi_cards.length ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {brand.kpi_cards.map((card) => (
            <KpiCard
              key={card.key}
              label={card.label}
              description={card.description}
              value={
                card.value !== null
                  ? card.unit === "percent"
                    ? `${Math.round(card.value)}%`
                    : String(Math.round(card.value))
                  : card.unavailable_reason ?? "Not enough data"
              }
            />
          ))}
        </div>
      ) : null}

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
                placeholder="Search brands"
                aria-label="Search brands"
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

        {!brand.share_segments.length && !trendData.length ? (
          <div className="p-6">
            <EmptyState
              title="Not enough data"
              description="Complete FMCG brand audits with shelf-share measurement to unlock brand analysis."
            />
          </div>
        ) : (
          <div className="grid gap-4 p-4 lg:grid-cols-2">
            <div className="rounded-xl border border-border/60 bg-muted/10 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Share of shelf
              </p>
              {brand.share_segments.length ? (
                <div className="mt-3">
                  <StackedShareBar segments={brand.share_segments} />
                </div>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">Not enough data</p>
              )}
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/10 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Brand mix on the shelf
              </p>
              <div className="mt-3">
                {brand.mix_segments.length ? (
                  <BrandMixDonut segments={brand.mix_segments} />
                ) : (
                  <p className="text-xs text-muted-foreground">Not enough data</p>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/10 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Brands by shelf presence
              </p>
              <div className="mt-3">
                {filteredRanking.length ? (
                  <BrandRankingChart rows={filteredRanking} metricLabel={brand.ranking_metric_label} />
                ) : (
                  <p className="text-xs text-muted-foreground">No brands match your search.</p>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/10 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Your brand&apos;s shelf share over time
              </p>
              {trendData.length >= 2 ? (
                <div className="mt-3 h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                      <XAxis dataKey="date_label" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(v: number) => [`${Math.round(v)}%`, "Actual share"]}
                      />
                      {trendData[0]?.target_share !== null ? (
                        <ReferenceLine
                          y={trendData[0]!.target_share!}
                          stroke="hsl(215 16% 62%)"
                          strokeDasharray="4 4"
                          label={{ value: "Target", fontSize: 10, fill: "var(--muted-foreground)" }}
                        />
                      ) : null}
                      <Line
                        type="monotone"
                        dataKey="actual_share"
                        stroke="hsl(var(--brand))"
                        strokeWidth={2}
                        dot={{ r: 3, fill: "hsl(var(--brand))" }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                  <ul className="mt-2 space-y-1">
                    {trendData.slice(-3).map((p) => (
                      <li key={p.scan_id} className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">
                          {p.date_label} · {p.store_name}
                        </span>
                        <Button asChild variant="ghost" size="sm" className="h-6 rounded-md px-2 text-[10px]">
                          <Link to="/results" search={{ audit: p.scan_id }}>
                            Open audit <ArrowRight className="size-3" />
                          </Link>
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">
                  Complete more audits with shelf-space measurement to track share over time.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
