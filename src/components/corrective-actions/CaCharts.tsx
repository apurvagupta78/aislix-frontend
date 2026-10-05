import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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

import { MpCard, MpCardHeader } from "@/components/design-system/MpCard";
import { AISLIX_PALETTE } from "@/lib/ai-audit/kpi-palette";
import type {
  AgingBucket,
  OwnerLoad,
  PipelineSegment,
  RecheckPoint,
  StoreCount,
  TypeCount,
  WeeklyFlowPoint,
} from "@/lib/corrective-action-insights";

/** Deeper pink used for bar fills so risk segments stay visible on white (pink tint is #FFEAF1). */
export const CA_PINK_BAR = "#F6CFDC";

export const STAGE_COLORS: Record<PipelineSegment, string> = {
  overdue: CA_PINK_BAR,
  open: AISLIX_PALETTE.blue,
  in_progress: AISLIX_PALETTE.purple,
  submitted: AISLIX_PALETTE.border,
  verified: AISLIX_PALETTE.cyan,
  closed: AISLIX_PALETTE.green,
};

export const STAGE_LABELS: Record<PipelineSegment, string> = {
  overdue: "Overdue",
  open: "Open",
  in_progress: "In progress",
  submitted: "Submitted",
  verified: "Verified",
  closed: "Closed",
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

function ChartCard({
  title,
  question,
  children,
  className,
}: {
  title: string;
  question: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <MpCard className={className}>
      <MpCardHeader title={title} description={question} />
      <div className="px-4 pb-4 pt-3 md:px-5">{children}</div>
    </MpCard>
  );
}

export function ChartUnavailable({ reason }: { reason: string }) {
  return (
    <div
      className="flex h-[200px] flex-col items-center justify-center rounded-lg border border-dashed text-center"
      style={{ background: AISLIX_PALETTE.grey, borderColor: AISLIX_PALETTE.border }}
    >
      <p className="text-sm font-semibold text-navy">Data unavailable</p>
      <p className="mt-1 max-w-xs text-xs text-mp-muted">{reason}</p>
    </div>
  );
}

export function PipelineChart({ counts }: { counts: Record<PipelineSegment, number> }) {
  const order: PipelineSegment[] = ["overdue", "open", "in_progress", "submitted", "verified", "closed"];
  const total = order.reduce((sum, key) => sum + counts[key], 0);
  return (
    <ChartCard title="Action pipeline" question="Where is every action right now?">
      {total === 0 ? (
        <ChartUnavailable reason="No corrective actions match these filters." />
      ) : (
        <div>
          <div className="flex h-9 w-full overflow-hidden rounded-lg border" style={{ borderColor: AISLIX_PALETTE.border }}>
            {order.map((key) =>
              counts[key] > 0 ? (
                <div
                  key={key}
                  title={`${STAGE_LABELS[key]}: ${counts[key]} action${counts[key] === 1 ? "" : "s"}`}
                  className="h-full transition-[width] duration-300"
                  style={{ width: `${(counts[key] / total) * 100}%`, background: STAGE_COLORS[key] }}
                />
              ) : null,
            )}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {order.map((key) => (
              <div
                key={key}
                className="flex items-center justify-between rounded-lg border px-3 py-2"
                style={{ borderColor: AISLIX_PALETTE.border }}
              >
                <span className="inline-flex items-center gap-2 text-xs text-mp-muted">
                  <span className="size-2.5 rounded-full" style={{ background: STAGE_COLORS[key] }} />
                  {STAGE_LABELS[key]}
                </span>
                <span className="text-sm font-semibold tabular-nums text-navy">{counts[key]}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </ChartCard>
  );
}

export function FlowTrendChart({ points }: { points: WeeklyFlowPoint[] }) {
  const any = points.some((p) => p.opened > 0 || p.closed > 0);
  return (
    <ChartCard title="Opened vs closed" question="Are we closing actions faster than new ones arrive?">
      {!any ? (
        <ChartUnavailable reason="No actions were opened or closed in the last 8 weeks." />
      ) : (
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
              <CartesianGrid stroke={AISLIX_PALETTE.border} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="week" tick={axisTick} tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number, name: string) => [`${v} actions`, name]} labelFormatter={(l) => `Week of ${l}`} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: AISLIX_PALETTE.secondary }} />
              <Line type="monotone" dataKey="opened" name="Opened" stroke={AISLIX_PALETTE.purple} strokeWidth={2.5} dot={{ r: 3 }} animationDuration={300} />
              <Line type="monotone" dataKey="closed" name="Closed" stroke={AISLIX_PALETTE.green} strokeWidth={2.5} dot={{ r: 3 }} animationDuration={300} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}

export function TypeChart({ rows }: { rows: TypeCount[] }) {
  return (
    <ChartCard title="Actions by type" question="What kind of problems keep coming up?">
      {!rows.length ? (
        <ChartUnavailable reason="No actions match these filters." />
      ) : (
        <div style={{ height: Math.max(180, rows.length * 34 + 40) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid stroke={AISLIX_PALETTE.border} strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="label" width={104} tick={{ ...axisTick, fill: AISLIX_PALETTE.navy }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: AISLIX_PALETTE.page }} formatter={(v: number, name: string) => [`${v} actions`, name]} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: AISLIX_PALETTE.secondary }} />
              <Bar dataKey="open" name="Still open" stackId="t" fill={AISLIX_PALETTE.blue} radius={[0, 0, 0, 0]} animationDuration={300} />
              <Bar dataKey="done" name="Fixed" stackId="t" fill={AISLIX_PALETTE.green} radius={[0, 6, 6, 0]} animationDuration={300} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}

export function StoreChart({ rows }: { rows: StoreCount[] }) {
  return (
    <ChartCard title="Stores with open actions" question="Which stores need help first?">
      {!rows.length ? (
        <ChartUnavailable reason="No open actions in these stores." />
      ) : (
        <div style={{ height: Math.max(180, rows.length * 34 + 40) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid stroke={AISLIX_PALETTE.border} strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="store" width={120} tick={{ ...axisTick, fill: AISLIX_PALETTE.navy }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: AISLIX_PALETTE.page }} formatter={(v: number, name: string) => [`${v} actions`, name]} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: AISLIX_PALETTE.secondary }} />
              <Bar dataKey="overdue" name="Overdue" stackId="s" fill={CA_PINK_BAR} animationDuration={300} />
              <Bar dataKey="onTime" name="On time" stackId="s" fill={AISLIX_PALETTE.purple} radius={[0, 6, 6, 0]} animationDuration={300} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}

export function AgingChart({ buckets }: { buckets: AgingBucket[] }) {
  const total = buckets.reduce((s, b) => s + b.count, 0);
  const fill = (b: AgingBucket) =>
    b.key === "on_time" ? AISLIX_PALETTE.green : b.key === "due_soon" ? AISLIX_PALETTE.cyan : CA_PINK_BAR;
  return (
    <ChartCard title="SLA aging" question="How late are the actions that are still open?">
      {total === 0 ? (
        <ChartUnavailable reason="No open actions with a due date." />
      ) : (
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={buckets} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid stroke={AISLIX_PALETTE.border} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} interval={0} />
              <YAxis allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: AISLIX_PALETTE.page }} formatter={(v: number) => [`${v} open actions`, "Count"]} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} animationDuration={300}>
                {buckets.map((b) => (
                  <Cell key={b.key} fill={fill(b)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}

export function SourceDonut({ ai, digital }: { ai: number; digital: number }) {
  const total = ai + digital;
  const data = [
    { name: "AI Audit", value: ai, color: AISLIX_PALETTE.blue },
    { name: "Digital Audit", value: digital, color: AISLIX_PALETTE.purple },
  ];
  return (
    <ChartCard title="Where actions come from" question="How much comes from AI vs Digital audits?">
      {total === 0 ? (
        <ChartUnavailable reason="No actions match these filters." />
      ) : (
        <div className="flex items-center gap-4">
          <div className="relative h-[200px] w-[200px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius={62} outerRadius={88} paddingAngle={2} stroke="none" animationDuration={300}>
                  {data.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number, name: string) => [`${v} actions (${Math.round((v / total) * 100)}%)`, name]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display text-2xl font-semibold tabular-nums text-navy">{total}</span>
              <span className="text-[11px] text-mp-muted">actions</span>
            </div>
          </div>
          <ul className="space-y-2 text-sm">
            {data.map((d) => (
              <li key={d.name} className="flex items-center gap-2">
                <span className="size-2.5 rounded-full" style={{ background: d.color }} />
                <span className="text-navy">{d.name}</span>
                <span className="font-semibold tabular-nums text-navy">{d.value}</span>
                <span className="text-xs text-mp-muted">({Math.round((d.value / total) * 100)}%)</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </ChartCard>
  );
}

export function OwnerWorkloadTable({ rows }: { rows: OwnerLoad[] }) {
  const max = Math.max(1, ...rows.map((r) => r.open + r.overdue + r.submitted));
  return (
    <ChartCard title="Owner workload" question="Who is carrying the most open work?">
      {!rows.length ? (
        <ChartUnavailable reason="No owners for these actions yet." />
      ) : (
        <div className="max-h-[260px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white text-[11px] uppercase tracking-wide text-mp-muted">
              <tr>
                <th className="py-2 text-left font-medium">Owner</th>
                <th className="py-2 text-left font-medium">Load</th>
                <th className="py-2 text-right font-medium">Open</th>
                <th className="py-2 text-right font-medium">Overdue</th>
                <th className="py-2 text-right font-medium">Submitted</th>
                <th className="py-2 text-right font-medium">Fixed</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 10).map((r) => (
                <tr key={r.owner} className="border-t" style={{ borderColor: AISLIX_PALETTE.border }}>
                  <td className="max-w-[140px] truncate py-2 pr-2 text-navy">{r.owner}</td>
                  <td className="w-[30%] py-2 pr-3">
                    <div className="flex h-2 overflow-hidden rounded-full" style={{ background: AISLIX_PALETTE.grey }}>
                      <div style={{ width: `${(r.overdue / max) * 100}%`, background: CA_PINK_BAR }} />
                      <div style={{ width: `${(r.open / max) * 100}%`, background: AISLIX_PALETTE.purple }} />
                      <div style={{ width: `${(r.submitted / max) * 100}%`, background: STAGE_COLORS.submitted }} />
                    </div>
                  </td>
                  <td className="py-2 text-right tabular-nums text-navy">{r.open}</td>
                  <td className="py-2 text-right tabular-nums font-semibold text-navy">{r.overdue}</td>
                  <td className="py-2 text-right tabular-nums text-navy">{r.submitted}</td>
                  <td className="py-2 text-right tabular-nums text-mp-muted">{r.done}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ChartCard>
  );
}

export function RecheckChart({ rows }: { rows: RecheckPoint[] }) {
  return (
    <ChartCard title="AI re-check: before vs after" question="Did the fix actually work on the shelf?">
      {!rows.length ? (
        <ChartUnavailable reason="No AI re-checks yet. Upload an after photo on an AI action to compare." />
      ) : (
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid stroke={AISLIX_PALETTE.border} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="code" tick={axisTick} tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ fill: AISLIX_PALETTE.page }}
                formatter={(v: number, name: string) => [`${v} shelf issues`, name]}
                labelFormatter={(label, payload) => {
                  const row = payload?.[0]?.payload as RecheckPoint | undefined;
                  return row ? `${label} · ${row.passed ? "Fix confirmed" : "Issue still there"}` : String(label);
                }}
              />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: AISLIX_PALETTE.secondary }} />
              <Bar dataKey="before" name="Before" fill={AISLIX_PALETTE.border} radius={[6, 6, 0, 0]} animationDuration={300} />
              <Bar dataKey="after" name="After" fill={AISLIX_PALETTE.green} radius={[6, 6, 0, 0]} animationDuration={300} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}
