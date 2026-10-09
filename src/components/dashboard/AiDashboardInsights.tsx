import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, ArrowUpDown, Download, ExternalLink, Search } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { MpCard, MpCardHeader } from "@/components/design-system/MpCard";
import {
  AgingChart,
  CA_PINK_BAR,
  ChartUnavailable,
  OwnerWorkloadTable,
  PipelineChart,
  StoreChart,
} from "@/components/corrective-actions/CaCharts";
import { CaKpiCard } from "@/components/corrective-actions/CaParts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { AISLIX_PALETTE, type AislixAccent } from "@/lib/ai-audit/kpi-palette";
import type { FieldResult } from "@/lib/ai-audit/verification-rows";
import type { LifecycleAction } from "@/lib/corrective-action-lifecycle";
import {
  correctiveActionKpis,
  agingBuckets,
  openActionsByStore,
  ownerWorkload,
  pipelineCounts,
  slaCompliance,
  variancesByStore,
} from "@/lib/corrective-action-insights";
import { StoreVarianceMatrix } from "@/components/corrective-actions/StoreVarianceMatrix";
import type { CorrectiveActionsSearch } from "@/routes/corrective-actions";
import type { VarianceDimension, VarianceRecord, VarianceSummary } from "@/lib/ai-variance-summary";
import { downloadCsvFile } from "@/lib/kpi-details-csv";
import { toCsv } from "@/lib/store-import";
import { cn } from "@/lib/utils";

/** PURPLE → BLUE → PINK → GREEN → CYAN; no same accent side by side or stacked in a 4-column grid. */
const ACCENTS: AislixAccent[] = ["purple", "blue", "pink", "green", "cyan", "purple", "blue", "pink"];
const CA_ACCENTS: AislixAccent[] = ["purple", "blue", "pink", "green", "cyan", "pink", "green", "grey"];

/** Whole card is the link; hover tints the card background only. */
const CLICKABLE =
  "block rounded-xl [&>*]:transition-colors hover:[&>*]:bg-[#F4F7F9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy";

const DIMENSIONS: Array<{ id: VarianceDimension; label: string; question: string }> = [
  { id: "store", label: "Store", question: "Which stores drift most from the plan?" },
  { id: "city", label: "City", question: "Which cities drift most from the plan?" },
  { id: "team", label: "Team", question: "Which manager's team has the most variances?" },
  { id: "category", label: "Category", question: "Which categories drift most from the plan?" },
  { id: "sku", label: "SKU", question: "Which SKUs are most often off plan?" },
];

const RESULT_DOT: Partial<Record<FieldResult, string>> = {
  mismatch: CA_PINK_BAR,
  below: CA_PINK_BAR,
  above: AISLIX_PALETTE.cyan,
};

const tooltipStyle = {
  borderRadius: 12,
  border: `1px solid ${AISLIX_PALETTE.border}`,
  background: "#FFFFFF",
  fontSize: 12,
  color: AISLIX_PALETTE.navy,
  boxShadow: "0 4px 16px rgba(16, 42, 67, 0.06)",
} as const;
const axisTick = { fontSize: 11, fill: AISLIX_PALETTE.secondary };

function short(text: string, max = 24): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function fmtDate(value: string): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function SectionTitle({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="font-display text-base font-semibold text-navy">{title}</h2>
        <p className="mt-0.5 text-[13px] text-mp-muted">{description}</p>
      </div>
      {action}
    </div>
  );
}

function SegmentToggle<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ id: T; label: string }>;
  label: string;
}) {
  return (
    <div className="inline-flex flex-wrap rounded-lg border border-line bg-white p-0.5" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={value === o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
            value === o.id ? "bg-[#F4F7F9] text-navy" : "text-mp-muted hover:text-navy",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ResultPill({ result, label }: { result: FieldResult; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-white px-2 py-0.5 text-[11px] font-medium text-navy">
      <span className="size-1.5 rounded-full" style={{ background: RESULT_DOT[result] ?? AISLIX_PALETTE.border }} aria-hidden />
      {label}
    </span>
  );
}

function downloadVariances(summary: VarianceSummary) {
  const headers = [
    "Audit date",
    "Store",
    "City",
    "Team",
    "Category",
    "SKU",
    "Product",
    "Field",
    "Expected",
    "AI detected",
    "Human verified",
    "Result",
    "Difference",
    "Scan ID",
  ];
  const rows = summary.records.map((r) => [
    r.date.slice(0, 10),
    r.store,
    r.city,
    r.team,
    r.category,
    r.sku,
    r.product,
    r.fieldLabel,
    r.expected,
    r.aiDetected,
    r.humanVerified,
    r.resultLabel,
    r.difference ?? "",
    r.scanId,
  ]);
  downloadCsvFile(`aislix-ai-variances-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(headers, rows));
}

const PAGE = 25;

type SortKey = "date" | "store" | "product" | "field" | "expected" | "ai" | "human" | "result";
type SortState = { key: SortKey; dir: "asc" | "desc" };

const SORT_COLUMNS: Array<{ key: SortKey; label: string }> = [
  { key: "date", label: "Date" },
  { key: "store", label: "Store" },
  { key: "product", label: "Product" },
  { key: "field", label: "Field" },
  { key: "expected", label: "Expected" },
  { key: "ai", label: "AI detected" },
  { key: "human", label: "Human verified" },
  { key: "result", label: "Result" },
];

function sortValue(r: VarianceRecord, key: SortKey): string | number {
  switch (key) {
    case "date":
      return r.date;
    case "store":
      return r.store.toLowerCase();
    case "product":
      return r.product.toLowerCase();
    case "field":
      return r.fieldLabel.toLowerCase();
    case "expected":
      return numericOrText(r.expected);
    case "ai":
      return numericOrText(r.aiDetected);
    case "human":
      return numericOrText(r.humanVerified);
    case "result":
      return r.difference != null ? Math.abs(r.difference) : r.resultLabel.toLowerCase();
  }
}

function numericOrText(value: string): string | number {
  const n = Number(value.replace(/[^\d.-]/g, ""));
  return value.trim() && /\d/.test(value) && Number.isFinite(n) ? n : value.toLowerCase();
}

function compareRecords(a: VarianceRecord, b: VarianceRecord, sort: SortState): number {
  const x = sortValue(a, sort.key);
  const y = sortValue(b, sort.key);
  const blankX = x === "" || x === "—";
  const blankY = y === "" || y === "—";
  if (blankX !== blankY) return blankX ? 1 : -1;
  let c: number;
  if (typeof x === "number" && typeof y === "number") c = x - y;
  else if (typeof x === "number") c = -1;
  else if (typeof y === "number") c = 1;
  else c = x.localeCompare(y);
  return sort.dir === "asc" ? c : -c;
}

function SortHeader({
  column,
  sort,
  onSort,
  className,
}: {
  column: { key: SortKey; label: string };
  sort: SortState;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const active = sort.key === column.key;
  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      className={cn("py-2 pr-3 font-medium", className)}
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(column.key)}
        className={cn("inline-flex items-center gap-1 hover:text-navy", active && "text-navy")}
      >
        {column.label}
        <Icon className={cn("size-3", !active && "opacity-40")} aria-hidden />
      </button>
    </th>
  );
}

export function AiVarianceSection({ summary, loading }: { summary: VarianceSummary | undefined; loading: boolean }) {
  const [dimension, setDimension] = useState<VarianceDimension>("store");
  const [field, setField] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [visible, setVisible] = useState(PAGE);
  const [sort, setSort] = useState<SortState>({ key: "date", dir: "desc" });

  const onSort = (key: SortKey) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "date" || key === "result" ? "desc" : "asc" }));
    setVisible(PAGE);
  };

  const records = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (summary?.records ?? [])
      .filter((r) => {
        if (field !== "all" && r.field !== field) return false;
        if (!q) return true;
        return [r.product, r.store, r.city, r.team, r.category, r.sku].some((t) => t.toLowerCase().includes(q));
      })
      .sort((a, b) => compareRecords(a, b, sort));
  }, [summary, field, search, sort]);

  const dim = DIMENSIONS.find((d) => d.id === dimension)!;
  const groups = (summary?.groups[dimension] ?? []).slice(0, 8).map((g) => ({
    label: short(g.label),
    full: g.label,
    variances: g.variances,
    matched: g.checked - g.variances,
  }));

  const description = summary
    ? summary.auditsWithPlan
      ? `Plan vs what the AI detected, or a human verified, across ${summary.auditsWithPlan} audit${summary.auditsWithPlan === 1 ? "" : "s"} with a plan (latest ${summary.auditLimit} audits in these filters).`
      : "Plan vs what the AI detected, or a human verified, for every field."
    : "Plan vs what the AI detected, or a human verified, for every field.";

  return (
    <section className="space-y-3" aria-label="Variances across AI audits">
      <SectionTitle
        title="Variances across AI audits"
        description={description}
        action={
          summary?.records.length ? (
            <Button type="button" variant="outline" size="sm" onClick={() => downloadVariances(summary)}>
              <Download className="mr-1.5 size-3.5" /> Download CSV
            </Button>
          ) : null
        }
      />

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[104px] rounded-xl" />
          ))}
        </div>
      ) : !summary || !summary.auditsWithPlan || (!summary.checked && !summary.fields.some((f) => f.notVisible)) ? (
        <MpCard className="p-4">
          <ChartUnavailable
            reason={
              !summary?.audits
                ? "No completed AI audits match these filters."
                : !summary.auditsWithPlan
                  ? "None of these audits had a planogram or document to compare against."
                  : "No planned products match these filters."
            }
          />
        </MpCard>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {summary.fields.map((f, i) => (
              <CaKpiCard
                key={f.key}
                label={f.label}
                value={f.checked ? String(f.variances) : "N/A"}
                context={
                  f.checked
                    ? `variance${f.variances === 1 ? "" : "s"} in ${f.checked} checked${f.notVisible ? ` · ${f.notVisible} not visible` : ""}`
                    : f.notVisible
                      ? `${f.notVisible} not visible in photo`
                      : "Not on the plan"
                }
                info={`Planned products where the ${f.label.toLowerCase()} the AI detected (or a human verified) differed from the plan.`}
                accent={ACCENTS[i] ?? "grey"}
              />
            ))}
          </div>

          <MpCard>
            <MpCardHeader
              title={`Variances by ${dim.label.toLowerCase()}`}
              description={dim.question}
              action={<SegmentToggle value={dimension} onChange={setDimension} options={DIMENSIONS} label="Group variances by" />}
            />
            <div className="px-4 pb-4 pt-3 md:px-5">
              {!groups.length ? (
                <ChartUnavailable reason="No checked fields in these filters." />
              ) : (
                <div style={{ height: Math.max(180, groups.length * 36 + 48) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={groups}
                      layout="vertical"
                      barSize={20}
                      margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
                    >
                      <CartesianGrid stroke={AISLIX_PALETTE.border} strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} />
                      <YAxis
                        type="category"
                        dataKey="label"
                        width={150}
                        tick={{ ...axisTick, fill: AISLIX_PALETTE.navy }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        cursor={{ fill: AISLIX_PALETTE.page }}
                        labelFormatter={(_, payload) => String(payload?.[0]?.payload?.full ?? "")}
                        formatter={(v: number, name: string) => [`${v} field${v === 1 ? "" : "s"}`, name]}
                      />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: AISLIX_PALETTE.secondary }} />
                      <Bar dataKey="variances" name="Variance" stackId="v" fill={CA_PINK_BAR} animationDuration={300} />
                      <Bar
                        dataKey="matched"
                        name="Matches plan"
                        stackId="v"
                        fill={AISLIX_PALETTE.green}
                        radius={[0, 6, 6, 0]}
                        animationDuration={300}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </MpCard>

          <MpCard className="overflow-hidden">
            <MpCardHeader
              title="All variances"
              description={`${summary.variances} of ${summary.checked} checked fields differ from the plan. Open an audit to verify or act on it.`}
            />
            <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3 md:px-5">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-mp-muted" />
                <Input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setVisible(PAGE);
                  }}
                  placeholder="Search product, store, SKU…"
                  className="h-9 w-56 rounded-lg border-line pl-8 text-sm"
                  aria-label="Search variances"
                />
              </div>
              <select
                className="h-9 rounded-lg border border-line bg-white px-2.5 text-sm text-navy"
                value={field}
                onChange={(e) => {
                  setField(e.target.value);
                  setVisible(PAGE);
                }}
                aria-label="Field"
              >
                <option value="all">All fields</option>
                {summary.fields
                  .filter((f) => f.variances > 0)
                  .map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label} ({f.variances})
                    </option>
                  ))}
              </select>
              <span className="ml-auto text-xs text-mp-muted">
                {records.length} variance{records.length === 1 ? "" : "s"}
              </span>
            </div>
            {!records.length ? (
              <p className="px-5 py-6 text-sm text-mp-muted">
                {summary.variances ? "No variances match this search." : "Every checked field matches the plan."}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-line text-xs text-mp-muted">
                      {SORT_COLUMNS.map((c, i) => (
                        <SortHeader
                          key={c.key}
                          column={c}
                          sort={sort}
                          onSort={onSort}
                          className={i === 0 ? "px-4 md:px-5" : undefined}
                        />
                      ))}
                      <th className="py-2 pr-4 font-medium">
                        <span className="sr-only">Open audit</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.slice(0, visible).map((r, i) => (
                      <tr key={`${r.scanId}-${r.product}-${r.field}-${i}`} className="border-b border-[#EEF1F4] hover:bg-[#F4F7F9]">
                        <td className="whitespace-nowrap px-4 py-2 text-mp-muted md:px-5">{fmtDate(r.date)}</td>
                        <td className="py-2 pr-3 text-navy">
                          <span className="block max-w-[140px] truncate" title={`${r.store} · ${r.city}`}>
                            {r.store}
                          </span>
                        </td>
                        <td className="py-2 pr-3">
                          <span className="block max-w-[220px] truncate font-medium text-navy" title={r.product}>
                            {r.product}
                          </span>
                          {r.sku ? <span className="text-[11px] text-mp-muted">{r.sku}</span> : null}
                        </td>
                        <td className="whitespace-nowrap py-2 pr-3 text-navy">{r.fieldLabel}</td>
                        <td className="py-2 pr-3 text-mp-muted">{r.expected || "—"}</td>
                        <td className="py-2 pr-3 text-navy">{r.aiDetected}</td>
                        <td className="py-2 pr-3 text-navy">{r.humanVerified || "—"}</td>
                        <td className="py-2 pr-3">
                          <ResultPill
                            result={r.result}
                            label={r.difference != null ? `${r.resultLabel} (${r.difference > 0 ? "+" : ""}${r.difference})` : r.resultLabel}
                          />
                        </td>
                        <td className="py-2 pr-4 text-right">
                          <Link
                            to="/results"
                            search={{ scan: r.scanId }}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-navy hover:underline"
                          >
                            Open <ExternalLink className="size-3" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {records.length > visible ? (
                  <div className="border-t border-line p-3 text-center">
                    <Button variant="outline" size="sm" onClick={() => setVisible((v) => v + PAGE)}>
                      Show more ({records.length - visible} left)
                    </Button>
                  </div>
                ) : null}
              </div>
            )}
          </MpCard>
        </>
      )}
    </section>
  );
}

export function AiActionsSlaSection({ actions, loading }: { actions: LifecycleAction[] | undefined; loading: boolean }) {
  const rows = useMemo(() => actions ?? [], [actions]);
  const kpis = useMemo(() => correctiveActionKpis(rows), [rows]);
  const sla = useMemo(() => slaCompliance(rows), [rows]);
  const pipeline = useMemo(() => pipelineCounts(rows), [rows]);
  const aging = useMemo(() => agingBuckets(rows), [rows]);
  const stores = useMemo(() => openActionsByStore(rows), [rows]);
  const workload = useMemo(() => ownerWorkload(rows), [rows]);
  const byVerification = rows.filter((a) => a.resolved_by_verification && a.status === "pending_verification").length;

  const byStore = useMemo(() => variancesByStore(rows), [rows]);
  const navigate = useNavigate();
  const openActions = (search: CorrectiveActionsSearch) =>
    void navigate({ to: "/corrective-actions", search: { source: "ai", ...search } });

  const cards: Array<{
    label: string;
    value: string;
    context: string;
    info: string;
    target: CorrectiveActionsSearch | "sla";
  }> = [
    {
      label: "Open actions",
      value: String(kpis.open),
      context: "Open or in progress",
      info: "AI audit actions the owner still has to fix.",
      target: { stage: "active" },
    },
    {
      label: "Awaiting approval",
      value: String(kpis.submitted),
      context: byVerification ? `${byVerification} resolved by verification` : "Fix submitted, not yet approved",
      info: "Fixes submitted by the owner, and issues a human verification disproved — both wait for a manager.",
      target: { stage: "submitted" },
    },
    {
      label: "Overdue",
      value: String(kpis.overdue),
      context: "Past the SLA due date",
      info: "Open or in-progress actions past their SLA due date.",
      target: { stage: "overdue" },
    },
    {
      label: "SLA met",
      value: sla.pct == null ? "N/A" : `${sla.pct}%`,
      context: sla.total ? `${sla.met} of ${sla.total} fixed on time` : "No fixed actions with an SLA yet",
      info: "Fixed actions that were verified or closed by their SLA due date. Opens the SLA & escalation settings.",
      target: "sla",
    },
    {
      label: "Fixed (30 days)",
      value: String(kpis.closedLast30),
      context: "Verified or closed",
      info: "Actions verified or closed in the last 30 days.",
      target: { stage: "fixed" },
    },
    {
      label: "Avg days to fix",
      value: kpis.avgDaysToClose == null ? "N/A" : String(kpis.avgDaysToClose),
      context: kpis.avgDaysToClose == null ? "No fixed actions yet" : "From raised to fixed",
      info: "Average days from when an action was raised to when it was verified or closed.",
      target: { stage: "fixed" },
    },
    {
      label: "Critical & high open",
      value: String(kpis.criticalHighOpen),
      context: "Root cause required",
      info: "Open critical and high priority actions. These need a root cause and preventive action.",
      target: { stage: "active", priority: "critical_high" },
    },
    {
      label: "Escalated",
      value: String(kpis.escalated),
      context: "Sent to a manager or admin",
      info: "Overdue actions escalated to the owner's manager.",
      target: { stage: "escalated" },
    },
  ];

  return (
    <section className="space-y-3" aria-label="Corrective actions and SLA">
      <SectionTitle
        title="Corrective actions & SLA"
        description="Actions raised by the AI audits in these filters — assign, fix, approve, close."
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/escalation-settings">SLA settings</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/corrective-actions" search={{ source: "ai" }}>
                Open corrective actions
              </Link>
            </Button>
          </div>
        }
      />
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[104px] rounded-xl" />
          ))}
        </div>
      ) : !rows.length ? (
        <MpCard className="p-4">
          <ChartUnavailable reason="No corrective actions from AI audits match these filters." />
        </MpCard>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map(({ target, ...card }, i) => {
              const accent = CA_ACCENTS[i] ?? "grey";
              const body = <CaKpiCard {...card} accent={accent} />;
              return target === "sla" ? (
                <Link
                  key={card.label}
                  to="/escalation-settings"
                  className={CLICKABLE}
                  aria-label={`${card.label}: ${card.value}. Open SLA settings`}
                >
                  {body}
                </Link>
              ) : (
                <Link
                  key={card.label}
                  to="/corrective-actions"
                  search={{ source: "ai", ...target }}
                  className={CLICKABLE}
                  aria-label={`${card.label}: ${card.value}. Open these actions`}
                >
                  {body}
                </Link>
              );
            })}
          </div>
          <StoreVarianceMatrix
            rows={byStore.rows}
            totals={byStore.totals}
            description="What went wrong in each store — planogram, quantity, location, brand, price, promotion. Click a number to open those actions."
            onSelect={(storeId, type) =>
              openActions({ store: storeId ?? undefined, variance: type ?? undefined })
            }
          />
          <div className="grid gap-4 lg:grid-cols-2">
            <Link to="/corrective-actions" search={{ source: "ai" }} className={CLICKABLE} aria-label="Open all AI actions">
              <PipelineChart counts={pipeline} />
            </Link>
            <Link
              to="/corrective-actions"
              search={{ source: "ai", stage: "active" }}
              className={CLICKABLE}
              aria-label="Open actions still open"
            >
              <AgingChart buckets={aging} />
            </Link>
            <Link
              to="/corrective-actions"
              search={{ source: "ai", stage: "active" }}
              className={CLICKABLE}
              aria-label="Open actions by store"
            >
              <StoreChart rows={stores} />
            </Link>
            <Link to="/corrective-actions" search={{ source: "ai" }} className={CLICKABLE} aria-label="Open actions by owner">
              <OwnerWorkloadTable rows={workload} />
            </Link>
          </div>
        </>
      )}
    </section>
  );
}
