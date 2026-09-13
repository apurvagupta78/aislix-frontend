import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, BarChart3, HelpCircle } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EmptyState } from "@/components/States";
import {
  DASHBOARD_CHART_COLORS,
  DEFAULT_TREND_KPIS,
  effectiveDashboardRole,
  KPI_TREND_CHIP_LABELS,
  OPEN_ISSUES_TREND_LABEL,
  trendKpisForRole,
  type DashboardRoleFilter,
} from "@/lib/dashboard-config";
import type { PerformanceTrendChartPoint } from "@/lib/dashboard-performance-trend";
import {
  formatTrendValue,
  kpiHigherIsBetter,
  varianceArrow,
} from "@/lib/dashboard-performance-trend";
import type { WorkspaceDashboardData } from "@/lib/dashboard-intelligence";
import type { AuditKpiId } from "@/lib/role-kpi-config";
import { cn } from "@/lib/utils";

type TrendSelection = AuditKpiId | "open_issues";
type ChartMode = "performance" | "vs_target";

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--card)",
  fontSize: 12,
  boxShadow: "0 4px 16px rgba(15, 23, 42, 0.06)",
} as const;

const TARGET_LINE_COLOR = "hsl(215 16% 62%)";

function CommandSectionHeader({
  eyebrow,
  title,
  description,
  info,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  info?: string;
}) {
  return (
    <div className="mb-4">
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        {eyebrow}
      </p>
      <div className="mt-1 flex items-start gap-2">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {info ? (
          <span
            title={info}
            className="mt-1 inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/60"
            aria-label="How this trend is calculated"
          >
            <HelpCircle className="size-4" />
          </span>
        ) : null}
      </div>
    </div>
  );
}

function TrendSummaryChip({
  label,
  value,
  varianceLabel,
  sublabel,
  noData,
}: {
  label: string;
  value: string;
  varianceLabel: string | null;
  sublabel: string;
  noData?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/15 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-base font-semibold tabular-nums", noData && "text-muted-foreground")}>
        {value}
      </p>
      {varianceLabel ? (
        <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">{varianceLabel}</p>
      ) : null}
      <p className="mt-1 text-[10px] text-muted-foreground">{sublabel}</p>
    </div>
  );
}

function buildChartRows(
  points: PerformanceTrendChartPoint[],
  kpiIds: AuditKpiId[],
  mode: ChartMode,
): Record<string, string | number | null>[] {
  return points.map((p) => {
    const row: Record<string, string | number | null> = {
      point_key: p.point_key,
      date_label: p.date_label,
      scan_id: p.scan_id,
      store_name: p.store_name,
      role_label: p.role_label,
    };
    for (const kpiId of kpiIds) {
      const val = p.values[kpiId] ?? null;
      const target = p.targets[kpiId] ?? null;
      if (mode === "vs_target") {
        row[kpiId] =
          val !== null && target !== null ? Math.round((val - target) * 10) / 10 : null;
      } else {
        row[kpiId] = val;
      }
      row[`${kpiId}__target`] = target;
      row[`${kpiId}__variance`] = p.variances[kpiId] ?? null;
      row[`${kpiId}__unit`] = p.units[kpiId] ?? "percent";
    }
    return row;
  });
}

function TrendTooltip({
  active,
  payload,
  label,
  kpiIds,
  mode,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; color: string; payload: Record<string, unknown> }>;
  label?: string;
  kpiIds: AuditKpiId[];
  mode: ChartMode;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as Record<string, string | number | null>;
  const store = row.store_name ?? "—";
  const role = row.role_label ?? "—";

  return (
    <div style={tooltipStyle} className="min-w-[180px] px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label} · {store}
      </p>
      <p className="text-[10px] text-muted-foreground">{role}</p>
      <div className="mt-2 space-y-2">
        {kpiIds.map((kpiId) => {
          const unit = (row[`${kpiId}__unit`] as "percent" | "count") ?? "percent";
          const raw = row[kpiId];
          const target = row[`${kpiId}__target`];
          const variance = row[`${kpiId}__variance`];
          if (raw === null || raw === undefined) return null;
          const chip = KPI_TREND_CHIP_LABELS[kpiId];
          return (
            <div key={kpiId}>
              <p className="text-[10px] font-semibold uppercase text-muted-foreground">{chip}</p>
              <p className="text-sm font-semibold tabular-nums">
                {mode === "vs_target"
                  ? `${Number(raw) >= 0 ? "+" : ""}${raw} pts`
                  : formatTrendValue(Number(raw), unit)}
              </p>
              {mode === "performance" && target !== null && target !== undefined ? (
                <>
                  <p className="text-[11px] text-muted-foreground">Target: {Math.round(Number(target))}%</p>
                  {variance !== null && variance !== undefined ? (
                    <p className="text-[11px] text-muted-foreground">
                      Variance: {Number(variance) >= 0 ? "+" : ""}
                      {variance} pts
                    </p>
                  ) : null}
                </>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PerformanceOverTimeSection({
  data,
  role,
  kriFilter = "all",
}: {
  data: WorkspaceDashboardData;
  role: DashboardRoleFilter;
  kriFilter?: AuditKpiId | "all";
}) {
  const effectiveRole = effectiveDashboardRole(role, data.effective_role);
  const availableKpis = trendKpisForRole(effectiveRole);
  const trend = data.performance_over_time ?? {
    audit_count: data.filter_summary.audit_count,
    store_count: data.filter_summary.store_count,
    chart_points: [],
    open_issues_points: [],
    period_metrics: data.performance_period,
    configured_targets: {},
    valid_trend_points: 0,
  };

  const defaultKpis = useMemo(() => {
    if (kriFilter !== "all") return [kriFilter];
    const preferred = DEFAULT_TREND_KPIS.filter((k) => availableKpis.includes(k));
    if (preferred.length >= 3) return preferred.slice(0, 3);
    return availableKpis.slice(0, 3);
  }, [availableKpis, kriFilter]);

  const [activeMetrics, setActiveMetrics] = useState<TrendSelection[]>(defaultKpis);
  const [chartMode, setChartMode] = useState<ChartMode>("performance");
  const [focusedScanId, setFocusedScanId] = useState<string | null>(null);

  useEffect(() => {
    setActiveMetrics(defaultKpis);
  }, [defaultKpis, effectiveRole, kriFilter]);

  const percentKpis = activeMetrics.filter((m): m is AuditKpiId => m !== "open_issues");
  const showOpenIssues = activeMetrics.includes("open_issues");

  const toggleMetric = (metric: TrendSelection) => {
    setActiveMetrics((current) => {
      if (current.includes(metric)) {
        return current.filter((m) => m !== metric);
      }
      if (current.length >= 3) return current;
      return [...current, metric];
    });
  };

  const hasTargets = percentKpis.some((k) => trend.configured_targets[k] != null);
  const enoughAudits = trend.valid_trend_points >= 2;

  const chartRows = useMemo(
    () => buildChartRows(trend.chart_points, percentKpis, chartMode),
    [trend.chart_points, percentKpis, chartMode],
  );

  const primaryTarget =
    percentKpis.length === 1 ? trend.configured_targets[percentKpis[0]!] : null;

  const auditVolumeLabel =
    trend.audit_count > 0
      ? `${trend.audit_count} audit${trend.audit_count === 1 ? "" : "s"} across ${trend.store_count} store${trend.store_count === 1 ? "" : "s"}`
      : null;

  const periodByKpi = useMemo(
    () => new Map(data.performance_period.map((m) => [m.kpi_id, m])),
    [data.performance_period],
  );

  const handleChartClick = (state: { activePayload?: Array<{ payload?: Record<string, unknown> }> }) => {
    const scanId = state.activePayload?.[0]?.payload?.scan_id;
    if (typeof scanId === "string" && scanId.length) setFocusedScanId(scanId);
  };

  const focusedPoint = focusedScanId
    ? trend.chart_points.find((p) => p.scan_id === focusedScanId)
    : null;

  return (
    <section className="mt-8">
      <CommandSectionHeader
        eyebrow="Performance over time"
        title="See How Shelf Execution Is Changing."
        description="Track your key shelf metrics across audits and see whether execution is improving, holding steady or slipping."
        info="Each point represents actual audit data in the selected view. KPI totals use the underlying audit numerator and denominator where available."
      />

      <div className="rounded-xl border border-border/60 bg-white p-4 shadow-sm sm:p-5">
        {auditVolumeLabel ? (
          <p className="mb-3 text-xs text-muted-foreground">{auditVolumeLabel}</p>
        ) : (
          <p className="mb-3 text-xs text-muted-foreground">
            Complete more audits to start tracking performance trends.
          </p>
        )}

        <div className="mb-3 flex flex-wrap gap-1.5">
          {availableKpis.map((kpi) => (
            <button
              key={kpi}
              type="button"
              onClick={() => toggleMetric(kpi)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                activeMetrics.includes(kpi)
                  ? "border-brand bg-brand-soft/50 text-brand"
                  : "border-border/80 text-muted-foreground hover:border-brand/25 hover:text-foreground",
                !activeMetrics.includes(kpi) && activeMetrics.length >= 3 && "opacity-50",
              )}
              disabled={!activeMetrics.includes(kpi) && activeMetrics.length >= 3}
            >
              {KPI_TREND_CHIP_LABELS[kpi]}
            </button>
          ))}
          <button
            type="button"
            onClick={() => toggleMetric("open_issues")}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
              showOpenIssues
                ? "border-brand bg-brand-soft/50 text-brand"
                : "border-border/80 text-muted-foreground hover:border-brand/25 hover:text-foreground",
              !showOpenIssues && activeMetrics.length >= 3 && "opacity-50",
            )}
            disabled={!showOpenIssues && activeMetrics.length >= 3}
          >
            {OPEN_ISSUES_TREND_LABEL}
          </button>
        </div>

        {percentKpis.length > 0 && (
          <div className="mb-3 grid gap-2 sm:grid-cols-3">
            {percentKpis.map((kpiId) => {
              const period = periodByKpi.get(kpiId);
              const target = trend.configured_targets[kpiId];
              const lastVal = period?.last_audit_value ?? null;
              const variance = period?.variance_vs_target ?? null;
              const unit = period?.unit ?? "percent";
              const noData = period?.no_data ?? lastVal === null;

              if (noData) {
                return (
                  <TrendSummaryChip
                    key={kpiId}
                    label={KPI_TREND_CHIP_LABELS[kpiId]}
                    value="No data"
                    varianceLabel={null}
                    sublabel={period?.no_data_reason ?? "Not enough audits"}
                    noData
                  />
                );
              }

              const dir = varianceArrow(variance, kpiHigherIsBetter(kpiId));
              const varianceText =
                variance !== null && target !== null
                  ? `${dir === "up" ? "↑" : dir === "down" ? "↓" : "→"} ${Math.abs(variance)} pts vs target`
                  : target === null
                    ? "Target not configured"
                    : null;

              return (
                <TrendSummaryChip
                  key={kpiId}
                  label={KPI_TREND_CHIP_LABELS[kpiId]}
                  value={formatTrendValue(lastVal, unit)}
                  varianceLabel={varianceText}
                  sublabel={`Last audit: ${formatTrendValue(lastVal, unit)}`}
                />
              );
            })}
          </div>
        )}

        {percentKpis.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
              {percentKpis.map((kpiId) => {
                const period = periodByKpi.get(kpiId);
                if (!period || period.change === null) return null;
                const positive = period.change > 0;
                const good = kpiHigherIsBetter(kpiId) ? positive : !positive;
                return (
                  <span key={kpiId} className="inline-flex items-center gap-1">
                    <span className="font-medium text-foreground">{KPI_TREND_CHIP_LABELS[kpiId]}:</span>
                    {period.current !== null ? `${period.current}%` : "—"}
                    <span className={cn(good ? "text-[hsl(168_55%_40%)]" : "text-[hsl(0_65%_52%)]")}>
                      {period.change >= 0 ? "+" : ""}
                      {period.change} pts vs previous period
                    </span>
                  </span>
                );
              })}
            </div>
            <div className="inline-flex rounded-lg border border-border/80 bg-muted/20 p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setChartMode("performance")}
                className={cn(
                  "rounded-md px-2.5 py-1 font-medium transition-colors",
                  chartMode === "performance" ? "bg-white text-foreground shadow-sm" : "text-muted-foreground",
                )}
              >
                Performance
              </button>
              <button
                type="button"
                onClick={() => hasTargets && setChartMode("vs_target")}
                disabled={!hasTargets}
                className={cn(
                  "rounded-md px-2.5 py-1 font-medium transition-colors",
                  chartMode === "vs_target" ? "bg-white text-foreground shadow-sm" : "text-muted-foreground",
                  !hasTargets && "cursor-not-allowed opacity-40",
                )}
              >
                Vs Target
              </button>
            </div>
          </div>
        )}

        {!enoughAudits || percentKpis.length === 0 ? (
          <EmptyState
            title="Not enough audit history yet."
            description="Complete more audits to start tracking shelf performance over time."
            icon={<BarChart3 className="size-5" />}
          />
        ) : (
          <>
            {!hasTargets && chartMode === "performance" ? (
              <p className="mb-2 text-[11px] text-muted-foreground">Target not configured</p>
            ) : null}
            <div className="h-[min(340px,42vw)] min-h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartRows} onClick={handleChartClick}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="date_label"
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                    domain={
                      chartMode === "vs_target"
                        ? ["auto", "auto"]
                        : percentKpis.every((k) => trend.chart_points.some((p) => p.units[k] === "count"))
                          ? ["auto", "auto"]
                          : [0, 100]
                    }
                    tickFormatter={(v) =>
                      chartMode === "vs_target" ? `${v >= 0 ? "+" : ""}${v}` : `${v}%`
                    }
                  />
                  <Tooltip
                    content={<TrendTooltip kpiIds={percentKpis} mode={chartMode} />}
                  />
                  {chartMode === "performance" && primaryTarget !== null && primaryTarget !== undefined ? (
                    <ReferenceLine
                      y={primaryTarget}
                      stroke={TARGET_LINE_COLOR}
                      strokeDasharray="4 4"
                      label={{
                        value: `Target ${Math.round(primaryTarget)}%`,
                        position: "insideTopRight",
                        fill: TARGET_LINE_COLOR,
                        fontSize: 10,
                      }}
                    />
                  ) : null}
                  {percentKpis.map((kpiId, i) => (
                    <Line
                      key={kpiId}
                      type="monotone"
                      dataKey={kpiId}
                      name={KPI_TREND_CHIP_LABELS[kpiId]}
                      stroke={DASHBOARD_CHART_COLORS[i % DASHBOARD_CHART_COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 3, strokeWidth: 1.5 }}
                      activeDot={{ r: 5 }}
                      connectNulls={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        {showOpenIssues && trend.open_issues_points.length > 0 && (
          <div className="mt-4 border-t border-border/60 pt-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {OPEN_ISSUES_TREND_LABEL}
            </p>
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={trend.open_issues_points}
                  onClick={(state) => {
                    const id = state?.activePayload?.[0]?.payload?.scan_id;
                    if (typeof id === "string") setFocusedScanId(id);
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="date_label"
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: number) => [value, "Open issues"]}
                    labelFormatter={(_, payload) => {
                      const row = payload?.[0]?.payload as { store_name?: string; date_label?: string };
                      return `${row?.date_label ?? ""} · ${row?.store_name ?? ""}`;
                    }}
                  />
                  <Bar dataKey="count" fill="var(--chart-2)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {focusedPoint?.scan_id ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/15 px-3 py-2 text-xs">
            <div className="text-muted-foreground">
              <span className="font-medium text-foreground">{focusedPoint.date_label}</span>
              {" · "}
              {focusedPoint.store_name}
              {focusedPoint.scan_id ? (
                <>
                  {" · "}
                  <span className="font-mono">{focusedPoint.scan_id.slice(0, 8)}…</span>
                </>
              ) : null}
            </div>
            <Link
              to="/results"
              search={{ scan: focusedPoint.scan_id }}
              className="inline-flex items-center gap-1 font-medium text-brand hover:underline"
            >
              Open audit <ArrowRight className="size-3.5" />
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}
