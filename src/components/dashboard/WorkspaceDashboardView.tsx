import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  ClipboardList,
  Gauge,
  HelpCircle,
  ScanLine,
  Store,
  TrendingUp,
} from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip as UiTooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CardSkeleton, EmptyState, ErrorState, Skeleton } from "@/components/States";
import { SectionHeader } from "@/components/dashboard/DashboardParts";
import {
  DASHBOARD_CHART_COLORS,
  DASHBOARD_STATUS_COLORS,
  KPI_DASHBOARD_LABELS,
  SHELF_HEALTH_TOOLTIP,
  effectiveDashboardRole,
  trendKpisForRole,
  type DashboardRoleFilter,
} from "@/lib/dashboard-config";
import type { AuditKpiId } from "@/lib/role-kpi-config";
import { formatNumber, formatPercent, formatQuota, formatScore } from "@/lib/dashboard";
import type { WorkspaceDashboardData } from "@/lib/dashboard-intelligence";
import { cn } from "@/lib/utils";

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--card)",
  fontSize: 12,
} as const;

function KpiCard({
  title,
  value,
  description,
  tooltip,
}: {
  title: string;
  value: string;
  description: string;
  tooltip?: string;
}) {
  return (
    <div className="card-surface p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">
          {title}
        </p>
        {tooltip ? (
          <TooltipProvider>
            <UiTooltip>
              <TooltipTrigger asChild>
                <button type="button" className="text-muted-foreground hover:text-foreground">
                  <HelpCircle className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">{tooltip}</TooltipContent>
            </UiTooltip>
          </TooltipProvider>
        ) : null}
      </div>
      <p className="mt-3 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

export function WorkspaceKpiSummary({
  data,
  isLoading,
  error,
  onRetry,
}: {
  data?: WorkspaceDashboardData["kpis"];
  isLoading: boolean;
  error?: Error | null;
  onRetry?: () => void;
}) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <ErrorState title="Couldn't load KPIs" description={error.message} onRetry={onRetry} />
    );
  }
  if (!data) return null;

  const shelfHealthValue = data.shelf_health_available
    ? data.shelf_health !== null
      ? `${formatScore(data.shelf_health)}/100`
      : "Not enough data"
    : "Not enough data";

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        title="Audits completed"
        value={formatNumber(data.audits_completed)}
        description="Completed shelf audits"
      />
      <KpiCard
        title="Stores covered"
        value={formatNumber(data.stores_covered)}
        description="Stores audited"
      />
      <KpiCard
        title="On-shelf availability"
        value={formatPercent(data.avg_osa)}
        description="Average products available"
      />
      <KpiCard
        title="Planogram compliance"
        value={formatPercent(data.avg_planogram)}
        description="Average shelf execution"
      />
      <KpiCard
        title="Open issues"
        value={formatNumber(data.open_issues)}
        description="Issues needing attention"
      />
      <KpiCard
        title="Issues resolved"
        value={data.issues_resolved_rate !== null ? formatPercent(data.issues_resolved_rate) : "—"}
        description="Resolved after follow-up"
      />
      <KpiCard
        title="Shelf health"
        value={shelfHealthValue}
        description="Overall shelf execution"
        tooltip={SHELF_HEALTH_TOOLTIP}
      />
      <KpiCard
        title="Audits remaining"
        value={formatQuota(data.audits_remaining)}
        description="This month's audit allowance"
      />
    </div>
  );
}

function PriorityBar({ high, medium, low, total }: { high: number; medium: number; low: number; total: number }) {
  if (!total) {
    return <div className="h-3 rounded-full bg-muted/40" />;
  }
  const hp = (high / total) * 100;
  const mp = (medium / total) * 100;
  const lp = (low / total) * 100;
  return (
    <div className="flex h-3 overflow-hidden rounded-full border border-border/60 bg-muted/30">
      {hp > 0 ? <div className={cn("h-full", DASHBOARD_STATUS_COLORS.high)} style={{ width: `${hp}%` }} /> : null}
      {mp > 0 ? <div className={cn("h-full", DASHBOARD_STATUS_COLORS.medium)} style={{ width: `${mp}%` }} /> : null}
      {lp > 0 ? <div className={cn("h-full", DASHBOARD_STATUS_COLORS.low)} style={{ width: `${lp}%` }} /> : null}
    </div>
  );
}

export function WhatNeedsAttentionSection({ data }: { data: WorkspaceDashboardData }) {
  const { issues, issue_rows } = data;
  return (
    <section className="mt-8">
      <SectionHeader
        title="What needs attention"
        description="See the stores, shelves and issues that need action first."
      />
      <div className="card-surface mt-4 p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Total open issues</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{issues.total || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">High priority</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-destructive">{issues.high || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Medium priority</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-warning">{issues.medium || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Low priority</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-brand">{issues.low || "—"}</p>
          </div>
        </div>
        <div className="mt-4">
          <PriorityBar high={issues.high} medium={issues.medium} low={issues.low} total={issues.total} />
        </div>
        {issue_rows.length ? (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="pb-2 pr-3 font-medium">Store</th>
                  <th className="pb-2 pr-3 font-medium">Issue</th>
                  <th className="pb-2 pr-3 font-medium">Priority</th>
                  <th className="pb-2 pr-3 font-medium">Status</th>
                  <th className="pb-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {issue_rows.map((row) => (
                  <tr key={row.id} className="border-b border-border/50 last:border-0">
                    <td className="py-2.5 pr-3 font-medium">{row.store_name}</td>
                    <td className="py-2.5 pr-3 text-muted-foreground">{row.issue}</td>
                    <td className="py-2.5 pr-3">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] capitalize",
                          row.priority === "high" && "border-destructive/40 text-destructive",
                          row.priority === "medium" && "border-warning/40 text-warning",
                        )}
                      >
                        {row.priority}
                      </Badge>
                    </td>
                    <td className="py-2.5 pr-3 text-muted-foreground">{row.status}</td>
                    <td className="py-2.5">
                      {row.scan_id ? (
                        <Link
                          to="/results"
                          search={{ scan: row.scan_id }}
                          className="font-medium text-brand hover:underline"
                        >
                          Review
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-5 text-sm text-muted-foreground">
            No open issues. Your latest audits have no unresolved findings.
          </p>
        )}
        <div className="mt-4 flex justify-end">
          <Button asChild variant="ghost" size="sm" className="rounded-xl text-xs">
            <Link to="/history">
              View all issues <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

export function ShelfPerformanceSection({
  data,
  role,
}: {
  data: WorkspaceDashboardData;
  role: DashboardRoleFilter;
}) {
  const effectiveRole = effectiveDashboardRole(role);
  const availableKpis = trendKpisForRole(effectiveRole);
  const [activeKpis, setActiveKpis] = useState<AuditKpiId[]>(() =>
    availableKpis.slice(0, 3),
  );

  const toggleKpi = (kpi: AuditKpiId) => {
    setActiveKpis((current) =>
      current.includes(kpi) ? current.filter((k) => k !== kpi) : [...current, kpi],
    );
  };

  const chartData = data.performance_trend;

  return (
    <section className="mt-8">
      <SectionHeader
        title="Shelf performance"
        description="Track how your shelves are performing and whether execution is improving over time."
      />
      <div className="card-surface mt-4 p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap gap-2">
          {availableKpis.map((kpi) => (
            <button
              key={kpi}
              type="button"
              onClick={() => toggleKpi(kpi)}
              className={cn(
                "rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors",
                activeKpis.includes(kpi)
                  ? "border-brand bg-brand-soft/60 text-brand"
                  : "border-border text-muted-foreground hover:border-brand/30",
              )}
            >
              {KPI_DASHBOARD_LABELS[kpi]}
            </button>
          ))}
        </div>
        {chartData.length < 2 ? (
          <EmptyState
            title="Not enough trend data"
            description="Complete more audits to see performance trends."
            icon={<BarChart3 className="size-5" />}
          />
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" unit="%" />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {activeKpis.map((kpi, i) => (
                  <Line
                    key={kpi}
                    type="monotone"
                    dataKey={kpi}
                    name={KPI_DASHBOARD_LABELS[kpi]}
                    stroke={DASHBOARD_CHART_COLORS[i % DASHBOARD_CHART_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </section>
  );
}

export function TrackImprovementSection({ data }: { data: WorkspaceDashboardData }) {
  return (
    <section className="mt-8">
      <SectionHeader
        title="Track improvement"
        description="Compare audits over time to see whether issues are actually being fixed."
      />
      <div className="card-surface mt-4 p-5 sm:p-6">
        {!data.improvement?.length ? (
          <p className="text-sm text-muted-foreground">
            Complete another audit to start tracking improvement.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {data.improvement.map((m) => (
              <div key={m.key} className="rounded-xl border border-border/70 bg-muted/20 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {m.label}
                </p>
                <p className="mt-2 text-lg font-semibold tabular-nums">
                  {m.previous} → {m.current}
                </p>
                <p
                  className={cn(
                    "mt-1 text-xs font-medium",
                    m.improved === true && "text-accent-green",
                    m.improved === false && "text-destructive",
                    m.improved === null && "text-muted-foreground",
                  )}
                >
                  {m.change}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function StorePerformanceSection({ data }: { data: WorkspaceDashboardData }) {
  const [sortKey, setSortKey] = useState<"store_name" | "audits" | "osa" | "open_issues">("open_issues");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const rows = useMemo(() => {
    const sorted = [...data.stores];
    sorted.sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === "asc" ? Number(av) - Number(bv) : Number(bv) - Number(av);
    });
    return sorted;
  }, [data.stores, sortKey, sortDir]);

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  return (
    <section className="mt-8">
      <SectionHeader
        title="Store performance"
        description="See which stores are performing well, which need attention and how execution is changing."
      />
      <div className="card-surface mt-4 p-5 sm:p-6">
        {data.stores.length === 1 ? (
          <p className="mb-4 text-xs text-muted-foreground">
            Your workspace currently contains one store with audit data in this period.
          </p>
        ) : null}
        {!rows.length ? (
          <EmptyState
            title="No store data yet"
            description="Run audits across stores to compare execution."
            icon={<Store className="size-5" />}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="cursor-pointer pb-2 pr-3 font-medium" onClick={() => toggleSort("store_name")}>
                    Store
                  </th>
                  <th className="cursor-pointer pb-2 pr-3 font-medium" onClick={() => toggleSort("audits")}>
                    Audits
                  </th>
                  <th className="cursor-pointer pb-2 pr-3 font-medium" onClick={() => toggleSort("osa")}>
                    OSA
                  </th>
                  <th className="pb-2 pr-3 font-medium">Planogram</th>
                  <th className="cursor-pointer pb-2 pr-3 font-medium" onClick={() => toggleSort("open_issues")}>
                    Open Issues
                  </th>
                  <th className="pb-2 font-medium">Change</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.store_id} className="border-b border-border/50 last:border-0">
                    <td className="py-2.5 pr-3 font-medium">{row.store_name}</td>
                    <td className="py-2.5 pr-3 tabular-nums">{row.audits}</td>
                    <td className="py-2.5 pr-3 tabular-nums">{row.osa !== null ? `${Math.round(row.osa)}%` : "—"}</td>
                    <td className="py-2.5 pr-3 tabular-nums">
                      {row.planogram !== null ? `${Math.round(row.planogram)}%` : "—"}
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums">{row.open_issues || "—"}</td>
                    <td
                      className={cn(
                        "py-2.5 tabular-nums",
                        row.change !== null && row.change > 0 && "text-accent-green",
                        row.change !== null && row.change < 0 && "text-destructive",
                      )}
                    >
                      {row.change !== null ? `${row.change >= 0 ? "+" : ""}${row.change} pts` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-4 flex justify-end">
          <Button asChild variant="ghost" size="sm" className="rounded-xl text-xs">
            <Link to="/stores">
              View all stores <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

export function RecentAuditsSection({ data }: { data: WorkspaceDashboardData }) {
  return (
    <section className="mt-8">
      <SectionHeader
        title="Recent audits"
        description="Review your latest shelf visits and see what changed."
      />
      <div className="card-surface mt-4 p-5 sm:p-6">
        {!data.recent_audits.length ? (
          <EmptyState
            title="No audits yet"
            description="Start your first shelf audit to populate this list."
            action={
              <Button asChild variant="brand" size="sm" className="rounded-xl">
                <Link to="/scan">Start new audit</Link>
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="pb-2 pr-3 font-medium">Date</th>
                  <th className="pb-2 pr-3 font-medium">Store</th>
                  <th className="pb-2 pr-3 font-medium">Role</th>
                  <th className="pb-2 pr-3 font-medium">OSA</th>
                  <th className="pb-2 pr-3 font-medium">Planogram</th>
                  <th className="pb-2 font-medium">Issues</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_audits.map((row) => (
                  <tr key={row.scan_id} className="border-b border-border/50 last:border-0">
                    <td className="py-2.5 pr-3">
                      <Link
                        to="/results"
                        search={{ scan: row.scan_id }}
                        className="font-medium text-brand hover:underline"
                      >
                        {new Date(row.date).toLocaleDateString(undefined, {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-3">{row.store_name}</td>
                    <td className="py-2.5 pr-3 capitalize">{row.role}</td>
                    <td className="py-2.5 pr-3 tabular-nums">
                      {row.osa !== null ? `${Math.round(row.osa)}%` : "—"}
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums">
                      {row.planogram !== null ? `${Math.round(row.planogram)}%` : "—"}
                    </td>
                    <td className="py-2.5 tabular-nums">{row.issues || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-4 flex justify-end">
          <Button asChild variant="ghost" size="sm" className="rounded-xl text-xs">
            <Link to="/history">
              View full audit history <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

export function PriorityOpportunitiesSection({ data }: { data: WorkspaceDashboardData }) {
  return (
    <section className="mt-8">
      <SectionHeader
        title="Priority opportunities"
        description="See where a small number of actions could improve shelf execution the most."
      />
      <div className="card-surface mt-4 p-5 sm:p-6">
        {!data.priority_opportunities.length ? (
          <p className="text-sm text-muted-foreground">
            No grouped opportunities in this period — your shelves may already be in good shape, or run more
            planogram-backed audits to surface category-level gaps.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {data.priority_opportunities.map((row) => (
              <div key={row.category} className="rounded-xl border border-border/70 bg-muted/20 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {row.label}
                </p>
                <p className="mt-2 text-2xl font-semibold tabular-nums">{row.count}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">open issues</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function AuditQualitySection({ data }: { data: WorkspaceDashboardData }) {
  const k = data.kpis;
  return (
    <section className="mt-8">
      <SectionHeader
        title="Audit quality"
        description="Operational metrics from your completed audits — not the primary business KPIs."
      />
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Products detected"
          value={formatNumber(k.products_detected)}
          description="Total products across audits"
        />
        <KpiCard
          title="Average AI confidence"
          value={formatPercent(k.average_confidence)}
          description="Recognition confidence"
        />
        <KpiCard
          title="Images processed"
          value={formatNumber(k.images_processed)}
          description="Shelf photos analysed"
        />
        <KpiCard
          title="Audits completed"
          value={formatNumber(k.audits_completed)}
          description="Successfully processed"
        />
      </div>
    </section>
  );
}

export function RoleVisualSection({ data }: { data: WorkspaceDashboardData }) {
  const visual = data.role_visual;
  if (!visual) return null;

  if (visual.kind === "share_of_shelf") {
    return (
      <section className="mt-8">
        <SectionHeader title="Share of shelf" description="Brand shelf presence from your latest audit." />
        <div className="card-surface mt-4 p-5 sm:p-6">
          <div className="flex h-4 overflow-hidden rounded-full border border-border/60">
            {visual.segments.map((seg, i) => (
              <div
                key={seg.label}
                className={cn("h-full", i === 0 ? "bg-brand" : i === 1 ? "bg-brand/60" : "bg-brand/30")}
                style={{ width: `${seg.share}%` }}
                title={`${seg.label} ${seg.share}%`}
              />
            ))}
          </div>
          <ul className="mt-3 space-y-1.5 text-xs">
            {visual.segments.map((seg) => (
              <li key={seg.label} className="flex justify-between gap-2">
                <span className={seg.is_primary ? "font-medium text-brand" : "text-muted-foreground"}>
                  {seg.label}
                </span>
                <span className="tabular-nums">{Math.round(seg.share)}%</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    );
  }

  if (visual.kind === "outlet_execution") {
    return (
      <section className="mt-8">
        <SectionHeader title="Outlet execution" description="Outlet ranking by shelf KPIs." />
        <div className="card-surface mt-4 space-y-3 p-5 sm:p-6">
          {visual.outlets.map((o) => (
            <div key={o.name} className="flex items-center gap-3">
              <span className="w-28 shrink-0 truncate text-xs font-medium">{o.name}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted/40">
                <div
                  className="h-full bg-brand"
                  style={{ width: `${o.osa ?? 0}%` }}
                />
              </div>
              <span className="w-10 shrink-0 text-right text-xs tabular-nums">
                {o.osa !== null ? `${Math.round(o.osa)}%` : "—"}
              </span>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (visual.kind === "location_accuracy") {
    return (
      <section className="mt-8">
        <SectionHeader title="Location accuracy" description="Accuracy by store or location." />
        <div className="card-surface mt-4 space-y-3 p-5 sm:p-6">
          {visual.locations.map((loc) => (
            <div key={loc.label} className="flex items-center gap-3">
              <span className="w-28 shrink-0 truncate text-xs font-medium">{loc.label}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted/40">
                <div
                  className="h-full bg-brand"
                  style={{ width: `${loc.accuracy ?? 0}%` }}
                />
              </div>
              <span className="w-10 shrink-0 text-right text-xs tabular-nums">
                {loc.accuracy !== null ? `${Math.round(loc.accuracy)}%` : "—"}
              </span>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return null;
}

export function WorkspaceDashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
      <Skeleton className="h-48 w-full rounded-2xl" />
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  );
}
