import {
  actionStage,
  isActionLate,
  issueCategoryLabel,
  issueCategoryOf,
  type ActionStage,
} from "@/lib/corrective-action-catalog";

/** Fields the Corrective Actions page charts read. All values are persisted action rows. */
export type InsightAction = {
  status: string;
  priority: string;
  source: "ai" | "digital";
  action_type: string | null;
  issue_category?: string | null;
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
  issue_type?: string | null;
};

const DAY = 864e5;

/** What was wrong on the shelf, in the words a store manager uses. */
export const VARIANCE_TYPES = [
  { value: "planogram", label: "Planogram compliance" },
  { value: "quantity", label: "Quantity / facings" },
  { value: "missing", label: "Missing product" },
  { value: "location", label: "Location" },
  { value: "product", label: "Product / brand" },
  { value: "price", label: "Price" },
  { value: "promotion", label: "Promotion / display" },
  { value: "other", label: "Other" },
] as const;

export type VarianceType = (typeof VARIANCE_TYPES)[number]["value"];

export function varianceTypeLabel(type: string): string {
  return VARIANCE_TYPES.find((t) => t.value === type)?.label ?? "Other";
}

export function actionVarianceType(a: Pick<InsightAction, "action_type" | "title"> & { issue_type?: string | null }): VarianceType {
  const issue = (a.issue_type ?? "").toLowerCase();
  const kind = (a.action_type ?? "").toLowerCase();
  const title = (a.title ?? "").toLowerCase();
  if (/price|pricing|mrp/.test(issue) || kind === "pricing") return "price";
  if (/promo|display|pop|offer/.test(issue) || kind === "display" || kind === "promotion") return "promotion";
  if (/location|placement|position/.test(issue)) return "location";
  if (/brand|wrong_product|variant|product_mismatch/.test(issue)) return "product";
  if (/qty|quantity|facing|shortfall|units/.test(issue) || /below planned quantity|facings/.test(title)) return "quantity";
  if (/missing|oos|out_of_stock|empty/.test(issue) || kind === "availability") return "missing";
  if (/unexpected|planogram|category|unplanned/.test(issue) || kind === "planogram") return "planogram";
  return "other";
}

export type StoreVarianceRow = {
  storeId: string | null;
  store: string;
  total: number;
  open: number;
  counts: Record<VarianceType, number>;
};

/** Every action per store, split by variance type; `open` counts actions not yet fixed. */
export function variancesByStore(actions: InsightAction[]): { rows: StoreVarianceRow[]; totals: Record<VarianceType, number> } {
  const empty = () => Object.fromEntries(VARIANCE_TYPES.map((t) => [t.value, 0])) as Record<VarianceType, number>;
  const totals = empty();
  const map = new Map<string, StoreVarianceRow>();
  for (const a of actions) {
    const key = a.store_id ?? "none";
    const row = map.get(key) ?? { storeId: a.store_id, store: a.store_name ?? "No store", total: 0, open: 0, counts: empty() };
    const type = actionVarianceType(a);
    row.counts[type] += 1;
    row.total += 1;
    const stage = actionStage(a.status);
    if (stage !== "closed" && stage !== "verified") row.open += 1;
    totals[type] += 1;
    map.set(key, row);
  }
  return { rows: [...map.values()].sort((x, y) => y.total - x.total || x.store.localeCompare(y.store)), totals };
}

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
    const key = issueCategoryOf(a);
    const row = map.get(key) ?? { type: key, label: issueCategoryLabel(key), open: 0, done: 0 };
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

/** Fixed actions with a due date: how many were verified or closed by their SLA due date. */
export function slaCompliance(actions: InsightAction[]): { met: number; total: number; pct: number | null } {
  let met = 0;
  let total = 0;
  for (const a of actions) {
    const stage = actionStage(a.status);
    const done = finishedAt(a);
    if ((stage !== "closed" && stage !== "verified") || !done || !a.due_at) continue;
    total += 1;
    if (new Date(done).getTime() <= new Date(a.due_at).getTime()) met += 1;
  }
  return { met, total, pct: total ? Math.round((met / total) * 100) : null };
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
