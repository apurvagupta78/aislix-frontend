import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
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
import { ArrowDownRight, ArrowUpRight, Info, Sparkles } from "lucide-react";

import { useWorkspaceContext } from "@/hooks/use-customer-context";
import { AISLIX_PALETTE, accentHex } from "@/lib/ai-audit/kpi-palette";
import {
  buildSegmentKpis,
  formatInr,
  normalizeSegmentId,
  readStoredSegment,
  SEGMENT_CONFIG,
  SEGMENT_IDS,
  segmentHeadline,
  writeStoredSegment,
  type SegmentConfig,
  type SegmentId,
  type SegmentKpiView,
  type SegmentStoreColumn,
  type SegmentTrendMetric,
} from "@/lib/segments/segment-config";
import {
  fetchSegmentDashboard,
  type SegmentDashboard,
  type SegmentDashboardStore,
} from "@/lib/segments/segment-dashboard";
import type { DashboardFilterState } from "@/lib/dashboard-filters";
import { cn } from "@/lib/utils";

const P = AISLIX_PALETTE;

type Props = {
  filters: Pick<DashboardFilterState, "datePreset" | "dateFrom" | "dateTo" | "storeId"> | null;
  previewDemo: boolean;
  userEmail: string | null | undefined;
};

export function SegmentHomePanel({ filters, previewDemo, userEmail }: Props) {
  const workspace = useWorkspaceContext();
  const workspaceSegment = workspace.data ? normalizeSegmentId(workspace.data.customerType) : null;
  const [picked, setPicked] = useState<SegmentId | null>(null);

  useEffect(() => {
    setPicked(readStoredSegment());
  }, []);

  const segmentId: SegmentId = picked ?? workspaceSegment ?? "supermarket";
  const config = SEGMENT_CONFIG[segmentId];

  const choose = (id: SegmentId) => {
    setPicked(id);
    writeStoredSegment(id);
  };

  const query = useQuery({
    queryKey: [
      "segment-dashboard-v1",
      filters?.datePreset ?? "all",
      filters?.dateFrom ?? "",
      filters?.dateTo ?? "",
      filters?.storeId ?? "all",
      previewDemo,
    ],
    queryFn: () => fetchSegmentDashboard(filters, { previewDemo, userEmail }),
    staleTime: 60_000,
  });

  const result = query.data;
  const data = result?.data ?? null;
  const kpis = useMemo(() => buildSegmentKpis(config, data), [config, data]);
  const headline = segmentHeadline(config, data);
  const audits = data?.totals?.audits ?? 0;

  return (
    <section
      aria-labelledby="segment-home-title"
      className="rounded-2xl border border-[#D9E2E8] bg-white p-4 shadow-sm sm:p-5"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="segment-home-title" className="text-base font-semibold text-[#102A43]">
              {config.question}
            </h2>
            {result?.labeledDemo ? (
              <span className="rounded-full border border-[#D9E2E8] bg-[#EEF1F4] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#667085]">
                Demo data
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-[#667085]">{config.value}</p>
        </div>
        <SegmentSwitcher value={segmentId} workspaceSegment={workspaceSegment} onChange={choose} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#667085]">
        <span className="inline-flex items-center gap-1 rounded-full border border-[#C1E4F8] bg-[#EEF6FA] px-2 py-0.5 text-[#102A43]">
          <Sparkles className="size-3" aria-hidden />
          AI detected · completed AI audits only
        </span>
        {result?.periodLabel ? <span>{result.periodLabel}</span> : null}
      </div>

      {query.isPending ? (
        <SegmentSkeleton />
      ) : query.isError ? (
        <EmptyCard
          title="Data unavailable"
          body="The AI audit summary could not load. Refresh the page to try again."
        />
      ) : result?.outOfScope ? (
        <EmptyCard
          title="No stores in your access"
          body="Ask your workspace admin to add stores to your access to see AI results here."
        />
      ) : audits === 0 ? (
        <EmptyCard
          title={`No AI audits in this period`}
          body={`Run an AI audit for one of your ${config.storeNoun.many} to fill this dashboard. Values show N/A until then.`}
          cta
        />
      ) : (
        <>
          {headline ? (
            <p className="mt-4 rounded-xl border border-[#D9E2E8] bg-[#F4F7F9] px-3 py-2 text-sm text-[#102A43]">
              {headline}
            </p>
          ) : null}

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {kpis.map((kpi) => (
              <SegmentKpiCard key={kpi.id} kpi={kpi} />
            ))}
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <TrendCard config={config} data={data} />
            {config.showBrands ? <BrandsCard config={config} data={data} /> : <FixesCard data={data} />}
          </div>

          <StoresTable config={config} stores={data?.stores ?? []} />
        </>
      )}
    </section>
  );
}

function SegmentSwitcher({
  value,
  workspaceSegment,
  onChange,
}: {
  value: SegmentId;
  workspaceSegment: SegmentId | null;
  onChange: (id: SegmentId) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Customer type" className="flex flex-wrap gap-1.5">
      {SEGMENT_IDS.map((id) => {
        const active = id === value;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(id)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-150",
              active
                ? "border-[#102A43] bg-[#102A43] text-white"
                : "border-[#D9E2E8] bg-white text-[#667085] hover:bg-[#F4F7F9]",
            )}
          >
            {SEGMENT_CONFIG[id].label}
            {id === workspaceSegment ? (
              <span className={cn("ml-1 text-[10px]", active ? "text-white/80" : "text-[#667085]")}>
                · yours
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function SegmentKpiCard({ kpi }: { kpi: SegmentKpiView }) {
  const accent = accentHex(kpi.accent);
  const good = kpi.delta != null && (kpi.lowerIsBetter ? kpi.delta < 0 : kpi.delta > 0);
  return (
    <div
      className="h-full rounded-xl border border-[#D9E2E8] bg-white p-4"
      style={{ borderLeftWidth: 3, borderLeftColor: accent }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-[#667085]">{kpi.label}</p>
        <div className="flex items-center gap-1">
          {kpi.delta != null && kpi.delta !== 0 ? (
            <span
              className={cn(
                "inline-flex items-center text-xs font-semibold",
                good ? "text-[#3d7a55]" : "text-[#102A43]",
              )}
              title="Change vs the previous period of the same length"
            >
              {kpi.delta > 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
              {Number.isInteger(kpi.delta) || Math.abs(kpi.delta) >= 10
                ? Math.abs(kpi.delta).toFixed(0)
                : Math.abs(kpi.delta).toFixed(1)}
            </span>
          ) : null}
          <span title={kpi.context} className="text-[#667085]">
            <Info className="size-3.5" aria-label={kpi.context} />
          </span>
        </div>
      </div>
      <p
        className={cn(
          "mt-2 text-2xl font-semibold",
          kpi.unavailable ? "text-[#667085]" : "text-[#102A43]",
        )}
      >
        {kpi.value}
      </p>
      <p className="mt-1 text-xs text-[#557187]">{kpi.context}</p>
    </div>
  );
}

const TREND_UNIT: Record<SegmentTrendMetric, { suffix: string; label: string; color: string }> = {
  avg_osa: { suffix: "%", label: "Shelf availability", color: P.purple },
  avg_health: { suffix: "/100", label: "Shelf health", color: P.purple },
  gaps: { suffix: "", label: "Empty gaps", color: P.blue },
  audits: { suffix: "", label: "AI audits", color: P.blue },
};

function weekLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function TrendCard({ config, data }: { config: SegmentConfig; data: SegmentDashboard | null }) {
  const metric = config.trend.metric;
  const unit = TREND_UNIT[metric];
  const points = (data?.trend ?? []).map((t) => ({
    week: weekLabel(t.week),
    value: t[metric] == null ? null : Number(t[metric]),
  }));
  const hasValues = points.some((p) => p.value != null);

  return (
    <ChartShell title={config.trend.title} provenance="AI detected">
      {!hasValues ? (
        <Unavailable text="Data unavailable for this period" />
      ) : points.length < 2 ? (
        <Unavailable text="Needs audits in at least two weeks to show a trend" />
      ) : (
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
              <CartesianGrid stroke="#EEF1F4" vertical={false} />
              <XAxis dataKey="week" tick={{ fontSize: 11, fill: P.secondary }} tickLine={false} axisLine={false} />
              <YAxis
                tick={{ fontSize: 11, fill: P.secondary }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                formatter={(v: number) => [`${v}${unit.suffix}`, unit.label]}
                contentStyle={{ borderRadius: 8, borderColor: P.border, fontSize: 12 }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={unit.color}
                strokeWidth={2.5}
                dot={{ r: 3, fill: unit.color }}
                connectNulls={false}
                animationDuration={300}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartShell>
  );
}

function BrandsCard({ config, data }: { config: SegmentConfig; data: SegmentDashboard | null }) {
  const rows = (data?.brands ?? [])
    .filter((b) => b.avg_share != null)
    .slice(0, 8)
    .map((b) => ({ brand: b.brand, share: Number(b.avg_share), seen: b.audits_seen }));

  return (
    <ChartShell title={config.brandsTitle} provenance="AI detected">
      {!rows.length ? (
        <Unavailable text="Data unavailable: no brands read in this period" />
      ) : (
        <>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid stroke="#EEF1F4" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: P.secondary }}
                  tickLine={false}
                  axisLine={false}
                  unit="%"
                />
                <YAxis
                  type="category"
                  dataKey="brand"
                  width={110}
                  tick={{ fontSize: 11, fill: P.navy }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  formatter={(v: number, _n, item) => [
                    `${v}% average share · seen in ${(item?.payload as { seen?: number })?.seen ?? 0} audits`,
                    "Share of shelf",
                  ]}
                  contentStyle={{ borderRadius: 8, borderColor: P.border, fontSize: 12 }}
                />
                <Bar dataKey="share" fill={P.green} radius={[0, 4, 4, 0]} animationDuration={300} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-xs text-[#667085]">
            Average share across {data?.brand_audits ?? 0} {data?.brand_audits === 1 ? "audit" : "audits"} where
            the AI read brands.
          </p>
        </>
      )}
    </ChartShell>
  );
}

function FixesCard({ data }: { data: SegmentDashboard | null }) {
  const a = data?.actions;
  const rows: Array<{ label: string; value: number | null | undefined; tone: string }> = [
    { label: "Open fixes", value: a?.open, tone: P.cyan },
    { label: "Overdue", value: a?.overdue, tone: P.grey },
    { label: "Critical open", value: a?.critical_open, tone: P.pink },
    { label: "Closed this period", value: a?.closed_in_period, tone: P.green },
  ];
  return (
    <ChartShell title="Fixes raised from AI findings" provenance="Calculated by Aislix">
      {!a ? (
        <Unavailable text="Data unavailable" />
      ) : (
        <ul className="divide-y divide-[#EEF1F4]">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center justify-between py-2.5 text-sm">
              <span className="flex items-center gap-2 text-[#102A43]">
                <span
                  className="size-2.5 rounded-full border border-[#D9E2E8]"
                  style={{ backgroundColor: r.tone }}
                  aria-hidden
                />
                {r.label}
              </span>
              <span className="font-semibold text-[#102A43]">
                {r.value == null ? "N/A" : r.value.toLocaleString("en-IN")}
              </span>
            </li>
          ))}
        </ul>
      )}
      <Link to="/corrective-actions" className="mt-2 inline-block text-xs font-medium text-[#557187] hover:underline">
        View fixes
      </Link>
    </ChartShell>
  );
}

const STORE_COLUMN_LABEL: Record<SegmentStoreColumn, string> = {
  audits: "AI audits",
  avg_osa: "Availability",
  avg_health: "Shelf health",
  gaps: "Empty gaps",
  low_stock: "Low stock",
  misplaced: "Misplaced",
  value_gap_inr: "Value at risk",
  gps_audits: "With GPS",
  last_audit: "Last audit",
};

function storeCell(col: SegmentStoreColumn, s: SegmentDashboardStore): string {
  const v = s[col];
  if (col === "last_audit") {
    const d = new Date(String(v));
    return Number.isNaN(d.getTime())
      ? "N/A"
      : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  if (v == null) return "N/A";
  if (col === "value_gap_inr") return formatInr(Number(v));
  if (col === "avg_osa") return `${v}%`;
  if (col === "avg_health") return `${Math.round(Number(v))}/100`;
  if (col === "gps_audits") return `${v} of ${s.audits}`;
  return Number(v).toLocaleString("en-IN");
}

function StoresTable({ config, stores }: { config: SegmentConfig; stores: SegmentDashboardStore[] }) {
  if (!stores.length) return null;
  const rows = stores.slice(0, 8);
  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-[#D9E2E8]">
      <div className="flex items-center justify-between gap-2 border-b border-[#D9E2E8] bg-[#F4F7F9] px-4 py-2.5">
        <h3 className="text-sm font-semibold text-[#102A43]">{config.storesTitle}</h3>
        <span className="text-xs text-[#667085]">
          {stores.length > rows.length ? `Top ${rows.length} of ${stores.length}` : `${stores.length} total`}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-[#667085]">
              <th className="px-4 py-2 font-medium capitalize">{config.storeNoun.one}</th>
              {config.storeColumns.map((c) => (
                <th key={c} className="px-3 py-2 text-right font-medium">
                  {STORE_COLUMN_LABEL[c]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.store_id ?? s.store_name} className="border-t border-[#EEF1F4]">
                <td className="px-4 py-2 text-[#102A43]">
                  <span className="font-medium">{s.store_name}</span>
                  {s.city ? <span className="ml-1 text-xs text-[#667085]">· {s.city}</span> : null}
                </td>
                {config.storeColumns.map((c) => (
                  <td
                    key={c}
                    className={cn(
                      "px-3 py-2 text-right tabular-nums",
                      storeCell(c, s) === "N/A" ? "text-[#667085]" : "text-[#102A43]",
                    )}
                  >
                    {storeCell(c, s)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ChartShell({
  title,
  provenance,
  children,
}: {
  title: string;
  provenance: string;
  children: React.ReactNode;
}) {
  return (
    <div className="h-full rounded-xl border border-[#D9E2E8] bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[#102A43]">{title}</h3>
        <span className="text-[10px] font-medium uppercase tracking-wide text-[#667085]">{provenance}</span>
      </div>
      {children}
    </div>
  );
}

function Unavailable({ text }: { text: string }) {
  return (
    <div className="flex h-52 items-center justify-center rounded-lg bg-[#EEF1F4] px-4 text-center text-sm text-[#667085]">
      {text}
    </div>
  );
}

function EmptyCard({ title, body, cta }: { title: string; body: string; cta?: boolean }) {
  return (
    <div className="mt-4 rounded-xl border border-[#D9E2E8] bg-[#EEF1F4]/80 px-4 py-4">
      <p className="text-sm font-semibold text-[#102A43]">{title}</p>
      <p className="mt-1 text-sm text-[#667085]">{body}</p>
      {cta ? (
        <Link
          to="/new-audit"
          search={{ templateId: undefined, systemKey: undefined, assign: false }}
          className="mt-3 inline-flex rounded-lg bg-[#102A43] px-3 py-2 text-xs font-medium text-white"
        >
          Start Audit
        </Link>
      ) : null}
    </div>
  );
}

function SegmentSkeleton() {
  return (
    <div className="mt-4 space-y-3" aria-busy="true" aria-live="polite">
      <p className="text-sm text-[#667085]">Loading AI results…</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl border border-[#D9E2E8] bg-[#F4F7F9]" />
        ))}
      </div>
    </div>
  );
}
