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

  Line,

  LineChart,

  Pie,

  PieChart,

  ResponsiveContainer,

  Tooltip,

  XAxis,

  YAxis,

} from "recharts";



import { Badge } from "@/components/ui/badge";

import { Button } from "@/components/ui/button";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { Progress } from "@/components/ui/progress";

import { cn } from "@/lib/utils";

import type { OperatingModel } from "@/lib/audit-builder/types";

import { OPERATING_MODEL_CARDS } from "@/lib/audit-engine/operating-model-catalog";

import { useGlobalFilters } from "@/lib/global-filters";

import {

  buildControlTowerDemo,

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

  type ControlTowerKpi,

  type ControlTowerModelFilter,

  type ControlTowerSearch,

} from "@/lib/control-tower";

import { DashboardSectionHeader } from "./DashboardSectionHeader";

import { KpiCardVisual } from "./KpiCardVisual";



const MODEL_OPTIONS: { value: ControlTowerModelFilter; label: string }[] = [

  { value: "all", label: "All" },

  ...OPERATING_MODEL_CARDS.filter((c) => c.id !== "custom").map((c) => ({

    value: c.id as OperatingModel,

    label: c.title,

  })),

];



const STATUS_COLORS: Record<string, string> = {

  Assigned: "hsl(var(--muted-foreground))",

  "In Progress": "hsl(var(--brand))",

  Submitted: "hsl(var(--warning))",

  Approved: "hsl(var(--accent-green))",

  Overdue: "hsl(var(--destructive))",

};



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

  const data = useMemo(() => buildControlTowerDemo(model), [model]);

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



  const locLabel = data.terminology.locationPlural;

  const modelLabel = MODEL_OPTIONS.find((m) => m.value === model)?.label ?? "All";



  return (

    <div className="space-y-8">

      <DemoBanner templateCount={data.templateCount} categories={data.templateCategories} model={model} />



      <section className="space-y-4">

        <div>

          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">

            Operating Model

          </p>

          <OperatingModelSwitcher value={model} onChange={setModel} />

          <p className="mt-2 text-xs text-muted-foreground">

            {locLabel}: contextual labels · {data.templateCount} system templates in scope

          </p>

        </div>

      </section>



      {trail.length > 1 ? <DrilldownTrail trail={trail} onNavigate={drillBack} /> : null}



      <section>

        <DashboardSectionHeader

          title="Universal KPIs"

          description="Shared definitions across all operating models."

          viewAllTo="/dashboard/kpis"

          viewAllSearch={viewAll()}

          onDownloadCsv={() => {

            import("@/lib/control-tower/exports").then(({ exportKpiCsv }) =>

              exportKpiCsv(data, filters),

            );

          }}

          downloadLabel="Download KPI CSV"

        />

        <KpiGrid kpis={data.universalKpis} onDrill={(kpi) => drillTo("kpi", kpi.label)} />

      </section>



      {data.contextualKpis.length > 0 ? (

        <section>

          <DashboardSectionHeader

            title={`${modelLabel} KPIs`}

            description="Contextual metrics for the selected operating model."

            viewAllTo="/dashboard/kpis"

            viewAllSearch={viewAll({ scope: "contextual" })}

            onDownloadCsv={() => {

              import("@/lib/control-tower/exports").then(({ exportKpiCsv }) =>

                exportKpiCsv(data, filters),

              );

            }}

          />

          <KpiGrid kpis={data.contextualKpis} onDrill={(kpi) => drillTo("kpi", kpi.label)} />

        </section>

      ) : null}



      <section>

        <DashboardSectionHeader

          title="Audit-Specific Metrics"

          description={

            data.auditSpecificKpis.length

              ? "Metrics derived from the fields and rules configured in the selected audit templates."

              : "Your audit contains custom fields but no configured analytical metrics yet."

          }

          viewAllTo="/dashboard/kpis"

          viewAllSearch={viewAll({ scope: "audit_specific" })}

          onDownloadCsv={() => {

            import("@/lib/control-tower/exports").then(({ exportKpiCsv }) =>

              exportKpiCsv(data, filters),

            );

          }}

          downloadLabel="Download CSV"

        />

        {data.auditSpecificKpis.length > 0 ? (

          <KpiGrid kpis={data.auditSpecificKpis} onDrill={(kpi) => drillTo("kpi", kpi.label)} />

        ) : (

          <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">

            No audit-specific metrics apply to the current template scope. Map standard fields such as

            Expected Qty, Actual Qty, Expiry Date or QC Status in your audit templates to enable

            automatic metrics.

          </p>

        )}

      </section>



      <div className="grid gap-4 xl:grid-cols-2">

        <Card className="card-surface overflow-hidden">

          <CardHeader className="border-b border-border/60 bg-muted/20 pb-3">

            <DashboardSectionHeader

              title="Audit Execution"

              description="Assignment status distribution (illustrative demo)"

              viewAllTo="/dashboard/audit-execution"

              viewAllSearch={viewAll()}

              onDownloadCsv={() => exportAuditExecutionCsv(data, filters)}

              downloadLabel="Download Audit Execution CSV"

            />

          </CardHeader>

          <CardContent className="pt-4">

            <div className="grid gap-4 md:grid-cols-2">

              <div className="h-52">

                <ResponsiveContainer width="100%" height="100%">

                  <PieChart>

                    <Pie

                      data={data.auditStatus}

                      dataKey="value"

                      nameKey="name"

                      innerRadius={48}

                      outerRadius={72}

                      paddingAngle={2}

                    >

                      {data.auditStatus.map((entry) => (

                        <Cell

                          key={entry.name}

                          fill={entry.color ?? STATUS_COLORS[entry.name] ?? "hsl(var(--brand))"}

                        />

                      ))}

                    </Pie>

                    <Tooltip />

                  </PieChart>

                </ResponsiveContainer>

              </div>

              <div className="space-y-2">

                {data.auditStatus.map((b) => (

                  <div key={b.name} className="flex items-center justify-between text-sm">

                    <span className="flex items-center gap-2">

                      <span

                        className="size-2.5 rounded-full"

                        style={{

                          background: b.color ?? STATUS_COLORS[b.name] ?? "hsl(var(--brand))",

                        }}

                      />

                      {b.name}

                    </span>

                    <span className="font-semibold tabular-nums">{b.value}</span>

                  </div>

                ))}

              </div>

            </div>

          </CardContent>

        </Card>



        <Card className="card-surface overflow-hidden">

          <CardHeader className="border-b border-border/60 bg-muted/20 pb-3">

            <DashboardSectionHeader

              title="Operational Trend"

              description={`${modelLabel} metrics over time (illustrative demo)`}

              viewAllTo="/dashboard/operational-trend"

              viewAllSearch={viewAll()}

              onDownloadCsv={() => exportOperationalTrendCsv(data, filters)}

              downloadLabel="Download Trend CSV"

            />

          </CardHeader>

          <CardContent className="pt-4">

            <div className="h-56">

              <ResponsiveContainer width="100%" height="100%">

                <AreaChart data={data.operationalTrend}>

                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />

                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />

                  <YAxis tick={{ fontSize: 11 }} />

                  <Tooltip />

                  {data.operationalTrendMetrics.map((m) => (

                    <Area

                      key={m.key}

                      type="monotone"

                      dataKey={m.key}

                      name={m.label}

                      stroke={m.color}

                      fill={m.color}

                      fillOpacity={0.12}

                      strokeWidth={2}

                    />

                  ))}

                </AreaChart>

              </ResponsiveContainer>

            </div>

          </CardContent>

        </Card>

      </div>



      <div className="grid gap-4 xl:grid-cols-2">

        <Card className="card-surface">

          <CardHeader className="pb-2">

            <DashboardSectionHeader

              title={`Top Risk ${locLabel}`}

              description="Ranked by primary risk metric (demo)"

              viewAllTo="/dashboard/risk-locations"

              viewAllSearch={viewAll()}

              onDownloadCsv={() => exportRiskLocationsCsv(data, filters)}

              downloadLabel="Download Store Risk CSV"

            />

          </CardHeader>

          <CardContent className="space-y-3">

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

                            ? "hsl(var(--destructive))"

                            : entry.score >= 70

                              ? "hsl(var(--warning))"

                              : "hsl(var(--brand))"

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

          </CardContent>

        </Card>



        <Card className="card-surface">

          <CardHeader className="pb-2">

            <DashboardSectionHeader

              title="Top Risk SKUs"

              description="Highest-impact product risks (demo)"

              viewAllTo="/dashboard/risk-skus"

              viewAllSearch={viewAll()}

              onDownloadCsv={() => exportRiskSkusCsv(data, filters)}

              downloadLabel="Download SKU Risk CSV"

            />

          </CardHeader>

          <CardContent className="space-y-2">

            {data.riskSkus.map((sku) => (

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

            ))}

          </CardContent>

        </Card>

      </div>



      <Card className="card-surface border-destructive/20">

        <CardHeader className="pb-2">

          <DashboardSectionHeader

            title="Critical Findings"

            description="Prioritized issues requiring action (illustrative demo)"

            viewAllTo="/findings"

            viewAllSearch={viewAll({ severity: "critical" })}

            onDownloadCsv={() => exportFindingsCsv(data, filters)}

            downloadLabel="Download Findings CSV"

          />

        </CardHeader>

        <CardContent className="space-y-2">

          {data.criticalFindings.map((f) => (

            <button

              key={f.id}

              type="button"

              onClick={() => drillTo("finding", f.id)}

              className="flex w-full flex-wrap items-center gap-2 rounded-xl border border-border bg-destructive/5 p-3 text-left text-sm transition-colors hover:bg-destructive/10"

            >

              <AlertTriangle className="size-4 text-destructive" />

              <Badge variant="destructive">{f.severity}</Badge>

              <span className="font-medium">{f.location}</span>

              <span className="text-muted-foreground">· {f.sku}</span>

              <span className="flex-1 truncate text-muted-foreground">{f.issue}</span>

              <ChevronRight className="size-4 text-muted-foreground" />

            </button>

          ))}

        </CardContent>

      </Card>



      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">

        <Card className="card-surface">

          <CardHeader className="pb-2">

            <DashboardSectionHeader

              title="Corrective Action Health"

              description="Open workload distribution (demo)"

              viewAllTo="/corrective-actions"

              viewAllSearch={viewAll()}

              onDownloadCsv={() => exportCorrectiveActionsCsv(data, filters)}

              downloadLabel="Download Actions CSV"

            />

          </CardHeader>

          <CardContent>

            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">

              {[

                { label: "Open", value: data.correctiveActionHealth.open, tone: "text-brand" },

                { label: "Due Today", value: data.correctiveActionHealth.dueToday, tone: "text-warning" },

                { label: "Overdue", value: data.correctiveActionHealth.overdue, tone: "text-destructive" },

                {

                  label: "Pending Verification",

                  value: data.correctiveActionHealth.pendingVerification,

                  tone: "text-muted-foreground",

                },

                { label: "Closed", value: data.correctiveActionHealth.closed, tone: "text-success" },

              ].map((item) => (

                <div key={item.label} className="rounded-lg border border-border bg-muted/30 p-3 text-center">

                  <p className={cn("text-xl font-semibold tabular-nums", item.tone)}>{item.value}</p>

                  <p className="text-[10px] text-muted-foreground">{item.label}</p>

                </div>

              ))}

            </div>

            <div className="space-y-2">

              {data.correctiveActions.map((a) => (

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

              ))}

            </div>

          </CardContent>

        </Card>



        <Card className="card-surface">

          <CardHeader className="pb-2">

            <CardTitle className="text-base">SLA & Escalations</CardTitle>

            <CardDescription>Resolution performance (demo)</CardDescription>

          </CardHeader>

          <CardContent className="space-y-4">

            <div className="flex items-end justify-between">

              <div>

                <p className="text-3xl font-semibold text-success">{data.sla.compliancePct}%</p>

                <p className="text-xs text-muted-foreground">SLA compliance</p>

              </div>

              <ShieldCheck className="size-8 text-brand opacity-80" />

            </div>

            <Progress value={data.sla.compliancePct} className="h-2" />

            <div className="grid grid-cols-3 gap-2 text-center text-xs">

              <div className="rounded-lg bg-destructive/10 p-2">

                <p className="font-semibold text-destructive">{data.sla.overdue}</p>

                <p className="text-muted-foreground">Overdue</p>

              </div>

              <div className="rounded-lg bg-warning/10 p-2">

                <p className="font-semibold text-warning">{data.sla.dueToday}</p>

                <p className="text-muted-foreground">Due today</p>

              </div>

              <div className="rounded-lg bg-muted/50 p-2">

                <p className="font-semibold">{data.sla.breached}</p>

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

              description="Verified vs required evidence units (demo)"

              viewAllTo="/dashboard/evidence-coverage"

              viewAllSearch={viewAll()}

              onDownloadCsv={() => exportEvidenceCoverageCsv(data, filters)}

              downloadLabel="Download Evidence CSV"

            />

          </CardHeader>

          <CardContent className="space-y-3">

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

            description="Historical finding patterns (illustrative demo)"

            viewAllTo="/exceptions"

            viewAllSearch={viewAll()}

            onDownloadCsv={() => exportRecurringIssuesCsv(data, filters)}

            downloadLabel="Download Recurring Issues CSV"

          />

        </CardHeader>

        <CardContent>

          <div className="mb-4 h-36">

            <ResponsiveContainer width="100%" height="100%">

              <BarChart data={data.recurringIssues}>

                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />

                <XAxis dataKey="issue" tick={{ fontSize: 9 }} interval={0} angle={-12} height={48} />

                <YAxis tick={{ fontSize: 11 }} />

                <Tooltip />

                <Bar dataKey="frequency" fill="hsl(var(--warning))" radius={[4, 4, 0, 0]} />

              </BarChart>

            </ResponsiveContainer>

          </div>

          <div className="space-y-2">

            {data.recurringIssues.map((r) => (

              <div

                key={r.id}

                className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3 text-sm"

              >

                <RefreshCw className="size-4 text-warning" />

                <span className="flex-1 font-medium">{r.issue}</span>

                <Badge variant="outline">{r.frequency}×</Badge>

                <span className="text-xs text-muted-foreground">{r.locations} locations</span>

                <span className="text-xs text-muted-foreground">Last: {r.lastSeen}</span>

              </div>

            ))}

          </div>

        </CardContent>

      </Card>



      {search.drill && search.drill !== "overview" ? (

        <DrilldownPanel search={search} terminology={data.terminology} onDrill={drillTo} />

      ) : null}

    </div>

  );

}



function DemoBanner({

  templateCount,

  categories,

  model,

}: {

  templateCount: number;

  categories: string[];

  model: ControlTowerModelFilter;

}) {

  return (

    <div className="rounded-2xl border border-amber-300/80 bg-amber-50/90 p-4 text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">

      <p className="text-sm font-semibold">Illustrative demo data — Phase 1E</p>

      <p className="mt-1 text-xs opacity-90">

        KPIs and charts use template-registry definitions for{" "}

        <strong>{model === "all" ? "all operating models" : model.replace(/_/g, " ")}</strong> (

        {templateCount} templates: {categories.slice(0, 5).join(", ")}

        {categories.length > 5 ? "…" : ""}). Values are not live production metrics. Phase 2 wires live KPIs.

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

      {MODEL_OPTIONS.map((opt) => (

        <Button

          key={opt.value}

          size="sm"

          variant={value === opt.value ? "secondary" : "ghost"}

          className={cn(

            "rounded-lg text-xs font-medium",

            value === opt.value && "border border-brand/30 bg-brand-soft/50 shadow-sm ring-1 ring-brand/20",

          )}

          onClick={() => onChange(opt.value)}

        >

          {opt.label}

        </Button>

      ))}

    </div>

  );

}



function KpiGrid({ kpis, onDrill }: { kpis: ControlTowerKpi[]; onDrill: (kpi: ControlTowerKpi) => void }) {

  return (

    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">

      {kpis.map((kpi) => (

        <KpiCardVisual key={kpi.id} kpi={kpi} onDrill={onDrill} />

      ))}

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

    <Card className="rounded-2xl border-brand/30 bg-brand-soft/10">

      <CardHeader>

        <CardTitle className="flex items-center gap-2 text-base">

          <BarChart3 className="size-4" /> Drilldown — {level}

        </CardTitle>

        <CardDescription>

          Preserves operating model and filter context in URL search params. Phase 2 connects live

          entities.

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

          <Button size="sm" variant="outline" onClick={() => onDrill("location", `${terminology.location} Demo 01`)}>

            Drill to {terminology.location} →

          </Button>

        ) : null}

        {search.location && !search.category ? (

          <Button size="sm" variant="outline" onClick={() => onDrill("category", "Beverages")}>

            Drill to Category →

          </Button>

        ) : null}

        {search.category && !search.sku ? (

          <Button size="sm" variant="outline" onClick={() => onDrill("sku", "MAGGI-70G")}>

            Drill to {terminology.productScope} →

          </Button>

        ) : null}

        {search.sku && !search.audit ? (

          <Button size="sm" variant="outline" onClick={() => onDrill("audit", "AUD-2026-0142")}>

            Drill to Audit →

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


