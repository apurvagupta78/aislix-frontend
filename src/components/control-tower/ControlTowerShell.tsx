import { useMemo } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  Camera,
  ChevronRight,
  MapPin,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
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

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { OperatingModel } from "@/lib/audit-builder/types";
import { OPERATING_MODEL_CARDS } from "@/lib/audit-engine/operating-model-catalog";
import {
  buildControlTowerDemo,
  buildDrilldownTrail,
  nextDrilldownSearch,
  truncateDrilldownSearch,
  type ControlTowerKpi,
  type ControlTowerModelFilter,
  type ControlTowerSearch,
} from "@/lib/control-tower";

const MODEL_OPTIONS: { value: ControlTowerModelFilter; label: string }[] = [
  { value: "all", label: "All" },
  ...OPERATING_MODEL_CARDS.filter((c) => c.id !== "custom").map((c) => ({
    value: c.id as OperatingModel,
    label: c.title,
  })),
];

const CHART_COLORS = [
  "hsl(var(--brand))",
  "hsl(var(--warning))",
  "hsl(var(--destructive))",
  "hsl(var(--accent-green))",
  "hsl(var(--muted-foreground))",
];

export function ControlTowerShell({
  search,
  routePath,
}: {
  search: ControlTowerSearch;
  routePath: "/dashboard" | "/dashboard/my-performance" | "/dashboard/executive";
}) {
  const navigate = useNavigate();
  const model = search.model ?? "all";
  const data = useMemo(() => buildControlTowerDemo(model), [model]);
  const trail = useMemo(() => buildDrilldownTrail(search), [search]);

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

  return (
    <div className="space-y-6">
      <DemoBanner templateCount={data.templateCount} categories={data.templateCategories} model={model} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <OperatingModelSwitcher value={model} onChange={setModel} />
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>
            {data.terminology.locationPlural}: contextual labels from operating model catalog
          </span>
          <span>·</span>
          <span>{data.templateCount} system templates in scope</span>
        </div>
      </div>

      {trail.length > 1 ? (
        <DrilldownTrail trail={trail} onNavigate={drillBack} />
      ) : null}

      <section>
        <SectionHeader title="Universal KPIs" description="Shared definitions across all operating models." />
        <KpiGrid kpis={data.universalKpis} onDrill={(kpi) => drillTo("kpi", kpi.label)} />
      </section>

      {data.contextualKpis.length > 0 ? (
        <section>
          <SectionHeader
            title={`${MODEL_OPTIONS.find((m) => m.value === model)?.label ?? "Operating model"} KPIs`}
            description="Shown when starter templates in scope support the underlying fields."
          />
          <KpiGrid kpis={data.contextualKpis} onDrill={(kpi) => drillTo("kpi", kpi.label)} />
        </section>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Audit execution</CardTitle>
            <CardDescription>Assignment and audit status for selected scope</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.auditStatus}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(var(--brand))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <Button variant="link" size="sm" className="mt-2 px-0" asChild>
              <Link to="/history">View all audits →</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Audit trend</CardTitle>
            <CardDescription>Completed audits vs findings (demo)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.auditTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="completed" stroke="hsl(var(--brand))" strokeWidth={2} />
                  <Line type="monotone" dataKey="findings" stroke="hsl(var(--destructive))" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="rounded-2xl xl:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Risk ranking</CardTitle>
            <CardDescription>{data.terminology.locationPlural} by risk metric</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
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

        <Card className="rounded-2xl xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Critical findings</CardTitle>
            <CardDescription>Click to drill into finding → action → verification</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.criticalFindings.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => drillTo("finding", f.id)}
                className="flex w-full flex-wrap items-center gap-2 rounded-xl border border-border p-3 text-left text-sm transition-colors hover:bg-muted/50"
              >
                <Badge variant="destructive">{f.severity}</Badge>
                <span className="font-medium">{f.location}</span>
                <span className="text-muted-foreground">· {f.sku}</span>
                <span className="flex-1 truncate text-muted-foreground">{f.issue}</span>
                <ChevronRight className="size-4 text-muted-foreground" />
              </button>
            ))}
            <Button variant="link" size="sm" className="px-0" asChild>
              <Link to="/findings">All findings →</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Corrective action queue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
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
            <Button variant="link" size="sm" className="px-0" asChild>
              <Link to="/corrective-actions">Action workspace →</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">SLA & escalations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-3xl font-semibold">{data.sla.compliancePct}%</p>
                <p className="text-xs text-muted-foreground">SLA compliance</p>
              </div>
              <ShieldCheck className="size-8 text-brand opacity-80" />
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-lg bg-muted/50 p-2">
                <p className="font-semibold">{data.sla.overdue}</p>
                <p className="text-muted-foreground">Overdue</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-2">
                <p className="font-semibold">{data.sla.dueToday}</p>
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

        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Evidence coverage</CardTitle>
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
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => drillTo("evidence", "coverage")}
            >
              Drill to evidence
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Recurring issues</CardTitle>
          <CardDescription>Historical finding patterns (demo)</CardDescription>
        </CardHeader>
        <CardContent>
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
          <Button variant="link" size="sm" className="mt-2 px-0" asChild>
            <Link to="/exceptions">Recurring issues workspace →</Link>
          </Button>
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
      <p className="text-sm font-semibold">Phase 1E — labeled demo data</p>
      <p className="mt-1 text-xs opacity-90">
        KPIs and panels use template-registry-driven definitions for{" "}
        <strong>{model === "all" ? "all operating models" : model.replace(/_/g, " ")}</strong> (
        {templateCount} templates: {categories.slice(0, 5).join(", ")}
        {categories.length > 5 ? "…" : ""}). Live KPI wiring ships in Phase 2 — values shown are
        illustrative, not production audit data.
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
    <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-muted/30 p-1">
      {MODEL_OPTIONS.map((opt) => (
        <Button
          key={opt.value}
          size="sm"
          variant={value === opt.value ? "secondary" : "ghost"}
          className={cn("rounded-lg text-xs", value === opt.value && "shadow-sm")}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </Button>
      ))}
    </div>
  );
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

function KpiGrid({ kpis, onDrill }: { kpis: ControlTowerKpi[]; onDrill: (kpi: ControlTowerKpi) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {kpis.map((kpi) => (
        <button
          key={kpi.id}
          type="button"
          disabled={!kpi.available}
          onClick={() => kpi.available && onDrill(kpi)}
          className={cn(
            "rounded-2xl border border-border bg-card p-4 text-left transition-colors",
            kpi.available ? "hover:border-brand/40 hover:bg-brand-soft/30" : "opacity-60",
          )}
        >
          <p className="text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground">
            {kpi.label}
          </p>
          <p className="mt-1 text-2xl font-semibold tracking-tight">{kpi.value}</p>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{kpi.detail}</p>
          {kpi.available ? (
            <span className="mt-2 inline-flex items-center text-[0.65rem] text-brand">
              Drill down <ArrowRight className="ml-0.5 size-3" />
            </span>
          ) : null}
        </button>
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
