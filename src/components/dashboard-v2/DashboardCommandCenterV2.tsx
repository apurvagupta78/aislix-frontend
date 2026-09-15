import { useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Download,
  MapPin,
  Package,
  ShieldCheck,
  Store,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { DASHBOARD_SAMPLE } from "@/lib/dashboard-command-demo";
import { cn } from "@/lib/utils";

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--card)",
  fontSize: 12,
} as const;

const CHART_COLORS = [
  "var(--brand)",
  "var(--warning)",
  "var(--destructive)",
  "var(--accent-green)",
  "var(--muted-foreground)",
];

export function DashboardCommandCenterV2({
  sampleMode,
  onExitSample,
}: {
  sampleMode: boolean;
  onExitSample?: () => void;
}) {
  const [skuAuditCount, setSkuAuditCount] = useState<"5" | "10">("5");
  const [skuSearch, setSkuSearch] = useState("MAGGI-70G");
  const skuTrend = useMemo(
    () => DASHBOARD_SAMPLE.skuTrend.slice(skuAuditCount === "5" ? -5 : -10),
    [skuAuditCount],
  );

  return (
    <div className="space-y-8">
      {sampleMode ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
          <div>
            <p className="text-sm font-semibold">Illustrative sample dashboard</p>
            <p className="text-xs">
              Dummy data is shown to explain the redesigned UX. It is not production audit data.
            </p>
          </div>
          {onExitSample ? (
            <Button variant="outline" size="sm" onClick={onExitSample}>
              Return to live data
            </Button>
          ) : null}
        </div>
      ) : null}

      <ExecutivePulse />
      <ActionRequired />
      <RetailPerformance />
      <SkuRcaIntelligence
        skuSearch={skuSearch}
        setSkuSearch={setSkuSearch}
        auditCount={skuAuditCount}
        setAuditCount={setSkuAuditCount}
        trend={skuTrend}
      />
      <ControlAccountability />
      <StoreNetwork />
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-brand">
          {eyebrow}
        </p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("card-surface p-5", className)}>
      <h3 className="text-sm font-semibold">{title}</h3>
      {subtitle ? <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ExecutivePulse() {
  return (
    <section>
      <SectionHeading
        eyebrow="Executive pulse"
        title="What is happening right now"
        description="Six decision metrics only. Select any card to drill into its source records."
        action={
          <Button asChild variant="outline" size="sm">
            <Link to="/new-audit">
              New Audit <ArrowRight className="size-4" />
            </Link>
          </Button>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {DASHBOARD_SAMPLE.kpis.map((kpi) => (
          <div key={kpi.label} className="card-surface p-4">
            <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
              {kpi.label}
            </p>
            <p
              className={cn(
                "mt-2 text-2xl font-semibold tabular-nums",
                kpi.tone === "bad" && "text-destructive",
                kpi.tone === "warn" && "text-warning",
                kpi.tone === "good" && "text-accent-green",
              )}
            >
              {kpi.value}
            </p>
            <div className="mt-2 h-8">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={kpi.trend.map((value, index) => ({ index, value }))}>
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="var(--brand)"
                    dot={false}
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-1 text-[0.68rem] text-muted-foreground">{kpi.detail}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_2fr]">
        <Panel title="Audit status" subtitle="Assigned through independently verified">
          <div className="space-y-3">
            {DASHBOARD_SAMPLE.auditStatus.map((row) => (
              <div key={row.name}>
                <div className="mb-1 flex justify-between text-xs">
                  <span>{row.name}</span>
                  <span className="tabular-nums">{row.value}</span>
                </div>
                <Progress value={(row.value / 30) * 100} className="h-2" />
              </div>
            ))}
          </div>
        </Panel>
        <Panel
          title="Coverage assurance"
          subtitle="Partial coverage is never presented as store-wide clearance"
        >
          <div className="grid gap-4 sm:grid-cols-[150px_1fr]">
            <div className="grid place-items-center">
              <div
                className="relative grid size-32 place-items-center rounded-full"
                style={{ background: "conic-gradient(var(--brand) 0 82%, var(--muted) 82% 100%)" }}
              >
                <div className="grid size-24 place-items-center rounded-full bg-card">
                  <div className="text-center">
                    <p className="text-2xl font-semibold">82%</p>
                    <p className="text-[0.65rem] text-muted-foreground">locations</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              {[
                "Main shelf",
                "Promo display",
                "Checkout",
                "Backroom",
                "Returns",
                "Cold storage",
                "End cap",
                "Receiving",
              ].map((location, index) => (
                <div
                  key={location}
                  className={cn(
                    "rounded-lg border p-3",
                    index < 6 ? "border-emerald-200 bg-emerald-50" : "bg-muted/40",
                  )}
                >
                  <CheckCircle2
                    className={cn(
                      "mb-2 size-4",
                      index < 6 ? "text-emerald-700" : "text-muted-foreground",
                    )}
                  />
                  {location}
                  <p className="mt-1 text-[0.65rem] text-muted-foreground">
                    {index < 6 ? "Verified" : "Outstanding"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </div>
    </section>
  );
}

function ActionRequired() {
  return (
    <section>
      <SectionHeading
        eyebrow="Action required"
        title="Resolve the highest-risk work first"
        description="One queue for audit, inventory, evidence, expiry and verification exceptions."
        action={
          <Button asChild variant="outline" size="sm">
            <Link to="/actions">Open action workspace</Link>
          </Button>
        }
      />
      <div className="overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="border-b bg-muted/40 text-[0.65rem] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="p-3">Severity</th>
              <th>Store</th>
              <th>SKU</th>
              <th>Issue</th>
              <th>Qty</th>
              <th>Owner</th>
              <th>Due</th>
              <th>Next action</th>
            </tr>
          </thead>
          <tbody>
            {DASHBOARD_SAMPLE.actions.map((row) => (
              <tr key={`${row.store}-${row.sku}`} className="border-b last:border-0">
                <td className="p-3">
                  <Badge variant={row.severity === "Critical" ? "destructive" : "secondary"}>
                    {row.severity}
                  </Badge>
                </td>
                <td>{row.store}</td>
                <td className="font-mono text-xs">{row.sku}</td>
                <td>{row.issue}</td>
                <td className="tabular-nums">{row.qty}</td>
                <td>{row.owner}</td>
                <td>{row.due}</td>
                <td>
                  <Button size="sm" variant="outline">
                    Review
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function heatTone(value: number) {
  if (value >= 92) return "bg-emerald-600 text-white";
  if (value >= 85) return "bg-emerald-100 text-emerald-950";
  if (value >= 80) return "bg-amber-100 text-amber-950";
  return "bg-red-100 text-red-950";
}

function RetailPerformance() {
  const categories = ["Snacks", "Beverages", "Personal care", "Staples"] as const;
  return (
    <section>
      <SectionHeading
        eyebrow="Retail performance"
        title="Shelf health and execution"
        description="Availability, variance, planogram and shelf execution using the same filters."
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel
          title="Shelf availability heatmap"
          subtitle="Availability percentage by store and category"
        >
          <div className="overflow-x-auto">
            <div className="grid min-w-[520px] grid-cols-[140px_repeat(4,1fr)] gap-1 text-xs">
              <div />
              {categories.map((category) => (
                <div key={category} className="p-2 text-center font-medium">
                  {category}
                </div>
              ))}
              {DASHBOARD_SAMPLE.availability.flatMap((row) => [
                <div key={`${row.store}-label`} className="p-2 font-medium">
                  {row.store}
                </div>,
                ...categories.map((category) => (
                  <div
                    key={`${row.store}-${category}`}
                    className={cn(
                      "rounded-md p-2 text-center font-semibold tabular-nums",
                      heatTone(row[category]),
                    )}
                  >
                    {row[category]}%
                  </div>
                )),
              ])}
            </div>
          </div>
        </Panel>
        <Panel
          title="Inventory variance"
          subtitle="Shortage and excess units; click a SKU for evidence"
        >
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={DASHBOARD_SAMPLE.variance} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="sku" tick={{ fontSize: 10 }} width={70} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                <Bar dataKey="shortage" fill="var(--destructive)" name="Shortage" />
                <Bar dataKey="excess" fill="var(--accent-green)" name="Excess" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Planogram compliance trend" subtitle="Comparable audit sequence">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={DASHBOARD_SAMPLE.compliance}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="audit" tick={{ fontSize: 10 }} />
                <YAxis domain={[60, 100]} tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                <Line
                  dataKey="compliance"
                  stroke="var(--brand)"
                  strokeWidth={2}
                  name="Planogram %"
                />
                <Line
                  dataKey="availability"
                  stroke="var(--accent-green)"
                  strokeWidth={2}
                  name="Availability %"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Shelf execution issues" subtitle="Issue mix across selected audits">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={DASHBOARD_SAMPLE.shelfExecution}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={52}
                  outerRadius={90}
                  label
                >
                  {DASHBOARD_SAMPLE.shelfExecution.map((row, index) => (
                    <Cell key={row.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>
    </section>
  );
}

function SkuRcaIntelligence({
  skuSearch,
  setSkuSearch,
  auditCount,
  setAuditCount,
  trend,
}: {
  skuSearch: string;
  setSkuSearch: (value: string) => void;
  auditCount: "5" | "10";
  setAuditCount: (value: "5" | "10") => void;
  trend: ReadonlyArray<{
    audit: string;
    expected: number;
    actual: number;
    variance: number;
    value: number;
  }>;
}) {
  return (
    <section>
      <SectionHeading
        eyebrow="SKU & RCA intelligence"
        title="Explain variance at SKU level"
        description="Expected versus actual, potential value variance and RCA across comparable audits."
        action={
          <div className="flex gap-2">
            <Input
              value={skuSearch}
              onChange={(e) => setSkuSearch(e.target.value)}
              className="w-44"
              aria-label="SKU search"
            />
            <Select
              value={auditCount}
              onValueChange={(value) => setAuditCount(value as "5" | "10")}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">Last 5 audits</SelectItem>
                <SelectItem value="10">Last 10 audits</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <Metric label="Selected SKU" value={skuSearch} icon={<Package className="size-4" />} />
        <Metric
          label="Latest variance"
          value="-7 units"
          detail="Expected 60 · actual 53"
          icon={<TrendingDown className="size-4" />}
          bad
        />
        <Metric
          label="Potential value variance"
          value="₹98"
          detail="Not confirmed financial loss"
          icon={<BarChart3 className="size-4" />}
        />
        <Metric
          label="Most common RCA"
          value="Stock sold"
          detail="42 units in selected range"
          icon={<ClipboardCheck className="size-4" />}
        />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <Panel
          title={`Expected vs actual — last ${auditCount} audits`}
          subtitle="Select an audit point to open variance lines and evidence"
        >
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={[...trend]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="audit" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                <Bar dataKey="expected" fill="var(--muted-foreground)" name="Expected" />
                <Bar dataKey="actual" fill="var(--brand)" name="Actual" />
                <Line dataKey="value" stroke="var(--warning)" name="Potential value ₹" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="RCA Pareto" subtitle="Variance units attributed to required root causes">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={DASHBOARD_SAMPLE.rca} layout="vertical" margin={{ left: 35 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="units" fill="var(--brand)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>
    </section>
  );
}

function ControlAccountability() {
  return (
    <section>
      <SectionHeading
        eyebrow="Control & accountability"
        title="Nothing closes without evidence and verification"
        description="Expiry, removal, findings, actions, SLA, recurrence and assurance stay independently visible."
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Expiry control trend" subtitle="Expired, near-expiry and unresolved units">
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={DASHBOARD_SAMPLE.expiry}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                <Area
                  dataKey="nearExpiry"
                  stackId="1"
                  stroke="var(--warning)"
                  fill="var(--warning)"
                  fillOpacity={0.25}
                  name="Near expiry"
                />
                <Area
                  dataKey="expired"
                  stackId="1"
                  stroke="var(--destructive)"
                  fill="var(--destructive)"
                  fillOpacity={0.35}
                  name="Expired"
                />
                <Area
                  dataKey="unresolved"
                  stackId="1"
                  stroke="var(--muted-foreground)"
                  fill="var(--muted-foreground)"
                  fillOpacity={0.25}
                  name="Unresolved"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel
          title="Quarantine & disposition funnel"
          subtitle="Independent removal and disposition stages"
        >
          <div className="space-y-3">
            {DASHBOARD_SAMPLE.quarantine.map((row, index) => (
              <div key={row.stage} className="mx-auto" style={{ width: `${100 - index * 10}%` }}>
                <div className="flex justify-between rounded-lg bg-brand-soft px-3 py-2 text-xs">
                  <span>{row.stage}</span>
                  <strong>{row.value}</strong>
                </div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Open findings by severity" subtitle="106 findings in selected scope">
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={DASHBOARD_SAMPLE.findings}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={48}
                  outerRadius={82}
                >
                  {DASHBOARD_SAMPLE.findings.map((row, index) => (
                    <Cell key={row.name} fill={CHART_COLORS[(index + 2) % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Corrective action workflow" subtitle="Assigned through independently closed">
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={DASHBOARD_SAMPLE.corrective}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="stage" tick={{ fontSize: 9 }} />
                <YAxis />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="value" fill="var(--brand)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel
          title="Repeat problems Pareto"
          subtitle="Recurring combinations by store, SKU and RCA"
        >
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={DASHBOARD_SAMPLE.repeatProblems}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 9 }}
                  interval={0}
                  angle={-12}
                  height={58}
                />
                <YAxis />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" fill="var(--warning)" />
                <Line dataKey="cumulative" stroke="var(--brand)" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel
          title="Audit quality & assurance"
          subtitle="Evidence completeness, reconciliation, RCA and video"
        >
          <div className="space-y-4">
            {DASHBOARD_SAMPLE.quality.map((row) => (
              <div key={row.label}>
                <div className="mb-1 flex justify-between text-xs">
                  <span>{row.label}</span>
                  <strong>{row.value}%</strong>
                </div>
                <Progress value={row.value} className="h-2" />
              </div>
            ))}
          </div>
        </Panel>
        <Panel
          title="SLA performance"
          subtitle="Resolution compliance and turnaround"
          className="xl:col-span-1"
        >
          <div className="flex items-center gap-6">
            <div className="grid size-28 shrink-0 place-items-center rounded-full border-8 border-emerald-500/70">
              <div className="text-center">
                <p className="text-2xl font-semibold">91%</p>
                <p className="text-[0.6rem] text-muted-foreground">within SLA</p>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <p>
                <strong>6.4h</strong> median resolution
              </p>
              <p>
                <strong>9</strong> overdue actions
              </p>
              <p className="text-emerald-700">
                <TrendingUp className="mr-1 inline size-4" />
                4.2% improvement
              </p>
            </div>
          </div>
        </Panel>
        <Panel
          title="Potential business impact"
          subtitle="Observed variance trend — never presented as confirmed loss"
        >
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={DASHBOARD_SAMPLE.impact}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis tickFormatter={(v) => `₹${Math.round(v / 1000)}k`} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v) => `₹${Number(v).toLocaleString("en-IN")}`}
                />
                <Area
                  dataKey="value"
                  stroke="var(--brand)"
                  fill="var(--brand)"
                  fillOpacity={0.18}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>
    </section>
  );
}

function StoreNetwork() {
  return (
    <section>
      <SectionHeading
        eyebrow="Store network"
        title="Store details and performance in one place"
        description="Country, city, store ID, manager, GPS, coverage, variance and actions."
        action={
          <Button asChild variant="outline" size="sm">
            <Link to="/manage" search={{ tab: "stores" }}>
              Manage stores
            </Link>
          </Button>
        }
      />
      <div className="grid gap-4 xl:grid-cols-[0.8fr_1.4fr]">
        <Panel
          title="GPS network view"
          subtitle="Saved store coordinates; not live employee tracking"
        >
          <div className="relative h-72 overflow-hidden rounded-xl border bg-[radial-gradient(circle_at_center,var(--muted)_1px,transparent_1px)] [background-size:18px_18px]">
            {DASHBOARD_SAMPLE.stores.map((store, index) => (
              <div
                key={store.id}
                className="absolute"
                style={{ left: `${20 + index * 18}%`, top: `${30 + (index % 2) * 24}%` }}
              >
                <div className="group relative">
                  <MapPin
                    className={cn(
                      "size-7",
                      store.compliance < 80 ? "text-destructive" : "text-brand",
                    )}
                  />
                  <div className="absolute left-1/2 top-7 z-10 hidden w-40 -translate-x-1/2 rounded-lg border bg-card p-2 text-xs shadow-lg group-hover:block">
                    <strong>{store.name}</strong>
                    <br />
                    {store.city}
                    <br />
                    {store.lat}, {store.lng}
                  </div>
                </div>
              </div>
            ))}
            <div className="absolute bottom-3 left-3 rounded-lg border bg-card/90 p-2 text-[0.65rem] text-muted-foreground">
              Illustrative map layout · GPS coordinates shown in store table
            </div>
          </div>
        </Panel>
        <Panel
          title="Store performance table"
          subtitle="Click a store to open its complete workspace"
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-xs">
              <thead className="border-b text-[0.62rem] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="pb-2">Store / ID</th>
                  <th>Country / City</th>
                  <th>Manager</th>
                  <th>GPS</th>
                  <th>Coverage</th>
                  <th>Compliance</th>
                  <th>Potential variance</th>
                  <th>Actions</th>
                  <th>Expiry</th>
                </tr>
              </thead>
              <tbody>
                {DASHBOARD_SAMPLE.stores.map((store) => (
                  <tr key={store.id} className="border-b last:border-0">
                    <td className="py-3">
                      <p className="font-medium">{store.name}</p>
                      <p className="font-mono text-muted-foreground">{store.id}</p>
                    </td>
                    <td>
                      {store.country}
                      <br />
                      <span className="text-muted-foreground">{store.city}</span>
                    </td>
                    <td>{store.manager}</td>
                    <td>
                      {store.lat.toFixed(3)}, {store.lng.toFixed(3)}
                    </td>
                    <td>{store.coverage}%</td>
                    <td className={store.compliance < 80 ? "text-destructive" : ""}>
                      {store.compliance}%
                    </td>
                    <td>₹{store.variance.toLocaleString("en-IN")}</td>
                    <td>{store.actions}</td>
                    <td>{store.expiry}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  detail,
  icon,
  bad,
}: {
  label: string;
  value: string;
  detail?: string;
  icon: ReactNode;
  bad?: boolean;
}) {
  return (
    <div className="card-surface p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{label}</p>
        <span className={bad ? "text-destructive" : "text-brand"}>{icon}</span>
      </div>
      <p className={cn("mt-2 text-lg font-semibold", bad && "text-destructive")}>{value}</p>
      {detail ? <p className="text-[0.68rem] text-muted-foreground">{detail}</p> : null}
    </div>
  );
}
