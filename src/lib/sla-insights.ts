/**
 * SLA math for corrective actions. Reads persisted timestamps only:
 * raised (created_at), deadline (due_at), fixed (submitted_at, then verified/closed).
 * A fix counts once a manager or AI re-check confirmed it (verified or closed).
 */

import { actionStage } from "@/lib/corrective-action-catalog";

export type SlaType = "replenishment" | "expiry_damage" | "issue_resolution" | "corrective_action";

export const SLA_TYPES: ReadonlyArray<{
  value: SlaType;
  label: string;
  short: string;
  description: string;
  defaultMinutes: number;
}> = [
  {
    value: "replenishment",
    label: "Shelf replenishment",
    short: "Replenishment",
    description: "Out-of-stock or low-stock products refilled on the shelf.",
    defaultMinutes: 15,
  },
  {
    value: "expiry_damage",
    label: "Expiry & damaged products",
    short: "Expiry & damaged",
    description: "Expired or damaged products removed from the shelf.",
    defaultMinutes: 60,
  },
  {
    value: "issue_resolution",
    label: "Issue resolution",
    short: "Issue resolution",
    description: "Store issues such as safety, hygiene, process or documentation resolved.",
    defaultMinutes: 1440,
  },
  {
    value: "corrective_action",
    label: "Corrective action",
    short: "Corrective action",
    description: "Planogram, location, facings, quantity, price and promotion fixes.",
    defaultMinutes: 2880,
  },
];

export function slaTypeLabel(value: string | null | undefined, short = false): string {
  const t = SLA_TYPES.find((s) => s.value === value);
  if (!t) return "Corrective action";
  return short ? t.short : t.label;
}

export type SlaAction = {
  id: string;
  code: string | null;
  title: string;
  status: string;
  priority: string;
  source: "ai" | "digital";
  action_type: string | null;
  issue_type?: string | null;
  issue_category?: string | null;
  sla_type: string | null;
  sla_minutes: number | null;
  created_at: string;
  due_at: string | null;
  submitted_at: string | null;
  verified_at: string | null;
  closed_at: string | null;
  resolved_at: string | null;
  store_id: string | null;
  store_name: string | null;
  assigned_to: string | null;
  assigned_name: string;
  delay_reason: string | null;
  root_cause: string | null;
};

/** Same rules as the database classifier, for rows saved before SLA types existed. */
export function slaTypeOf(a: Pick<SlaAction, "sla_type" | "action_type" | "issue_type" | "title">): SlaType {
  if (SLA_TYPES.some((t) => t.value === a.sla_type)) return a.sla_type as SlaType;
  const issue = (a.issue_type ?? "").toLowerCase();
  const text = (a.title ?? "").toLowerCase();
  if (/expir|damage/.test(issue) || /expired|expiry|damaged/.test(text)) return "expiry_damage";
  if (/^missing|out_of_stock|^oos|empty|low_stock/.test(issue) || a.action_type === "availability") return "replenishment";
  if (["safety", "hygiene", "process", "documentation", "training", "compliance"].includes(a.action_type ?? ""))
    return "issue_resolution";
  return "corrective_action";
}

export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes)) return "N/A";
  const m = Math.max(0, minutes);
  if (m < 60) return `${Math.max(1, Math.round(m))} min`;
  if (m < 48 * 60) {
    const h = m / 60;
    return `${h < 10 ? Math.round(h * 10) / 10 : Math.round(h)} h`;
  }
  return `${Math.round((m / 1440) * 10) / 10} days`;
}

const ms = (iso: string | null | undefined): number | null => {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : null;
};

export function targetMinutes(a: Pick<SlaAction, "sla_minutes" | "due_at" | "created_at">): number | null {
  if (a.sla_minutes != null && a.sla_minutes > 0) return a.sla_minutes;
  const due = ms(a.due_at);
  const created = ms(a.created_at);
  return due != null && created != null && due > created ? Math.round((due - created) / 60000) : null;
}

/** When the store team fixed it: the (last) submission, else when it was verified or closed. */
export function completedAt(a: Pick<SlaAction, "submitted_at" | "verified_at" | "closed_at" | "resolved_at">): number | null {
  return ms(a.submitted_at) ?? ms(a.resolved_at) ?? ms(a.verified_at) ?? ms(a.closed_at);
}

/**
 * met / breached: fix confirmed, on time or late.
 * late_open: still not fixed and past the deadline (a breach that is also pending).
 * open: not fixed, deadline not reached. awaiting: fix submitted, not yet confirmed.
 * none: no deadline recorded.
 */
export type SlaOutcome = "met" | "breached" | "late_open" | "open" | "awaiting" | "none";

export function slaOutcome(a: SlaAction, now = Date.now()): SlaOutcome {
  const due = ms(a.due_at);
  if (due == null) return "none";
  const stage = actionStage(a.status);
  if (stage === "closed" || stage === "verified") {
    const done = completedAt(a);
    if (done == null) return "none";
    return done <= due ? "met" : "breached";
  }
  if (stage === "submitted") return "awaiting";
  return now > due ? "late_open" : "open";
}

/** Minutes from raised to fixed, for confirmed fixes only. */
export function actualMinutes(a: SlaAction): number | null {
  const stage = actionStage(a.status);
  if (stage !== "closed" && stage !== "verified") return null;
  const done = completedAt(a);
  const created = ms(a.created_at);
  if (done == null || created == null) return null;
  return Math.max(0, (done - created) / 60000);
}

/** Open, before the deadline, with at most 20% of the SLA window left (same rule as the alerts). */
export function isDueSoon(a: SlaAction, now = Date.now()): boolean {
  if (slaOutcome(a, now) !== "open") return false;
  const due = ms(a.due_at)!;
  const created = ms(a.created_at) ?? due;
  const window = Math.max(60_000, 0.2 * (due - created));
  return due - now <= window;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((x, y) => x - y);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

export type SlaSummary = {
  total: number;
  met: number;
  breached: number;
  lateOpen: number;
  open: number;
  awaiting: number;
  dueSoon: number;
  /** Breaches = fixed late + still open past the deadline. */
  breaches: number;
  /** Fix not confirmed yet: open, late open or awaiting verification. */
  pending: number;
  /** met / (met + breached + late open); null when nothing has reached its deadline or been fixed. */
  compliancePct: number | null;
  medianActualMin: number | null;
  medianTargetMin: number | null;
};

export function slaSummary(actions: SlaAction[], now = Date.now()): SlaSummary {
  let met = 0;
  let breached = 0;
  let lateOpen = 0;
  let open = 0;
  let awaiting = 0;
  let dueSoon = 0;
  const actuals: number[] = [];
  const targets: number[] = [];
  for (const a of actions) {
    const outcome = slaOutcome(a, now);
    if (outcome === "met") met += 1;
    else if (outcome === "breached") breached += 1;
    else if (outcome === "late_open") lateOpen += 1;
    else if (outcome === "open") open += 1;
    else if (outcome === "awaiting") awaiting += 1;
    if (isDueSoon(a, now)) dueSoon += 1;
    const actual = actualMinutes(a);
    if (actual != null) actuals.push(actual);
    const target = targetMinutes(a);
    if (target != null) targets.push(target);
  }
  const judged = met + breached + lateOpen;
  return {
    total: actions.length,
    met,
    breached,
    lateOpen,
    open,
    awaiting,
    dueSoon,
    breaches: breached + lateOpen,
    pending: open + lateOpen + awaiting,
    compliancePct: judged ? Math.round((met / judged) * 100) : null,
    medianActualMin: median(actuals),
    medianTargetMin: median(targets),
  };
}

export type SlaTypeRow = SlaSummary & { type: SlaType; label: string };

export function slaByType(actions: SlaAction[], now = Date.now()): SlaTypeRow[] {
  return SLA_TYPES.map((t) => ({
    type: t.value,
    label: t.short,
    ...slaSummary(
      actions.filter((a) => slaTypeOf(a) === t.value),
      now,
    ),
  }));
}

export type SlaGroupRow = SlaSummary & { key: string; label: string };

function groupBy(
  actions: SlaAction[],
  keyOf: (a: SlaAction) => { key: string; label: string },
  now: number,
): SlaGroupRow[] {
  const groups = new Map<string, { label: string; rows: SlaAction[] }>();
  for (const a of actions) {
    const { key, label } = keyOf(a);
    const g = groups.get(key) ?? { label, rows: [] };
    g.rows.push(a);
    groups.set(key, g);
  }
  return [...groups.entries()]
    .map(([key, g]) => ({ key, label: g.label, ...slaSummary(g.rows, now) }))
    .sort((x, y) => y.breaches - x.breaches || y.pending - x.pending || x.label.localeCompare(y.label));
}

export function slaByStore(actions: SlaAction[], now = Date.now()): SlaGroupRow[] {
  return groupBy(actions, (a) => ({ key: a.store_id ?? "none", label: a.store_name ?? "No store" }), now);
}

export function slaByOwner(actions: SlaAction[], now = Date.now()): SlaGroupRow[] {
  return groupBy(actions, (a) => ({ key: a.assigned_to ?? "none", label: a.assigned_name || "Unassigned" }), now);
}

export type TeamMemberRef = { user_id: string; name: string; reports_to?: string | null };

/** Team = the owner's manager; managers without a manager lead their own team. */
export function slaByTeam(actions: SlaAction[], members: TeamMemberRef[], now = Date.now()): SlaGroupRow[] {
  const byId = new Map(members.map((m) => [m.user_id, m]));
  const managers = new Set(members.map((m) => m.reports_to).filter(Boolean) as string[]);
  return groupBy(
    actions,
    (a) => {
      const owner = a.assigned_to ? byId.get(a.assigned_to) : undefined;
      const lead = owner?.reports_to ?? (a.assigned_to && managers.has(a.assigned_to) ? a.assigned_to : null);
      if (!lead) return { key: "none", label: "No team" };
      return { key: lead, label: `${byId.get(lead)?.name ?? "Manager"}'s team` };
    },
    now,
  );
}

export type DelayReasonRow = { reason: string; count: number };

/** Why deadlines were missed: the recorded delay reason, else the root cause. */
export function delayReasons(actions: SlaAction[], now = Date.now()): DelayReasonRow[] {
  const counts = new Map<string, number>();
  for (const a of actions) {
    const outcome = slaOutcome(a, now);
    if (outcome !== "breached" && outcome !== "late_open") continue;
    const reason =
      a.delay_reason?.trim() || a.root_cause?.trim() || (outcome === "late_open" ? "Still open, no reason yet" : "No reason recorded");
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }
  return [...counts.entries()].map(([reason, count]) => ({ reason, count })).sort((x, y) => y.count - x.count);
}

export type SlaAlert = {
  id: string;
  code: string | null;
  title: string;
  store: string;
  owner: string;
  dueAt: string;
  slaType: SlaType;
  kind: "due_soon" | "missed";
  /** Minutes until the deadline (negative = minutes late). */
  minutesLeft: number;
};

export function slaAlerts(actions: SlaAction[], now = Date.now()): SlaAlert[] {
  const out: SlaAlert[] = [];
  for (const a of actions) {
    const outcome = slaOutcome(a, now);
    const soon = isDueSoon(a, now);
    if (outcome !== "late_open" && !soon) continue;
    out.push({
      id: a.id,
      code: a.code,
      title: a.title,
      store: a.store_name ?? "No store",
      owner: a.assigned_name || "Unassigned",
      dueAt: a.due_at!,
      slaType: slaTypeOf(a),
      kind: outcome === "late_open" ? "missed" : "due_soon",
      minutesLeft: Math.round((ms(a.due_at)! - now) / 60000),
    });
  }
  return out.sort((x, y) => (x.kind === y.kind ? x.minutesLeft - y.minutesLeft : x.kind === "due_soon" ? -1 : 1));
}

export type WeeklyCompliancePoint = { week: string; weekStart: number; met: number; missed: number; pct: number | null };

const DAY = 864e5;

function startOfWeek(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime() - ((d.getDay() + 6) % 7) * DAY;
}

/** SLA compliance by the week the deadline fell in. */
export function weeklyCompliance(actions: SlaAction[], weeks = 8, now = Date.now()): WeeklyCompliancePoint[] {
  const thisWeek = startOfWeek(now);
  const points: WeeklyCompliancePoint[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = thisWeek - i * 7 * DAY;
    points.push({
      weekStart,
      week: new Date(weekStart).toLocaleDateString(undefined, { day: "numeric", month: "short" }),
      met: 0,
      missed: 0,
      pct: null,
    });
  }
  for (const a of actions) {
    const outcome = slaOutcome(a, now);
    if (outcome !== "met" && outcome !== "breached" && outcome !== "late_open") continue;
    const idx = points.findIndex((p) => p.weekStart === startOfWeek(ms(a.due_at)!));
    if (idx < 0) continue;
    if (outcome === "met") points[idx]!.met += 1;
    else points[idx]!.missed += 1;
  }
  for (const p of points) {
    const n = p.met + p.missed;
    p.pct = n ? Math.round((p.met / n) * 100) : null;
  }
  return points;
}

/**
 * Open deadlines closest to breach: still not confirmed fixed, soonest (or most overdue) first.
 * Reads the saved deadline only.
 */
export function topOpenDeadlines<T extends SlaAction>(
  actions: T[],
  limit = 5,
  now = Date.now(),
): Array<T & { minutesLeft: number }> {
  const open: Array<T & { minutesLeft: number }> = [];
  for (const a of actions) {
    const outcome = slaOutcome(a, now);
    if (outcome !== "open" && outcome !== "late_open") continue;
    const due = ms(a.due_at);
    if (due == null) continue;
    open.push({ ...a, minutesLeft: Math.round((due - now) / 60000) });
  }
  open.sort((a, b) => a.minutesLeft - b.minutesLeft);
  return open.slice(0, limit);
}

/** Filters used by the SLA page and dashboard links (`sla`, `outcome` search params). */
export function matchesSlaFilters(a: SlaAction, slaType: string, outcome: string, now = Date.now()): boolean {
  if (slaType !== "all" && slaTypeOf(a) !== slaType) return false;
  if (outcome === "all" || !outcome) return true;
  const o = slaOutcome(a, now);
  if (outcome === "breached") return o === "breached" || o === "late_open";
  if (outcome === "due_soon") return isDueSoon(a, now);
  if (outcome === "pending") return o === "open" || o === "late_open" || o === "awaiting";
  return o === outcome;
}
