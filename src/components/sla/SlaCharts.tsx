import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, Clock } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ChartUnavailable, CA_PINK_BAR } from "@/components/corrective-actions/CaCharts";
import { MpCard, MpCardHeader } from "@/components/design-system/MpCard";
import { ACCENT_TINT, AISLIX_PALETTE } from "@/lib/ai-audit/kpi-palette";
import type { AuditChecks } from "@/lib/audit-checks";
import { hideModelNames } from "@/lib/ai-display-text";
import { Button } from "@/components/ui/button";
import {
  actionStage,
  actionStageLabel,
  isActionLate,
  issueCategoryLabel,
  issueCategoryOf,
} from "@/lib/corrective-action-catalog";
import { slaRemainingLabel } from "@/lib/corrective-action-lifecycle";
import {
  formatMinutes,
  slaTypeLabel,
  type DelayReasonRow,
  type SlaAction,
  type SlaAlert,
  type SlaGroupRow,
  type SlaSummary,
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

/** The SLA-coloured progress bar used on cards and tables. */
function MiniBar({ pct, color, className }: { pct: number; color: string; className?: string }) {
  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-[#F4F7F9]", className)}>
      <div
        className="h-full rounded-full transition-[width] duration-300"
        style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }}
      />
    </div>
  );
}

export type SlaStatusKey = "met" | "breached" | "late_open" | "due_soon" | "on_track" | "awaiting";

const SLA_STATUS: Array<{ key: SlaStatusKey; label: string; color: string }> = [
  { key: "met", label: "Fixed on time", color: AISLIX_PALETTE.green },
  { key: "breached", label: "Fixed late", color: CA_PINK_BAR },
  { key: "late_open", label: "Overdue, not fixed", color: "#ECBDCC" },
  { key: "due_soon", label: "Due soon", color: AISLIX_PALETTE.cyan },
  { key: "on_track", label: "Open, on track", color: AISLIX_PALETTE.blue },
  { key: "awaiting", label: "Awaiting check", color: AISLIX_PALETTE.purple },
];

/** Where every action stands against its deadline. */
export function SlaStatusChart({
  summary,
  onSelect,
}: {
  summary: Pick<SlaSummary, "met" | "breached" | "lateOpen" | "open" | "awaiting" | "dueSoon">;
  onSelect?: (key: SlaStatusKey) => void;
}) {
  const counts: Record<SlaStatusKey, number> = {
    met: summary.met,
    breached: summary.breached,
    late_open: summary.lateOpen,
    due_soon: summary.dueSoon,
    on_track: Math.max(0, summary.open - summary.dueSoon),
    awaiting: summary.awaiting,
  };
  const total = SLA_STATUS.reduce((s, x) => s + counts[x.key], 0);
  return (
    <SlaCard title="SLA status" question="Where does every action stand against its deadline?">
      {total === 0 ? (
        <ChartUnavailable reason="No actions with a deadline match these filters." />
      ) : (
        <div>
          <div className="flex h-9 w-full overflow-hidden rounded-lg border" style={{ borderColor: AISLIX_PALETTE.border }}>
            {SLA_STATUS.map((s) =>
              counts[s.key] > 0 ? (
                <div
                  key={s.key}
                  title={`${s.label}: ${counts[s.key]} action${counts[s.key] === 1 ? "" : "s"}`}
                  className="h-full transition-[width] duration-300"
                  style={{ width: `${(counts[s.key] / total) * 100}%`, background: s.color }}
                />
              ) : null,
            )}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {SLA_STATUS.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => onSelect?.(s.key)}
                className={cn(
                  "flex items-center justify-between rounded-lg border px-3 py-2 text-left",
                  onSelect ? CLICKABLE_ROW : "",
                )}
                style={{ borderColor: AISLIX_PALETTE.border }}
              >
                <span className="inline-flex items-center gap-2 text-xs text-mp-muted">
                  <span className="size-2.5 rounded-full" style={{ background: s.color }} />
                  {s.label}
                </span>
                <span className="text-sm font-semibold tabular-nums text-navy">{counts[s.key]}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </SlaCard>
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
                              background: late ? CA_PINK_BAR : AISLIX_PALETTE.green,
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
                    <span className="inline-flex items-center justify-end gap-2">
                      <MiniBar
                        pct={r.compliancePct ?? 0}
                        color={complianceDot(r.compliancePct)}
                        className="hidden w-14 sm:block"
                      />
                      <CompliancePill pct={r.compliancePct} />
                    </span>
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
                    borderColor: a.kind === "missed" ? CA_PINK_BAR : AISLIX_PALETTE.cyan,
                    background: a.kind === "missed" ? ACCENT_TINT.pink : ACCENT_TINT.cyan,
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

type FixView = "needs_fixing" | "awaiting" | "fixed" | "all";
type FixSortKey = "what" | "type" | "store" | "owner" | "due" | "status" | "priority";

const FIX_VIEWS: Array<{ id: FixView; label: string }> = [
  { id: "needs_fixing", label: "Needs fixing" },
  { id: "awaiting", label: "Awaiting check" },
  { id: "fixed", label: "Fixed" },
  { id: "all", label: "All" },
];

const FIX_COLUMNS: Array<{ key: FixSortKey; label: string }> = [
  { key: "what", label: "What is wrong" },
  { key: "type", label: "Issue type" },
  { key: "store", label: "Store" },
  { key: "owner", label: "Who is responsible" },
  { key: "due", label: "Due" },
  { key: "status", label: "Status" },
  { key: "priority", label: "Priority" },
];

const STAGE_RANK: Record<string, number> = { open: 0, in_progress: 1, submitted: 2, verified: 3, closed: 4 };
const FIX_PAGE = 10;

function inFixView(a: SlaAction, view: FixView): boolean {
  const s = actionStage(a.status);
  if (view === "needs_fixing") return s === "open" || s === "in_progress";
  if (view === "awaiting") return s === "submitted";
  if (view === "fixed") return s === "verified" || s === "closed";
  return true;
}

function fixSortValue(a: SlaAction, key: FixSortKey): string | number {
  switch (key) {
    case "what":
      return a.title.toLowerCase();
    case "type":
      return issueCategoryLabel(issueCategoryOf(a)).toLowerCase();
    case "store":
      return (a.store_name ?? "").toLowerCase();
    case "owner":
      return (a.assigned_name || "").toLowerCase();
    case "due":
      return a.due_at ? new Date(a.due_at).getTime() : Number.MAX_SAFE_INTEGER;
    case "status":
      return STAGE_RANK[actionStage(a.status)] ?? 9;
    case "priority":
      return PRIORITY_RANK[a.priority] ?? 4;
  }
}

/** What needs fixing, who is responsible and when it is due — every action, sortable, 10 at a time. */
export function OpenActionsList({ actions }: { actions: SlaAction[] }) {
  const navigate = useNavigate();
  const [view, setView] = useState<FixView>("needs_fixing");
  const [sort, setSort] = useState<{ key: FixSortKey; dir: "asc" | "desc" }>({ key: "priority", dir: "asc" });
  const [visible, setVisible] = useState(FIX_PAGE);

  const counts = useMemo(() => {
    const c: Record<FixView, number> = { needs_fixing: 0, awaiting: 0, fixed: 0, all: actions.length };
    for (const a of actions) {
      if (inFixView(a, "needs_fixing")) c.needs_fixing += 1;
      else if (inFixView(a, "awaiting")) c.awaiting += 1;
      else if (inFixView(a, "fixed")) c.fixed += 1;
    }
    return c;
  }, [actions]);

  const rows = useMemo(() => {
    const list = actions.filter((a) => inFixView(a, view));
    const dueTime = (a: SlaAction) => (a.due_at ? new Date(a.due_at).getTime() : Number.MAX_SAFE_INTEGER);
    list.sort((x, y) => {
      const a = fixSortValue(x, sort.key);
      const b = fixSortValue(y, sort.key);
      const c = typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b));
      return (sort.dir === "asc" ? c : -c) || dueTime(x) - dueTime(y);
    });
    return list;
  }, [actions, view, sort]);

  const onSort = (key: FixSortKey) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
    setVisible(FIX_PAGE);
  };

  return (
    <MpCard className="overflow-hidden">
      <MpCardHeader
        title="What needs fixing"
        description="What is wrong, who is responsible, and when is it due? Click a column to sort, a row to open the action."
        action={<span className="text-xs text-mp-muted">{counts.needs_fixing} open</span>}
      />
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3 md:px-5">
        <div className="inline-flex flex-wrap rounded-lg border border-line bg-white p-0.5" role="tablist" aria-label="Fix status">
          {FIX_VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              role="tab"
              aria-selected={view === v.id}
              onClick={() => {
                setView(v.id);
                setVisible(FIX_PAGE);
              }}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                view === v.id ? "bg-[#F4F7F9] text-navy" : "text-mp-muted hover:text-navy",
              )}
            >
              {v.label} ({counts[v.id]})
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-mp-muted">
          {rows.length} action{rows.length === 1 ? "" : "s"}
        </span>
      </div>
      {!rows.length ? (
        <div className="p-4 md:p-5">
          <ChartUnavailable
            reason={view === "needs_fixing" ? "Nothing needs fixing in these filters." : "No actions with this status in these filters."}
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-mp-muted">
                {FIX_COLUMNS.map((c, i) => {
                  const active = sort.key === c.key;
                  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
                  return (
                    <th
                      key={c.key}
                      className={cn("py-2 pr-3 font-medium", i === 0 && "px-4 md:px-5")}
                      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                    >
                      <button
                        type="button"
                        onClick={() => onSort(c.key)}
                        className={cn("inline-flex items-center gap-1 hover:text-navy", active && "text-navy")}
                      >
                        {c.label}
                        <Icon className={cn("size-3", !active && "opacity-40")} aria-hidden />
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, visible).map((a) => {
                const stage = actionStage(a.status);
                const late = isActionLate(a);
                return (
                  <tr
                    key={a.id}
                    onClick={() => void navigate({ to: "/corrective-actions/$actionId", params: { actionId: a.id } })}
                    className="cursor-pointer border-b border-[#EEF1F4] transition-colors hover:bg-[#F4F7F9]"
                  >
                    <td className="px-4 py-2 md:px-5">
                      <Link
                        to="/corrective-actions/$actionId"
                        params={{ actionId: a.id }}
                        onClick={(e) => e.stopPropagation()}
                        className="block max-w-[300px] truncate font-medium text-navy hover:underline"
                        title={hideModelNames(a.title)}
                      >
                        {hideModelNames(a.title)}
                      </Link>
                      <span className="text-[11px] text-mp-muted">{a.code ?? "Action"}</span>
                    </td>
                    <td className="whitespace-nowrap py-2 pr-3 text-navy">{issueCategoryLabel(issueCategoryOf(a))}</td>
                    <td className="py-2 pr-3 text-navy">
                      <span className="block max-w-[160px] truncate" title={a.store_name ?? "No store"}>
                        {a.store_name ?? "No store"}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-navy">
                      <span className="block max-w-[160px] truncate">{a.assigned_name || "Unassigned"}</span>
                    </td>
                    <td className="whitespace-nowrap py-2 pr-3 text-navy">
                      {a.due_at
                        ? new Date(a.due_at).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
                        : "No due date"}
                      {a.due_at && (stage === "open" || stage === "in_progress") ? (
                        <span className="block text-[11px] text-mp-muted">{slaRemainingLabel(a.due_at, a.status)}</span>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-3">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-2 py-0.5 text-[11px] font-medium text-navy">
                        <span
                          className="size-1.5 rounded-full"
                          style={{
                            background: late
                              ? CA_PINK_BAR
                              : stage === "verified" || stage === "closed"
                                ? AISLIX_PALETTE.green
                                : stage === "submitted"
                                  ? AISLIX_PALETTE.blue
                                  : AISLIX_PALETTE.purple,
                          }}
                          aria-hidden
                        />
                        {late ? "Overdue" : actionStageLabel(a.status)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap py-2 pr-4 capitalize text-navy">{a.priority}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length > visible ? (
            <div className="border-t border-line p-3 text-center">
              <Button variant="outline" size="sm" onClick={() => setVisible((v) => v + FIX_PAGE)}>
                Show more ({rows.length - visible} left)
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </MpCard>
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
  const share = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : null);
  const cards: Array<{
    key: AuditCheckKey;
    title: string;
    value: string;
    context: string;
    dot: string;
    /** Progress shown under the value; null = nothing to measure yet. */
    bar: { pct: number | null; label: string };
  }> = [
    {
      key: "quantity",
      title: "AI vs actual quantity",
      value: quantity.checked ? `${quantity.differ} of ${quantity.checked}` : "N/A",
      context: quantity.checked
        ? `verified counts differ from AI${quantity.avgGap != null ? ` · avg gap ${quantity.avgGap}` : ""}`
        : "No human-verified counts yet",
      dot: AISLIX_PALETTE.purple,
      bar: { pct: share(quantity.checked - quantity.differ, quantity.checked), label: "match" },
    },
    {
      key: "location",
      title: "Expected vs actual location",
      value: String(location.total),
      context: location.total ? `${location.open} not fixed yet` : "No location issues",
      dot: AISLIX_PALETTE.blue,
      bar: { pct: share(location.total - location.open, location.total), label: "fixed" },
    },
    {
      key: "extra_facings",
      title: "Extra facings vs planogram",
      value: String(extraFacings.total),
      context: extraFacings.total ? `${extraFacings.open} not fixed yet` : "Nothing outside the plan",
      dot: CA_PINK_BAR,
      bar: { pct: share(extraFacings.total - extraFacings.open, extraFacings.total), label: "fixed" },
    },
    {
      key: "implemented",
      title: "Changes implemented",
      value: implemented.total ? `${implemented.done} of ${implemented.total}` : "N/A",
      context: onTimeJudged
        ? `${Math.round((implemented.onTime / onTimeJudged) * 100)}% on time · ${implemented.pending} pending`
        : `${implemented.pending} pending`,
      dot: AISLIX_PALETTE.green,
      bar: { pct: share(implemented.done, implemented.total), label: "done" },
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
      bar: { pct: prePost.improvedPct, label: "improved" },
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
          <div className="mt-3 flex items-center gap-2">
            <MiniBar pct={c.bar.pct ?? 0} color={c.dot} className="flex-1" />
            <span className="shrink-0 text-[11px] tabular-nums text-mp-muted">
              {c.bar.pct == null ? "N/A" : `${c.bar.pct}% ${c.bar.label}`}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}
