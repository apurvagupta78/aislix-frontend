import {
  ACTION_TYPES,
  actionStage,
  actionTypeLabel,
  isActionLate,
  type ActionStage,
} from "@/lib/corrective-action-catalog";

/** Fields the Corrective Actions page charts read. All values are persisted action rows. */
export type InsightAction = {
  status: string;
  priority: string;
  source: "ai" | "digital";
  action_type: string | null;
  created_at: string;
  closed_at: string | null;
  verified_at: string | null;
  due_at: string | null;
  assigned_name: string;
  store_id: string | null;
  store_name: string | null;
  escalation_level: number;
  verification_status: string | null;
  before_score: number | null;
  after_score: number | null;
  code: string | null;
  title: string;
};

const DAY = 864e5;

function finishedAt(a: InsightAction): string | null {
  return a.closed_at ?? a.verified_at ?? null;
}

export type PipelineSegment = "overdue" | ActionStage;

export function pipelineCounts(actions: InsightAction[], now = Date.now()): Record<PipelineSegment, number> {
  const out: Record<PipelineSegment, number> = {
    overdue: 0,
    open: 0,
    in_progress: 0,
    submitted: 0,
    verified: 0,
    closed: 0,
  };
  for (const a of actions) {
    if (isActionLate(a, now)) out.overdue += 1;
    else out[actionStage(a.status)] += 1;
  }
  return out;
}

export type CaKpis = {
  open: number;
  submitted: number;
  overdue: number;
  closedLast30: number;
  avgDaysToClose: number | null;
  criticalHighOpen: number;
  recheckPassRate: number | null;
  recheckCount: number;
  escalated: number;
};

export function correctiveActionKpis(actions: InsightAction[], now = Date.now()): CaKpis {
  const openish = actions.filter((a) => {
    const s = actionStage(a.status);
    return s === "open" || s === "in_progress";
  });
  const finished = actions.filter((a) => {
    const s = actionStage(a.status);
    return (s === "closed" || s === "verified") && finishedAt(a);
  });
  const durations = finished.map(
    (a) => (new Date(finishedAt(a)!).getTime() - new Date(a.created_at).getTime()) / DAY,
  );
  const rechecks = actions.filter((a) => a.verification_status === "passed" || a.verification_status === "failed");
  const passed = rechecks.filter((a) => a.verification_status === "passed").length;
  return {
    open: openish.length,
    submitted: actions.filter((a) => actionStage(a.status) === "submitted").length,
    overdue: actions.filter((a) => isActionLate(a, now)).length,
    closedLast30: finished.filter((a) => now - new Date(finishedAt(a)!).getTime() <= 30 * DAY).length,
    avgDaysToClose: durations.length
      ? Math.round((durations.reduce((sum, d) => sum + Math.max(0, d), 0) / durations.length) * 10) / 10
      : null,
    criticalHighOpen: openish.filter((a) => a.priority === "critical" || a.priority === "high").length,
    recheckPassRate: rechecks.length ? Math.round((passed / rechecks.length) * 100) : null,
    recheckCount: rechecks.length,
    escalated: openish.filter((a) => a.escalation_level > 0).length,
  };
}

function startOfWeek(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7;
  return d.getTime() - day * DAY;
}

export type WeeklyFlowPoint = { week: string; weekStart: number; opened: number; closed: number };

export function weeklyFlow(actions: InsightAction[], weeks = 8, now = Date.now()): WeeklyFlowPoint[] {
  const thisWeek = startOfWeek(now);
  const points: WeeklyFlowPoint[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = thisWeek - i * 7 * DAY;
    points.push({
      weekStart,
      week: new Date(weekStart).toLocaleDateString(undefined, { day: "numeric", month: "short" }),
      opened: 0,
      closed: 0,
    });
  }
  const indexOf = (ts: number) => {
    const ws = startOfWeek(ts);
    return points.findIndex((p) => p.weekStart === ws);
  };
  for (const a of actions) {
    const o = indexOf(new Date(a.created_at).getTime());
    if (o >= 0) points[o]!.opened += 1;
    const done = finishedAt(a);
    if (done && (actionStage(a.status) === "closed" || actionStage(a.status) === "verified")) {
      const c = indexOf(new Date(done).getTime());
      if (c >= 0) points[c]!.closed += 1;
    }
  }
  return points;
}

export type TypeCount = { type: string; label: string; open: number; done: number };

export function actionsByType(actions: InsightAction[]): TypeCount[] {
  const map = new Map<string, TypeCount>();
  for (const a of actions) {
    const key = ACTION_TYPES.some((t) => t.value === a.action_type) ? (a.action_type as string) : "other";
    const row = map.get(key) ?? { type: key, label: actionTypeLabel(key), open: 0, done: 0 };
    const stage = actionStage(a.status);
    if (stage === "closed" || stage === "verified") row.done += 1;
    else row.open += 1;
    map.set(key, row);
  }
  return [...map.values()].sort((x, y) => y.open + y.done - (x.open + x.done));
}

export type StoreCount = { store: string; onTime: number; overdue: number };

export function openActionsByStore(actions: InsightAction[], limit = 8, now = Date.now()): StoreCount[] {
  const map = new Map<string, StoreCount>();
  for (const a of actions) {
    const stage = actionStage(a.status);
    if (stage !== "open" && stage !== "in_progress") continue;
    const key = a.store_name ?? "No store";
    const row = map.get(key) ?? { store: key, onTime: 0, overdue: 0 };
    if (isActionLate(a, now)) row.overdue += 1;
    else row.onTime += 1;
    map.set(key, row);
  }
  return [...map.values()]
    .sort((x, y) => y.overdue + y.onTime - (x.overdue + x.onTime) || y.overdue - x.overdue)
    .slice(0, limit);
}

export type AgingBucket = { key: string; label: string; count: number; late: boolean };

export function agingBuckets(actions: InsightAction[], now = Date.now()): AgingBucket[] {
  const buckets: AgingBucket[] = [
    { key: "on_time", label: "On time", count: 0, late: false },
    { key: "due_soon", label: "Due in 24h", count: 0, late: false },
    { key: "late_1", label: "1–3 days late", count: 0, late: true },
    { key: "late_3", label: "3–7 days late", count: 0, late: true },
    { key: "late_7", label: "7+ days late", count: 0, late: true },
  ];
  for (const a of actions) {
    const stage = actionStage(a.status);
    if ((stage !== "open" && stage !== "in_progress") || !a.due_at) continue;
    const diff = (new Date(a.due_at).getTime() - now) / DAY;
    if (diff > 1) buckets[0]!.count += 1;
    else if (diff >= 0) buckets[1]!.count += 1;
    else if (diff >= -3) buckets[2]!.count += 1;
    else if (diff >= -7) buckets[3]!.count += 1;
    else buckets[4]!.count += 1;
  }
  return buckets;
}

export function actionsBySource(actions: InsightAction[]): { ai: number; digital: number } {
  let ai = 0;
  let digital = 0;
  for (const a of actions) {
    if (a.source === "digital") digital += 1;
    else ai += 1;
  }
  return { ai, digital };
}

export type OwnerLoad = { owner: string; open: number; overdue: number; submitted: number; done: number };

export function ownerWorkload(actions: InsightAction[], now = Date.now()): OwnerLoad[] {
  const map = new Map<string, OwnerLoad>();
  for (const a of actions) {
    const row = map.get(a.assigned_name) ?? { owner: a.assigned_name, open: 0, overdue: 0, submitted: 0, done: 0 };
    const stage = actionStage(a.status);
    if (stage === "submitted") row.submitted += 1;
    else if (stage === "closed" || stage === "verified") row.done += 1;
    else if (isActionLate(a, now)) row.overdue += 1;
    else row.open += 1;
    map.set(a.assigned_name, row);
  }
  return [...map.values()].sort(
    (x, y) => y.overdue + y.open - (x.overdue + x.open) || y.submitted - x.submitted,
  );
}

export type RecheckPoint = { code: string; title: string; before: number; after: number; passed: boolean };

export function recheckResults(actions: InsightAction[], limit = 8): RecheckPoint[] {
  return actions
    .filter(
      (a) =>
        a.before_score != null &&
        a.after_score != null &&
        (a.verification_status === "passed" || a.verification_status === "failed"),
    )
    .slice(0, limit)
    .map((a) => ({
      code: a.code ?? "Action",
      title: a.title,
      before: a.before_score as number,
      after: a.after_score as number,
      passed: a.verification_status === "passed",
    }));
}
