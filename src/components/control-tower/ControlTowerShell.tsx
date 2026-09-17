import { useMemo } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  BarChart3,
  Camera,
  ChevronRight,
  MapPin,
  Package,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { EmptyState, Skeleton } from "@/components/States";
import { cn } from "@/lib/utils";
import type { OperatingModel } from "@/lib/audit-builder/types";
import { OPERATING_MODEL_CARDS } from "@/lib/audit-engine/operating-model-catalog";
import { useGlobalFilters } from "@/lib/global-filters";
import {
  buildDrilldownTrail,
  buildViewAllSearch,
  exportAuditExecutionCsv,
  exportCorrectiveActionsCsv,
  exportEvidenceCoverageCsv,
  exportFindingsCsv,
  exportOperationalTrendCsv,
  exportRecurringIssuesCsv,
  exportRiskLocationsCsv,
  exportRiskSkusCsv,
  nextDrilldownSearch,
  truncateDrilldownSearch,
  useControlTowerDashboard,
  type ControlTowerModelFilter,
  type ControlTowerSearch,
} from "@/lib/control-tower";
import { WorkspaceFilterBar } from "@/components/filters/GlobalFilterBarShell";
import { DashboardSectionHeader } from "./DashboardSectionHeader";
import { ControlTowerMetricsBoard } from "./ControlTowerMetricsBoard";
import { DashboardAuditsTable } from "./DashboardAuditsTable";
import { DashboardVisualBoard } from "./DashboardVisualBoard";
import { AISLIX, AISLIX_CHART, AISLIX_MODEL_SURFACE, AISLIX_STATUS_MIX } from "@/lib/aislix-theme";


const MODEL_OPTIONS: { value: ControlTowerModelFilter; label: string }[] = [
  { value: "all", label: "All" },
  ...OPERATING_MODEL_CARDS.filter((c) => c.id !== "custom").map((c) => ({
    value: c.id as OperatingModel,
    label: c.title,
  })),
];

const STATUS_COLORS: Record<string, string> = AISLIX_STATUS_MIX;

function EmptyBlock({ title }: { title: string }) {
  return (
    <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
      {title}
    </p>
  );
}

export function ControlTowerShell({
  search,
  routePath,
}: {
  search: ControlTowerSearch;
  routePath: "/dashboard" | "/dashboard/my-performance" | "/dashboard/executive";
}) {
  const navigate = useNavigate();
  const { filters } = useGlobalFilters();
  const model = search.model ?? "all";
  const query = useControlTowerDashboard(model, filters);
  const trail = useMemo(() => buildDrilldownTrail(search), [search]);
  const viewAll = (extra?: Record<string, string | undefined>) =>
    buildViewAllSearch(search, filters, extra);

  const setModel = (next: ControlTowerModelFilter) => {
    void navigate({ to: routePath, search: { ...search, model: next === "all" ? undefined : next } });
  };

  const drillTo = (level: Parameters<typeof nextDrilldownSearch>[1], value: string) => {
    void navigate({
      to: routePath,
      search: nextDrilldownSearch(search, level, value),
    });
  };

  const drillBack = (level: Parameters<typeof truncateDrilldownSearch>[1]) => {
    void navigate({ to: routePath, search: truncateDrilldownSearch(search, level) });
  };

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full rounded-2xl" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (query.error || !query.data) {
    return (
      <EmptyState
        title="Could not load Control Tower"
        description={query.error instanceof Error ? query.error.message : "Try refreshing the page."}
      />
    );
  }

  const data = query.data;
  const locLabel = data.terminology.locationPlural;

  return (
    <div className="space-y-8">
      <LiveBanner templateCount={data.templateCount} categories={data.templateCategories} model={model} />

      {routePath === "/dashboard" ? (
        <div className="space-y-3">
          <WorkspaceFilterBar />
          <DashboardAuditsTable
            rows={data.auditExecutionFull}
            onDownloadCsv={() => exportAuditExecutionCsv(data, filters)}
          />
        </div>
      ) : (
        <DashboardAuditsTable
          rows={data.auditExecutionFull}
          onDownloadCsv={() => exportAuditExecutionCsv(data, filters)}
        />
      )}

      <section className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Operating Model
          </p>
          <OperatingModelSwitcher value={model} onChange={setModel} />
          <p className="mt-2 text-xs text-muted-foreground">
            {locLabel}: contextual labels · {data.templateCount} org templates in scope
          </p>
        </div>
      </section>

      {trail.length > 1 ? <DrilldownTrail trail={trail} onNavigate={drillBack} /> : null}

      <section>
        <DashboardSectionHeader
          title="Universal KPIs"
          description="Live counts from assignments, findings, and corrective actions."
          viewAllTo="/dashboard/kpis"
          viewAllSearch={viewAll()}
          onDownloadCsv={() => {
            import("@/lib/control-tower/exports").then(({ exportKpiCsv }) => exportKpiCsv(data, filters));
          }}
          downloadLabel="Download KPI CSV"
        />
        <ControlTowerMetricsBoard data={data} onDrill={(kpi) => drillTo("kpi", kpi.label)} />
      </section>

      <section className="space-y-3">
        <DashboardSectionHeader
          title="Visual overview"
          description="Health dials, strengths radar, risk heatmap and audits vs problems."
        />
        <DashboardVisualBoard data={data} />
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="card-surface overflow-hidden">
          <CardHeader className="border-b border-border/60 bg-muted/20 pb-3">
            <DashboardSectionHeader
              title="Audit Execution"
              description="Assignment status in the selected period"
              viewAllTo="/dashboard/audit-execution"
              viewAllSearch={viewAll()}
              onDownloadCsv={() => exportAuditExecutionCsv(data, filters)}
              downloadLabel="Download Audit Execution CSV"
            />
          </CardHeader>
          <CardContent className="pt-4">
            {data.auditStatus.every((b) => b.value === 0) ? (
              <EmptyBlock title="No assignments in this period" />
            ) : (
              <div className="space-y-4">
                <div className="flex h-3 overflow-hidden rounded-full border border-[var(--aislix-border)]">
                  {data.auditStatus.map((b) => {
                    const total = data.auditStatus.reduce((sum, row) => sum + row.value, 0) || 1;
                    return (
                      <span
                        key={b.name}
                        className="h-full"
                        style={{
                          width: `${(b.value / total) * 100}%`,
                          background: b.color ?? STATUS_COLORS[b.name] ?? AISLIX.primary,
                        }}
                      />
                    );
                  })}
                </div>
                <div className="space-y-2">
                  {data.auditStatus.map((b) => (
                    <div key={b.name} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span
                          className="size-2.5 rounded-full"
                          style={{
                            background: b.color ?? STATUS_COLORS[b.name] ?? AISLIX.primary,
                          }}
                        />
                        {b.name}
                      </span>
                      <span className="font-semibold tabular-nums">{b.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="card-surface overflow-hidden">
          <CardHeader className="border-b border-border/60 bg-muted/20 pb-3">
            <DashboardSectionHeader
              title="Operational Trend"
              description="Audits completed vs findings over the selected period"
              viewAllTo="/dashboard/operational-trend"
              viewAllSearch={viewAll()}
              onDownloadCsv={() => exportOperationalTrendCsv(data, filters)}
              downloadLabel="Download Trend CSV"
            />
          </CardHeader>
          <CardContent className="pt-4">
            {data.operationalTrend.length === 0 ? (
              <EmptyBlock title="No trend data in this period" />
            ) : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.operationalTrend}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    {data.operationalTrendMetrics.map((m, i) => (
                      <Area
                        key={m.key}
                        type="monotone"
                        dataKey={m.key}
                        name={m.label}
                        stroke={m.color || AISLIX_CHART[i % AISLIX_CHART.length]}
                        fill={m.color || AISLIX_CHART[i % AISLIX_CHART.length]}
                        fillOpacity={0.12}
                        strokeWidth={2}
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="card-surface">
          <CardHeader className="pb-2">
            <DashboardSectionHeader
              title={`Top Risk ${locLabel}`}
              description="Ranked by open high/critical findings"
              viewAllTo="/dashboard/risk-locations"
              viewAllSearch={viewAll()}
              onDownloadCsv={() => exportRiskLocationsCsv(data, filters)}
              downloadLabel="Download Store Risk CSV"
            />
          </CardHeader>
          <CardContent className="space-y-3">
            {data.riskLocations.length === 0 ? (
              <EmptyBlock title="No open findings to rank locations" />
            ) : (
              <>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.riskLocations} layout="vertical" margin={{ left: 8 }}>
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                        {data.riskLocations.map((entry) => (
                          <Cell
                            key={entry.id}
                            fill={
                              entry.score >= 80
                                ? AISLIX.darkstoreBg
                                : entry.score >= 70
                                  ? AISLIX.warehouseBg
                                  : AISLIX.supermarketBg
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {data.riskLocations.map((loc) => (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => drillTo("location", loc.name)}
                    className="flex w-full items-center gap-3 rounded-xl border border-border p-3 text-left transition-colors hover:bg-muted/50"
                  >
                    <MapPin className="size-4 shrink-0 text-brand" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{loc.name}</p>
                      <p className="text-xs text-muted-foreground">{loc.metric}</p>
                    </div>
                    <Badge variant={loc.score >= 80 ? "destructive" : "secondary"}>{loc.score}</Badge>
                  </button>
                ))}
              </>
            )}
          </CardContent>
        </Card>

        <Card className="card-surface">
          <CardHeader className="pb-2">
            <DashboardSectionHeader
              title="Top Risk SKUs"
              description="Highest-impact SKUs from open findings"
              viewAllTo="/dashboard/risk-skus"
              viewAllSearch={viewAll()}
              onDownloadCsv={() => exportRiskSkusCsv(data, filters)}
              downloadLabel="Download SKU Risk CSV"
            />
          </CardHeader>
          <CardContent className="space-y-2">
            {data.riskSkus.length === 0 ? (
              <EmptyBlock title="No SKU findings in this period" />
            ) : (
              data.riskSkus.map((sku) => (
                <button
                  key={sku.id}
                  type="button"
                  onClick={() => drillTo("sku", sku.sku)}
                  className="flex w-full items-center gap-3 rounded-xl border border-border p-3 text-left text-sm hover:bg-muted/50"
                >
                  <Package className="size-4 text-brand" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{sku.sku}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {sku.product} · {sku.location}
                    </p>
                  </div>
                  <Badge variant="outline">{sku.score}</Badge>
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="card-surface border-[var(--aislix-darkstore-border)]">
        <CardHeader className="pb-2">
          <DashboardSectionHeader
            title="Critical Findings"
            description="Unresolved high and critical findings"
            viewAllTo="/findings"
            viewAllSearch={viewAll({ severity: "critical" })}
            onDownloadCsv={() => exportFindingsCsv(data, filters)}
            downloadLabel="Download Findings CSV"
          />
        </CardHeader>
        <CardContent className="space-y-2">
          {data.criticalFindings.length === 0 ? (
            <EmptyBlock title="No unresolved high or critical findings" />
          ) : (
            data.criticalFindings.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => drillTo("finding", f.id)}
                className="flex w-full flex-wrap items-center gap-2 rounded-xl border border-[var(--aislix-darkstore-border)] bg-[var(--aislix-darkstore-bg)] p-3 text-left text-sm transition-colors hover:bg-white/70"
              >
                <AlertTriangle className="size-4 text-[var(--aislix-primary)]" />
                <Badge variant="destructive">{f.severity}</Badge>
                <span className="font-medium">{f.location}</span>
                <span className="text-muted-foreground">· {f.sku}</span>
                <span className="flex-1 truncate text-muted-foreground">{f.issue}</span>
                <ChevronRight className="size-4 text-muted-foreground" />
              </button>
            ))
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card className="card-surface">
          <CardHeader className="pb-2">
            <DashboardSectionHeader
              title="Corrective Action Health"
              description="Open workload from live corrective actions"
              viewAllTo="/corrective-actions"
              viewAllSearch={viewAll()}
              onDownloadCsv={() => exportCorrectiveActionsCsv(data, filters)}
              downloadLabel="Download Actions CSV"
            />
          </CardHeader>
          <CardContent>
            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {[
                { label: "Open", value: data.correctiveActionHealth.open, surface: "bg-[var(--aislix-warehouse-bg)] border-[var(--aislix-warehouse-border)]" },
                { label: "Due Today", value: data.correctiveActionHealth.dueToday, surface: "bg-[var(--aislix-local-bg)] border-[var(--aislix-local-border)]" },
                { label: "Overdue", value: data.correctiveActionHealth.overdue, surface: "bg-[var(--aislix-darkstore-bg)] border-[var(--aislix-darkstore-border)]" },
                {
                  label: "Pending Verification",
                  value: data.correctiveActionHealth.pendingVerification,
                  surface: "bg-[var(--aislix-custom-bg)] border-[var(--aislix-custom-border)]",
                },
                { label: "Closed", value: data.correctiveActionHealth.closed, surface: "bg-[var(--aislix-supermarket-bg)] border-[var(--aislix-supermarket-border)]" },
              ].map((item) => (
                <div key={item.label} className={cn("rounded-lg border p-3 text-center", item.surface)}>
                  <p className="text-xl font-semibold tabular-nums text-[var(--aislix-primary)]">{item.value}</p>
                  <p className="text-[10px] text-muted-foreground">{item.label}</p>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              {data.correctiveActions.length === 0 ? (
                <EmptyBlock title="No open corrective actions" />
              ) : (
                data.correctiveActions.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => drillTo("action", a.id)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg border border-border p-2.5 text-left text-sm hover:bg-muted/50"
                  >
                    <div>
                      <p className="font-medium">{a.location}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.owner} · {a.due}
                      </p>
                    </div>
                    <Badge variant="outline">{a.status}</Badge>
                  </button>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="card-surface">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">SLA & Escalations</CardTitle>
            <CardDescription>Overdue and due-today from live actions. SLA % is not wired yet.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-end justify-between">
              <div>
                <p className={cn("text-3xl font-semibold", data.sla.available ? "text-[var(--aislix-primary)]" : "text-muted-foreground")}>
                  {data.sla.available ? `${data.sla.compliancePct}%` : "N/A"}
                </p>
                <p className="text-xs text-muted-foreground">SLA compliance</p>
              </div>
              <ShieldCheck className="size-8 text-brand opacity-80" />
            </div>
            {data.sla.available ? <Progress value={data.sla.compliancePct} className="h-2" /> : null}
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-lg border border-[var(--aislix-darkstore-border)] bg-[var(--aislix-darkstore-bg)] p-2">
                <p className="font-semibold text-[var(--aislix-primary)]">{data.sla.overdue}</p>
                <p className="text-muted-foreground">Overdue</p>
              </div>
              <div className="rounded-lg border border-[var(--aislix-warehouse-border)] bg-[var(--aislix-warehouse-bg)] p-2">
                <p className="font-semibold text-[var(--aislix-primary)]">{data.sla.dueToday}</p>
                <p className="text-muted-foreground">Due today</p>
              </div>
              <div className="rounded-lg border border-[var(--aislix-custom-border)] bg-[var(--aislix-custom-bg)] p-2">
                <p className="font-semibold text-[var(--aislix-primary)]">{data.sla.breached}</p>
                <p className="text-muted-foreground">Breached</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="w-full" asChild>
              <Link to="/escalation-settings">SLA configuration</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="card-surface">
          <CardHeader className="pb-2">
            <DashboardSectionHeader
              title="Evidence Coverage"
              description="Verified vs required evidence units — not wired yet"
              viewAllTo="/dashboard/evidence-coverage"
              viewAllSearch={viewAll()}
              onDownloadCsv={() => exportEvidenceCoverageCsv(data, filters)}
              downloadLabel="Download Evidence CSV"
            />
          </CardHeader>
          <CardContent className="space-y-3">
            {data.evidenceCoverage.available ? (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Camera className="size-4" /> Verified / required
                  </span>
                  <span className="font-semibold">{data.evidenceCoverage.pct}%</span>
                </div>
                <Progress value={data.evidenceCoverage.pct} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {data.evidenceCoverage.verified} of {data.evidenceCoverage.required} required evidence units
                </p>
              </>
            ) : (
              <EmptyBlock title="Evidence coverage is not wired yet" />
            )}
            <Button variant="outline" size="sm" className="w-full" onClick={() => drillTo("evidence", "coverage")}>
              Drill to evidence
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="card-surface">
        <CardHeader className="pb-2">
          <DashboardSectionHeader
            title="Recurring Issues"
            description="RCA codes that appear more than once"
            viewAllTo="/exceptions"
            viewAllSearch={viewAll()}
            onDownloadCsv={() => exportRecurringIssuesCsv(data, filters)}
            downloadLabel="Download Recurring Issues CSV"
          />
        </CardHeader>
        <CardContent>
          {data.recurringIssues.length === 0 ? (
            <EmptyBlock title="No recurring RCA patterns in this period" />
          ) : (
            <>
              <div className="mb-4 h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.recurringIssues}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="issue" tick={{ fontSize: 9 }} interval={0} angle={-12} height={48} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="frequency" fill={AISLIX.darkstoreBg} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {data.recurringIssues.map((r) => (
                  <div
                    key={r.id}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3 text-sm"
                  >
                    <RefreshCw className="size-4 text-[var(--aislix-primary)]" />
                    <span className="flex-1 font-medium">{r.issue}</span>
                    <Badge variant="outline">{r.frequency}×</Badge>
                    <span className="text-xs text-muted-foreground">{r.locations} locations</span>
                    <span className="text-xs text-muted-foreground">Last: {r.lastSeen}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {search.drill && search.drill !== "overview" ? (
        <DrilldownPanel search={search} terminology={data.terminology} onDrill={drillTo} />
      ) : null}
    </div>
  );
}

function LiveBanner({
  templateCount,
  categories,
  model,
}: {
  templateCount: number;
  categories: string[];
  model: ControlTowerModelFilter;
}) {
  return (
    <div className="rounded-2xl border border-[var(--aislix-warehouse-border)] bg-[var(--aislix-warehouse-bg)] p-4 text-foreground">
      <p className="text-sm font-semibold">Live universal KPIs</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Completion, findings, and corrective actions use production data for{" "}
        <strong>{model === "all" ? "all operating models" : model.replace(/_/g, " ")}</strong>
        {templateCount ? ` (${templateCount} org templates${categories.length ? `: ${categories.slice(0, 4).join(", ")}` : ""}${categories.length > 4 ? "…" : ""})` : ""}.
        Template qty/expiry/facing metrics come next.
      </p>
    </div>
  );
}

function OperatingModelSwitcher({
  value,
  onChange,
}: {
  value: ControlTowerModelFilter;
  onChange: (v: ControlTowerModelFilter) => void;
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5 rounded-xl border border-border bg-muted/20 p-1.5">
      {MODEL_OPTIONS.map((opt) => {
        const tint = AISLIX_MODEL_SURFACE[opt.value] ?? AISLIX_MODEL_SURFACE.custom;
        const active = value === opt.value;
        return (
          <Button
            key={opt.value}
            size="sm"
            variant="ghost"
            className={cn(
              "rounded-lg border text-xs font-medium",
              active ? "shadow-sm" : "border-transparent",
            )}
            style={
              active
                ? { backgroundColor: tint.bg, borderColor: tint.border, color: AISLIX.primary }
                : undefined
            }
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </Button>
        );
      })}
    </div>
  );
}

function DrilldownTrail({
  trail,
  onNavigate,
}: {
  trail: { level: string; label: string }[];
  onNavigate: (level: Parameters<typeof truncateDrilldownSearch>[1]) => void;
}) {
  return (
    <nav className="flex flex-wrap items-center gap-1 rounded-xl border border-border bg-muted/20 px-3 py-2 text-sm">
      {trail.map((item, i) => (
        <span key={`${item.level}-${item.label}`} className="flex items-center gap-1">
          {i > 0 ? <ChevronRight className="size-3.5 text-muted-foreground" /> : null}
          <button
            type="button"
            onClick={() => onNavigate(item.level as Parameters<typeof truncateDrilldownSearch>[1])}
            className={cn(
              "rounded-md px-1.5 py-0.5 transition-colors hover:bg-muted",
              i === trail.length - 1 ? "font-medium text-brand" : "text-muted-foreground",
            )}
          >
            {item.label}
          </button>
        </span>
      ))}
    </nav>
  );
}

function DrilldownPanel({
  search,
  terminology,
  onDrill,
}: {
  search: ControlTowerSearch;
  terminology: { location: string; subLocation: string; productScope: string };
  onDrill: (level: Parameters<typeof nextDrilldownSearch>[1], value: string) => void;
}) {
  const level = search.drill ?? "kpi";

  return (
    <Card className="rounded-2xl border-[var(--aislix-warehouse-border)] bg-[var(--aislix-warehouse-bg)]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="size-4" /> Drilldown — {level}
        </CardTitle>
        <CardDescription>
          Preserves operating model and filter context in URL search params.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {search.kpi ? (
          <p>
            <strong>KPI:</strong> {search.kpi}
          </p>
        ) : null}
        {search.location ? (
          <p>
            <strong>{terminology.location}:</strong> {search.location}
          </p>
        ) : null}
        {search.finding ? (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => onDrill("action", "linked-action")}>
              → Corrective action
            </Button>
            <Button size="sm" variant="outline" onClick={() => onDrill("evidence", "linked-evidence")}>
              → Evidence
            </Button>
            <Button size="sm" variant="brand" onClick={() => onDrill("verification", "pending")}>
              → Verification
            </Button>
          </div>
        ) : null}
        {!search.location && search.kpi ? (
          <Button size="sm" variant="outline" asChild>
            <Link to="/findings">Open findings</Link>
          </Button>
        ) : null}
        {search.location && !search.category ? (
          <Button size="sm" variant="outline" asChild>
            <Link to="/findings">Findings for this location</Link>
          </Button>
        ) : null}
        <div className="flex gap-2 pt-2">
          <Button size="sm" variant="ghost" asChild>
            <Link to="/findings">Findings</Link>
          </Button>
          <Button size="sm" variant="ghost" asChild>
            <Link to="/corrective-actions">Actions</Link>
          </Button>
          <Button size="sm" variant="ghost" asChild>
            <Link to="/history">Audit history</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
