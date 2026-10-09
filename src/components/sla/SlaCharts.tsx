import { useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, Clock } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ChartUnavailable, CA_PINK_BAR } from "@/components/corrective-actions/CaCharts";
import { MpCard, MpCardHeader } from "@/components/design-system/MpCard";
import { AISLIX_PALETTE } from "@/lib/ai-audit/kpi-palette";
import type { AuditChecks } from "@/lib/audit-checks";
import { hideModelNames } from "@/lib/ai-display-text";
import { actionStage } from "@/lib/corrective-action-catalog";
import {
  formatMinutes,
  slaTypeLabel,
  type DelayReasonRow,
  type SlaAction,
  type SlaAlert,
  type SlaGroupRow,
  type SlaTypeRow,
  type WeeklyCompliancePoint,
} from "@/lib/sla-insights";
import { cn } from "@/lib/utils";

const tooltipStyle = {
  borderRadius: 12,
  border: `1px solid ${AISLIX_PALETTE.border}`,
  background: "#FFFFFF",
  fontSize: 12,
  color: AISLIX_PALETTE.navy,
  boxShadow: "0 4px 16px rgba(16, 42, 67, 0.06)",
} as const;
const axisTick = { fontSize: 11, fill: AISLIX_PALETTE.secondary };

/** Hover tints the background only (no lift), per the design system. */
export const CLICKABLE_ROW = "cursor-pointer transition-colors hover:bg-[#F4F7F9]";

export function complianceDot(pct: number | null): string {
  if (pct == null) return AISLIX_PALETTE.border;
  if (pct >= 90) return AISLIX_PALETTE.green;
  if (pct >= 70) return AISLIX_PALETTE.blue;
  return CA_PINK_BAR;
}

export function CompliancePill({ pct }: { pct: number | null }) {
  return (
    <span className="inline-flex items-center gap-1.5 tabular-nums text-navy">
      <span className="size-1.5 rounded-full" style={{ background: complianceDot(pct) }} aria-hidden />
      {pct == null ? "N/A" : `${pct}%`}
    </span>
  );
}

function SlaCard({
  title,
  question,
  action,
  children,
  className,
}: {
  title: string;
  question: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <MpCard className={className}>
      <MpCardHeader title={title} description={question} action={action} />
      <div className="px-4 pb-4 pt-3 md:px-5">{children}</div>
    </MpCard>
  );
}

/** Target vs median actual time to fix, per SLA type. */
export function SlaTypeTargetChart({
  rows,
  onSelect,
}: {
  rows: SlaTypeRow[];
  onSelect?: (type: string) => void;
}) {
  const used = rows.filter((r) => r.total > 0);
  const max = Math.max(1, ...used.map((r) => Math.max(r.medianTargetMin ?? 0, r.medianActualMin ?? 0)));
  return (
    <SlaCard title="Target vs actual by SLA type" question="How long do fixes take against the target?">
      {!used.length ? (
        <ChartUnavailable reason="No actions with an SLA match these filters." />
      ) : (
        <ul className="space-y-3">
          {used.map((r) => {
            const late = r.medianActualMin != null && r.medianTargetMin != null && r.medianActualMin > r.medianTargetMin;
            return (
              <li key={r.type}>
                <button
                  type="button"
                  onClick={() => onSelect?.(r.type)}
                  className={cn("w-full rounded-lg px-2 py-2 text-left", onSelect ? CLICKABLE_ROW : "")}
                  aria-label={`${r.label}: target ${formatMinutes(r.medianTargetMin)}, actual ${formatMinutes(r.medianActualMin)}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="font-medium text-navy">{r.label}</span>
                    <span className="flex items-center gap-3 text-xs text-mp-muted">
                      <CompliancePill pct={r.compliancePct} />
                      <span>
                        {r.breaches} breach{r.breaches === 1 ? "" : "es"} · {r.pending} pending
                      </span>
                    </span>
                  </div>
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-12 shrink-0 text-[11px] text-mp-muted">Target</span>
                      <div className="h-2 flex-1 rounded-full bg-[#F4F7F9]">
                        <div
                          className="h-2 rounded-full transition-[width] duration-300"
                          style={{
                            width: `${((r.medianTargetMin ?? 0) / max) * 100}%`,
                            background: AISLIX_PALETTE.blue,
                          }}
                        />
                      </div>
                      <span className="w-16 shrink-0 text-right text-[11px] tabular-nums text-navy">
                        {formatMinutes(r.medianTargetMin)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-12 shrink-0 text-[11px] text-mp-muted">Actual</span>
                      <div className="h-2 flex-1 rounded-full bg-[#F4F7F9]">
                        {r.medianActualMin != null ? (
                          <div
                            className="h-2 rounded-full transition-[width] duration-300"
                            style={{
                              width: `${(r.medianActualMin / max) * 100}%`,
                              background: late ? CA_PINK_BAR : AISLIX_PALETTE.purple,
                            }}
                          />
                        ) : null}
                      </div>
                      <span className="w-16 shrink-0 text-right text-[11px] tabular-nums text-navy">
                        {r.medianActualMin == null ? "No fixes" : formatMinutes(r.medianActualMin)}
                      </span>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 text-[11px] text-mp-muted">Median per action. Actual = raised to fix submitted, for confirmed fixes.</p>
    </SlaCard>
  );
}

export function DelayReasonsChart({
  rows,
  limit = 6,
  onSelect,
}: {
  rows: DelayReasonRow[];
  limit?: number;
  onSelect?: () => void;
}) {
  const top = rows.slice(0, limit);
  const max = Math.max(1, ...top.map((r) => r.count));
  return (
    <SlaCard title="Delay analysis" question="What are the most common reasons deadlines are missed?">
      {!top.length ? (
        <ChartUnavailable reason="No missed deadlines in these filters." />
      ) : (
        <ul className="space-y-2">
          {top.map((r) => (
            <li key={r.reason}>
              <button
                type="button"
                onClick={onSelect}
                className={cn("w-full rounded-lg px-2 py-1.5 text-left", onSelect ? CLICKABLE_ROW : "")}
              >
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate text-navy" title={r.reason}>
                    {r.reason}
                  </span>
                  <span className="shrink-0 tabular-nums text-navy">{r.count}</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-[#F4F7F9]">
                  <div
                    className="h-2 rounded-full transition-[width] duration-300"
                    style={{ width: `${(r.count / max) * 100}%`, background: CA_PINK_BAR }}
                  />
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[11px] text-mp-muted">From the reason recorded when a late fix was submitted, else the root cause.</p>
    </SlaCard>
  );
}

type GroupSort = "label" | "compliancePct" | "breaches" | "pending" | "medianActualMin";

const GROUP_COLUMNS: Array<{ key: GroupSort; label: string; align?: "right" }> = [
  { key: "label", label: "Name" },
  { key: "compliancePct", label: "SLA compliance", align: "right" },
  { key: "breaches", label: "Breaches", align: "right" },
  { key: "pending", label: "Pending", align: "right" },
  { key: "medianActualMin", label: "Actual vs target", align: "right" },
];

/** Store, team or employee SLA performance; rows open the matching actions. */
export function SlaGroupTable({
  title,
  question,
  nameLabel,
  rows,
  onSelect,
  limit = 10,
}: {
  title: string;
  question: string;
  nameLabel: string;
  rows: SlaGroupRow[];
  onSelect?: (row: SlaGroupRow) => void;
  limit?: number;
}) {
  const [sort, setSort] = useState<{ key: GroupSort; dir: "asc" | "desc" }>({ key: "breaches", dir: "desc" });
  const [showAll, setShowAll] = useState(false);
  const sorted = useMemo(() => {
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      if (sort.key === "label") return a.label.localeCompare(b.label) * dir;
      const av = a[sort.key];
      const bv = b[sort.key];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return ((av as number) - (bv as number)) * dir;
    });
  }, [rows, sort]);
  const visible = showAll ? sorted : sorted.slice(0, limit);
  return (
    <SlaCard title={title} question={question}>
      {!rows.length ? (
        <ChartUnavailable reason="No actions match these filters." />
      ) : (
        <div className="-mx-4 overflow-x-auto md:-mx-5">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-mp-muted">
                {GROUP_COLUMNS.map((c) => {
                  const active = sort.key === c.key;
                  const Icon = active ? (sort.dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
                  return (
                    <th
                      key={c.key}
                      className={cn("py-2 font-medium", c.key === "label" ? "px-4 text-left md:px-5" : "px-3 text-right")}
                      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setSort((s) => ({
                            key: c.key,
                            dir: s.key === c.key ? (s.dir === "asc" ? "desc" : "asc") : c.key === "label" ? "asc" : "desc",
                          }))
                        }
                        className="inline-flex items-center gap-1 hover:text-navy"
                      >
                        {c.key === "label" ? nameLabel : c.label}
                        <Icon className="size-3" aria-hidden />
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr
                  key={r.key}
                  className={cn("border-b border-[#EEF1F4]", onSelect ? CLICKABLE_ROW : "")}
                  onClick={onSelect ? () => onSelect(r) : undefined}
                  onKeyDown={onSelect ? (e) => (e.key === "Enter" ? onSelect(r) : undefined) : undefined}
                  tabIndex={onSelect ? 0 : undefined}
                >
                  <td className="max-w-[220px] truncate px-4 py-2 font-medium text-navy md:px-5" title={r.label}>
                    {r.label}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <CompliancePill pct={r.compliancePct} />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-navy">{r.breaches}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-navy">{r.pending}</td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums text-mp-muted">
                    {r.medianActualMin == null ? "No fixes" : formatMinutes(r.medianActualMin)} /{" "}
                    {formatMinutes(r.medianTargetMin)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > limit ? (
            <div className="px-4 pt-3 text-center md:px-5">
              <button type="button" onClick={() => setShowAll((v) => !v)} className="text-xs font-semibold text-navy hover:underline">
                {showAll ? "Show fewer" : `Show all ${rows.length}`}
              </button>
            </div>
          ) : null}
        </div>
      )}
    </SlaCard>
  );
}

function leftText(minutes: number): string {
  return minutes >= 0 ? `due in ${formatMinutes(minutes)}` : `${formatMinutes(-minutes)} late`;
}

/** Deadlines approaching or missed: what, who, where and when. */
export function SlaAlertsPanel({ alerts, limit = 8 }: { alerts: SlaAlert[]; limit?: number }) {
  const dueSoon = alerts.filter((a) => a.kind === "due_soon").length;
  const missed = alerts.length - dueSoon;
  return (
    <SlaCard
      title="Alerts"
      question="Which deadlines are about to be missed, or already were?"
      action={
        <span className="text-xs text-mp-muted">
          {dueSoon} due soon · {missed} missed
        </span>
      }
    >
      {!alerts.length ? (
        <ChartUnavailable reason="Nothing is due soon or past its deadline in these filters." />
      ) : (
        <ul className="-mx-2 divide-y divide-[#EEF1F4]">
          {alerts.slice(0, limit).map((a) => (
            <li key={a.id}>
              <Link
                to="/corrective-actions/$actionId"
                params={{ actionId: a.id }}
                className="flex items-start gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-[#F4F7F9]"
              >
                <span
                  className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#F4F7F9] text-navy"
                  aria-hidden
                >
                  {a.kind === "missed" ? <AlertTriangle className="size-3.5" /> : <Clock className="size-3.5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-navy">{hideModelNames(a.title)}</span>
                  <span className="block text-xs text-mp-muted">
                    {a.code ?? "Action"} · {slaTypeLabel(a.slaType, true)} · {a.store} · {a.owner}
                  </span>
                </span>
                <span
                  className="shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold text-navy"
                  style={{
                    borderColor: a.kind === "missed" ? CA_PINK_BAR : AISLIX_PALETTE.blue,
                    background: AISLIX_PALETTE.card,
                  }}
                >
                  {leftText(a.minutesLeft)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {alerts.length > limit ? (
        <p className="mt-2 text-xs text-mp-muted">+{alerts.length - limit} more in the action list.</p>
      ) : null}
    </SlaCard>
  );
}

const PRIORITY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

/** What needs fixing, who owns it and when it is due: open actions, most urgent first. */
export function OpenActionsList({ actions, limit = 6 }: { actions: SlaAction[]; limit?: number }) {
  const open = actions
    .filter((a) => {
      const s = actionStage(a.status);
      return s === "open" || s === "in_progress";
    })
    .sort(
      (x, y) =>
        (PRIORITY_RANK[x.priority] ?? 4) - (PRIORITY_RANK[y.priority] ?? 4) ||
        (x.due_at ? new Date(x.due_at).getTime() : Infinity) - (y.due_at ? new Date(y.due_at).getTime() : Infinity),
    );
  return (
    <SlaCard
      title="What needs fixing"
      question="What is wrong, who is responsible, and when is it due?"
      action={<span className="text-xs text-mp-muted">{open.length} open</span>}
    >
      {!open.length ? (
        <ChartUnavailable reason="No open corrective actions in these filters." />
      ) : (
        <ul className="-mx-2 divide-y divide-[#EEF1F4]">
          {open.slice(0, limit).map((a) => (
            <li key={a.id}>
              <Link
                to="/corrective-actions/$actionId"
                params={{ actionId: a.id }}
                className="flex items-start gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-[#F4F7F9]"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-navy">{hideModelNames(a.title)}</span>
                  <span className="block text-xs text-mp-muted">
                    {a.code ?? "Action"} · {a.store_name ?? "No store"} · {a.assigned_name || "Unassigned"}
                  </span>
                </span>
                <span className="shrink-0 text-right text-xs text-navy">
                  {a.due_at
                    ? new Date(a.due_at).toLocaleString([], {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "No due date"}
                  <span className="block capitalize text-mp-muted">{a.priority}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {open.length > limit ? (
        <p className="mt-2 text-xs text-mp-muted">+{open.length - limit} more in the action list.</p>
      ) : null}
    </SlaCard>
  );
}

export function ComplianceTrendChart({ points }: { points: WeeklyCompliancePoint[] }) {
  const any = points.some((p) => p.pct != null);
  return (
    <SlaCard title="SLA compliance trend" question="Is on-time completion improving week by week?">
      {!any ? (
        <ChartUnavailable reason="No deadlines fell in the last 8 weeks for these filters." />
      ) : (
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
              <CartesianGrid stroke={AISLIX_PALETTE.grey} vertical={false} />
              <XAxis dataKey="week" tick={axisTick} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} tick={axisTick} tickLine={false} axisLine={false} unit="%" />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value, _name, item) => {
                  const p = item.payload as WeeklyCompliancePoint;
                  return [`${value}% (${p.met} on time, ${p.missed} missed)`, "SLA compliance"];
                }}
              />
              <Line
                type="monotone"
                dataKey="pct"
                stroke={AISLIX_PALETTE.purple}
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
                isAnimationActive
                animationDuration={300}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </SlaCard>
  );
}

export type AuditCheckKey = "quantity" | "location" | "extra_facings" | "implemented" | "pre_post";

/** The five corrective-action checks; each card opens the matching actions. */
export function AuditChecksGrid({
  checks,
  onSelect,
  hideQuantity,
}: {
  checks: AuditChecks;
  onSelect: (key: AuditCheckKey) => void;
  /** Digital audits have no AI count to compare. */
  hideQuantity?: boolean;
}) {
  const { quantity, location, extraFacings, implemented, prePost } = checks;
  const onTimeJudged = implemented.onTime + implemented.late;
  const cards: Array<{ key: AuditCheckKey; title: string; value: string; context: string; dot: string }> = [
    {
      key: "quantity",
      title: "AI vs actual quantity",
      value: quantity.checked ? `${quantity.differ} of ${quantity.checked}` : "N/A",
      context: quantity.checked
        ? `verified counts differ from AI${quantity.avgGap != null ? ` · avg gap ${quantity.avgGap}` : ""}`
        : "No human-verified counts yet",
      dot: AISLIX_PALETTE.purple,
    },
    {
      key: "location",
      title: "Expected vs actual location",
      value: String(location.total),
      context: location.total ? `${location.open} not fixed yet` : "No location issues",
      dot: AISLIX_PALETTE.blue,
    },
    {
      key: "extra_facings",
      title: "Extra facings vs planogram",
      value: String(extraFacings.total),
      context: extraFacings.total ? `${extraFacings.open} not fixed yet` : "Nothing outside the plan",
      dot: CA_PINK_BAR,
    },
    {
      key: "implemented",
      title: "Changes implemented",
      value: implemented.total ? `${implemented.done} of ${implemented.total}` : "N/A",
      context: onTimeJudged
        ? `${Math.round((implemented.onTime / onTimeJudged) * 100)}% on time · ${implemented.pending} pending`
        : `${implemented.pending} pending`,
      dot: AISLIX_PALETTE.green,
    },
    {
      key: "pre_post",
      title: "Pre vs post audit",
      value:
        prePost.avgBefore != null && prePost.avgAfter != null
          ? `${prePost.avgBefore}% → ${prePost.avgAfter}%`
          : "N/A",
      context: prePost.compared
        ? `${prePost.improvedPct}% of ${prePost.compared} re-checked shelves improved`
        : "No re-check audits yet",
      dot: AISLIX_PALETTE.cyan,
    },
  ];
  const shown = hideQuantity ? cards.filter((c) => c.key !== "quantity") : cards;
  return (
    <div className={cn("grid gap-3 sm:grid-cols-2", shown.length === 5 ? "xl:grid-cols-5" : "xl:grid-cols-4")}>
      {shown.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={() => onSelect(c.key)}
          className="rounded-lg border border-line bg-white p-4 text-left transition-colors hover:bg-[#F4F7F9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy"
        >
          <p className="flex items-center gap-2 text-sm text-mp-muted">
            <span className="size-1.5 shrink-0 rounded-full" style={{ background: c.dot }} aria-hidden />
            {c.title}
          </p>
          <p className="mt-2 font-display text-2xl font-semibold tabular-nums leading-none text-navy">{c.value}</p>
          <p className="mt-1.5 text-xs text-mp-muted">{c.context}</p>
        </button>
      ))}
    </div>
  );
}
