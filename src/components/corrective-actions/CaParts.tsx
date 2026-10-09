import { Link } from "@tanstack/react-router";
import { Bot, ChevronRight, ClipboardCheck, Info } from "lucide-react";

import { ACCENT_TINT, AISLIX_PALETTE, type AislixAccent } from "@/lib/ai-audit/kpi-palette";
import {
  ACTION_STAGES,
  actionSourceLabel,
  actionStage,
  actionStageLabel,
  escalationLabel,
  issueCategoryLabel,
  isActionLate,
  isUnreviewedAction,
  type ActionStage,
} from "@/lib/corrective-action-catalog";
import type { LifecycleAction } from "@/lib/corrective-action-lifecycle";
import { slaRemainingLabel } from "@/lib/corrective-action-lifecycle";
import { CA_PINK_BAR, STAGE_COLORS } from "@/components/corrective-actions/CaCharts";
import { hideModelNames } from "@/lib/ai-display-text";
import {
  actualMinutes,
  formatMinutes,
  isDueSoon,
  slaOutcome,
  slaTypeLabel,
  slaTypeOf,
  targetMinutes,
} from "@/lib/sla-insights";
import { cn } from "@/lib/utils";

export function CaKpiCard({
  label,
  value,
  context,
  info,
  accent,
  actionable = false,
}: {
  label: string;
  value: string;
  context: string;
  info: string;
  accent: AislixAccent;
  actionable?: boolean;
}) {
  const dot = accent === "pink" ? CA_PINK_BAR : accent === "grey" ? AISLIX_PALETTE.border : AISLIX_PALETTE[accent];
  return (
    <div className="rounded-lg border border-line bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-center gap-2 text-sm text-mp-muted">
          <span className="size-1.5 shrink-0 rounded-full" style={{ background: dot }} aria-hidden />
          {label}
        </p>
        <span className="flex shrink-0 items-center gap-1.5">
          <span title={info} aria-label={info} className="text-mp-muted"><Info className="size-3.5" /></span>
          {actionable ? <ChevronRight className="size-4 text-navy" aria-hidden /> : null}
        </span>
      </div>
      <p className="mt-2 font-display text-2xl font-semibold tabular-nums leading-none text-navy">{value}</p>
      <p className="mt-1.5 text-xs text-mp-muted">{context}</p>
    </div>
  );
}

const PRIORITY_STYLE: Record<string, { bg: string; border: string }> = {
  critical: { bg: AISLIX_PALETTE.pink, border: CA_PINK_BAR },
  high: { bg: ACCENT_TINT.pink, border: CA_PINK_BAR },
  medium: { bg: ACCENT_TINT.blue, border: AISLIX_PALETTE.blue },
  low: { bg: AISLIX_PALETTE.grey, border: AISLIX_PALETTE.border },
};

export function PriorityPill({ priority }: { priority: string }) {
  const s = PRIORITY_STYLE[priority] ?? PRIORITY_STYLE.low!;
  return (
    <span
      className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize text-navy"
      style={{ background: s.bg, borderColor: s.border }}
    >
      {priority}
    </span>
  );
}

const STAGE_TINT: Record<ActionStage, string> = {
  open: ACCENT_TINT.blue,
  in_progress: ACCENT_TINT.purple,
  submitted: AISLIX_PALETTE.grey,
  verified: ACCENT_TINT.cyan,
  closed: ACCENT_TINT.green,
};

export function StagePill({
  action,
}: {
  action: Pick<LifecycleAction, "status" | "due_at"> & { resolved_by_verification?: boolean };
}) {
  if (isUnreviewedAction(action.status)) {
    const proposed = action.status === "proposed";
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D9E2E8] bg-white px-2 py-0.5 text-[11px] font-semibold text-navy">
        <span
          className="size-1.5 rounded-full"
          style={{ background: proposed ? AISLIX_PALETTE.purple : "#EEF1F4" }}
        />
        {proposed ? "Waiting for review" : "Rejected at review"}
      </span>
    );
  }
  const late = isActionLate(action);
  const stage = actionStage(action.status);
  const label =
    stage === "submitted" && action.resolved_by_verification ? "Resolved by verification" : actionStageLabel(action.status);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold text-navy"
      style={{
        background: late ? AISLIX_PALETTE.pink : STAGE_TINT[stage],
        borderColor: late ? CA_PINK_BAR : STAGE_COLORS[stage],
      }}
    >
      <span className="size-1.5 rounded-full" style={{ background: late ? CA_PINK_BAR : STAGE_COLORS[stage] }} />
      {late ? `Overdue · ${label}` : label}
    </span>
  );
}

export function SourcePill({ source }: { source: "ai" | "digital" }) {
  const Icon = source === "digital" ? ClipboardCheck : Bot;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-mp-muted">
      <Icon className="size-3.5" aria-hidden />
      {actionSourceLabel(source)}
    </span>
  );
}

function dueText(action: LifecycleAction): string {
  if (!action.due_at) return "No due date";
  return slaRemainingLabel(action.due_at, action.status);
}

const OUTCOME_TEXT: Partial<Record<ReturnType<typeof slaOutcome>, string>> = {
  met: "Met",
  breached: "Breached",
  late_open: "Breached",
  awaiting: "Awaiting approval",
};

/** SLA type, target and (for confirmed fixes) the time it actually took. */
export function SlaCell({ action }: { action: LifecycleAction }) {
  const outcome = slaOutcome(action);
  const actual = actualMinutes(action);
  const soon = isDueSoon(action);
  const text = soon ? "Due soon" : OUTCOME_TEXT[outcome];
  const late = outcome === "breached" || outcome === "late_open";
  return (
    <div className="text-xs">
      <p className="text-navy">{slaTypeLabel(slaTypeOf(action), true)}</p>
      <p className="text-mp-muted">
        Target {formatMinutes(targetMinutes(action))}
        {actual != null ? ` · took ${formatMinutes(actual)}` : ""}
      </p>
      {text ? (
        <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-navy">
          <span
            className="size-1.5 rounded-full"
            style={{
              background: late ? CA_PINK_BAR : outcome === "met" ? AISLIX_PALETTE.green : soon ? AISLIX_PALETTE.blue : AISLIX_PALETTE.border,
            }}
            aria-hidden
          />
          {text}
        </span>
      ) : null}
    </div>
  );
}

export function CaTable({ rows }: { rows: LifecycleAction[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[68rem] text-sm">
        <thead className="text-xs text-mp-muted" style={{ background: AISLIX_PALETTE.page }}>
          <tr>
            <th className="px-4 py-2.5 text-left font-medium">Action</th>
            <th className="px-3 py-2.5 text-left font-medium">Issue</th>
            <th className="px-3 py-2.5 text-left font-medium">Store</th>
            <th className="px-3 py-2.5 text-left font-medium">Owner</th>
            <th className="px-3 py-2.5 text-left font-medium">Priority</th>
            <th className="px-3 py-2.5 text-left font-medium">Due</th>
            <th className="px-3 py-2.5 text-left font-medium">SLA</th>
            <th className="px-3 py-2.5 text-left font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const escalation = escalationLabel(row.escalation_level);
            return (
              <tr key={row.id} className="border-t align-top hover:bg-[#F4F7F9]/60" style={{ borderColor: AISLIX_PALETTE.border }}>
                <td className="max-w-[340px] px-4 py-3">
                  <Link
                    to="/corrective-actions/$actionId"
                    params={{ actionId: row.id }}
                    className="font-semibold text-navy hover:underline"
                  >
                    {hideModelNames(row.title || row.suggestion || "Corrective action")}
                  </Link>
                  {row.title && row.suggestion && row.suggestion.trim() !== row.title.trim() ? (
                    <p className="mt-0.5 line-clamp-1 text-xs text-mp-muted">{hideModelNames(row.suggestion)}</p>
                  ) : null}
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-mp-muted">
                    <span className="font-medium text-navy">{row.code ?? "—"}</span>
                    <SourcePill source={row.source} />
                  </p>
                </td>
                <td className="px-3 py-3 text-navy">{issueCategoryLabel(row.issue_category)}</td>
                <td className="px-3 py-3 text-navy">{row.store_name ?? <span className="text-mp-muted">No store</span>}</td>
                <td className="px-3 py-3 text-navy">{row.assigned_name}</td>
                <td className="px-3 py-3">
                  <PriorityPill priority={row.priority} />
                </td>
                <td className="px-3 py-3">
                  <span className={cn("text-xs", isActionLate(row) ? "font-semibold text-navy" : "text-mp-muted")}>
                    {dueText(row)}
                  </span>
                  {escalation ? <p className="mt-0.5 text-[11px] text-mp-muted">{escalation}</p> : null}
                </td>
                <td className="px-3 py-3">
                  <SlaCell action={row} />
                </td>
                <td className="px-3 py-3">
                  <StagePill action={row} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function CaBoard({ rows }: { rows: LifecycleAction[] }) {
  return (
    <div className="grid gap-3 overflow-x-auto p-3 md:grid-cols-5">
      {ACTION_STAGES.map((stage) => {
        const items = rows.filter((r) => actionStage(r.status) === stage.value);
        return (
          <div
            key={stage.value}
            className="flex min-w-[220px] flex-col rounded-xl border"
            style={{ borderColor: AISLIX_PALETTE.border, background: AISLIX_PALETTE.page }}
          >
            <div className="flex items-center justify-between px-3 py-2.5">
              <span className="inline-flex items-center gap-2 text-xs font-medium text-navy">
                <span className="size-2 rounded-full" style={{ background: STAGE_COLORS[stage.value] }} />
                {stage.label}
              </span>
              <span className="text-xs font-semibold tabular-nums text-mp-muted">{items.length}</span>
            </div>
            <div className="max-h-[560px] space-y-2 overflow-y-auto px-2 pb-2">
              {items.length === 0 ? (
                <p className="px-2 py-6 text-center text-xs text-mp-muted">Nothing here</p>
              ) : (
                items.slice(0, 60).map((row) => (
                  <Link
                    key={row.id}
                    to="/corrective-actions/$actionId"
                    params={{ actionId: row.id }}
                    className="block rounded-lg border bg-white p-3"
                    style={{
                      borderColor: AISLIX_PALETTE.border,
                      boxShadow: isActionLate(row) ? `inset 3px 0 0 ${CA_PINK_BAR}` : undefined,
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[11px] font-semibold text-mp-muted">{row.code ?? "—"}</span>
                      <PriorityPill priority={row.priority} />
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm font-semibold text-navy">{hideModelNames(row.title ?? "")}</p>
                    <p className="mt-1 text-[11px] text-mp-muted">
                      {issueCategoryLabel(row.issue_category)} · {row.store_name ?? "No store"}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
                      <span className="truncate text-navy">{row.assigned_name}</span>
                      <span className={cn(isActionLate(row) ? "font-semibold text-navy" : "text-mp-muted")}>
                        {dueText(row)}
                      </span>
                    </div>
                  </Link>
                ))
              )}
              {items.length > 60 ? (
                <p className="px-2 py-1 text-center text-[11px] text-mp-muted">
                  +{items.length - 60} more — use filters or the table
                </p>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
