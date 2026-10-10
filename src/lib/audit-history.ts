// Audit history: every audit the signed-in user ran or assigned (or, for
// managers, everyone's audits in their store scope). One row per audit attempt
// (shelf_scans) plus assigned audits that have not produced a scan yet.

import { supabase } from "@/integrations/supabase/client";
import { dbError, requireOrgId, requireUserId } from "@/lib/db/context";
import { resolveAssignmentDisplayStatus } from "@/lib/assignment-status-ui";
import type { ScanStatus } from "@/lib/scan-history";

export type AuditHistoryScope = "mine" | "team";

export type AuditHistoryStatus =
  | "not_started"
  | "in_progress"
  | "submitted"
  | "approved"
  | "needs_correction"
  | "completed"
  | "failed"
  | "cancelled";

export const AUDIT_HISTORY_STATUS_LABELS: Record<AuditHistoryStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  submitted: "Submitted",
  approved: "Approved",
  needs_correction: "Re-audit requested",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

export type AuditHistoryRow = {
  /** Stable key: the scan id, or `assignment:<id>` for audits not started yet. */
  key: string;
  scan_id: string | null;
  assignment_id: string | null;
  store_id: string | null;
  store: string;
  /** When the audit ran (scan) or was assigned (no scan yet). */
  date: string;
  due_at: string | null;
  location: string | null;
  category: string | null;
  products_detected: number | null;
  audit_mode: "ai" | "digital";
  scan_status: ScanStatus | null;
  status: AuditHistoryStatus;
  compliance: number | null;
  assignee_id: string | null;
  assignee_name: string | null;
  assigner_id: string | null;
  conducted_by_id: string | null;
  conducted_by_name: string | null;
  /** Recurring series this audit was created by. */
  schedule_id: string | null;
  /** Set on the row that stands for a recurring series itself (not one of its rounds). */
  series: AuditHistorySeries | null;
};

export type AuditHistorySeries = {
  id: string;
  name: string;
  paused: boolean;
  nextRunAt: string | null;
  repeatLabel: string;
  createdBy: string | null;
  storeIds: string[];
  assigneeIds: string[];
};

/** True for a recurring series and for every round it created. */
export function isRecurringRow(row: AuditHistoryRow): boolean {
  return Boolean(row.series || row.schedule_id);
}

export type AuditHistoryData = {
  rows: AuditHistoryRow[];
  userId: string;
  /** Managers may switch between their own audits and their store scope. */
  canSeeTeam: boolean;
  /** True when the row cap was hit and older audits were left out. */
  truncated: boolean;
};

type ScanRow = {
  id: string;
  status: string;
  audit_mode: string | null;
  shelf_label: string | null;
  category: string | null;
  total_products: number | null;
  created_at: string;
  store_id: string | null;
  created_by: string | null;
  finalized_by: string | null;
  assignment_id: string | null;
};

type AssignmentRow = {
  id: string;
  status: string;
  approval_status: string | null;
  audit_mode: string | null;
  store_id: string | null;
  assignee_id: string | null;
  assigner_id: string | null;
  scan_id: string | null;
  due_at: string | null;
  created_at: string;
  last_compliance_percent: number | null;
  schedule_id: string | null;
};

const SCAN_COLUMNS =
  "id, status, audit_mode, shelf_label, category, total_products, created_at, store_id, created_by, finalized_by, assignment_id";
const ASSIGNMENT_COLUMNS =
  "id, status, approval_status, audit_mode, store_id, assignee_id, assigner_id, scan_id, due_at, created_at, last_compliance_percent, schedule_id";

const BATCH = 1000;
const MAX_ROWS = 5000;
const ID_CHUNK = 150;

type PageResult<T> = PromiseLike<{ data: T[] | null; error: unknown }>;

async function fetchAllPages<T>(
  page: (from: number, to: number) => PageResult<T>,
  message: string,
): Promise<{ rows: T[]; truncated: boolean }> {
  const rows: T[] = [];
  for (let from = 0; from < MAX_ROWS; from += BATCH) {
    const { data, error } = await page(from, from + BATCH - 1);
    if (error) dbError(error as Parameters<typeof dbError>[0], message);
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < BATCH) return { rows, truncated: false };
  }
  return { rows, truncated: true };
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function toScanStatus(status: string): ScanStatus {
  if (status === "completed") return "completed";
  if (status === "failed") return "failed";
  return "processing";
}

function toMode(mode: string | null | undefined): "ai" | "digital" {
  return mode === "digital" ? "digital" : "ai";
}

function assignmentStatus(assignment: AssignmentRow, hasScan: boolean): AuditHistoryStatus {
  const display = resolveAssignmentDisplayStatus({
    status: assignment.status,
    approval_status: assignment.approval_status,
  });
  switch (display) {
    case "pending":
      return hasScan ? "in_progress" : "not_started";
    case "submitted":
    case "pending_review":
      return "submitted";
    case "approved":
      return "approved";
    case "needs_correction":
      return "needs_correction";
    case "cancelled":
      return "cancelled";
    case "completed":
      return "completed";
    default:
      return "in_progress";
  }
}

function scanStatus(scan: ScanRow, assignment: AssignmentRow | undefined): AuditHistoryStatus {
  const status = toScanStatus(scan.status);
  if (status === "failed") return "failed";
  if (status === "processing") return "in_progress";
  return assignment ? assignmentStatus(assignment, true) : "completed";
}

function compliance(assignment: AssignmentRow | undefined): number | null {
  const value = assignment?.last_compliance_percent;
  return value === null || value === undefined ? null : Number(value);
}

export async function fetchAuditHistory(scope: AuditHistoryScope): Promise<AuditHistoryData> {
  const orgId = await requireOrgId();
  const userId = await requireUserId();
  const { resolveEffectiveAccessScope } = await import("@/lib/access-scope");
  const access = await resolveEffectiveAccessScope({ orgId });
  const canSeeTeam = access.isManager;
  const team = scope === "team" && canSeeTeam;

  // Free plan only shows the last 7 days. Data is never deleted, just filtered.
  const { fetchHistoryCutoffIso } = await import("@/lib/subscription-limits");
  const cutoff = await fetchHistoryCutoffIso();

  if (team && !access.isOrgAdmin && !access.hasStoreScope) {
    return { rows: [], userId, canSeeTeam, truncated: false };
  }
  const storeIds = team && !access.isOrgAdmin ? access.effectiveStoreIds : null;

  const assignmentPage = (from: number, to: number) => {
    let query = supabase.from("scan_assignments").select(ASSIGNMENT_COLUMNS).eq("org_id", orgId);
    if (team) {
      if (storeIds) query = query.in("store_id", storeIds);
    } else {
      query = query.or(`assignee_id.eq.${userId},assigner_id.eq.${userId}`);
    }
    if (cutoff) query = query.gte("created_at", cutoff);
    return query.order("created_at", { ascending: false }).range(from, to) as unknown as PageResult<AssignmentRow>;
  };

  const scanPage = (from: number, to: number) => {
    let query = supabase.from("shelf_scans").select(SCAN_COLUMNS).eq("org_id", orgId);
    if (team) {
      if (storeIds) query = query.in("store_id", storeIds);
    } else {
      query = query.or(`created_by.eq.${userId},finalized_by.eq.${userId}`);
    }
    if (cutoff) query = query.gte("created_at", cutoff);
    return query.order("created_at", { ascending: false }).range(from, to) as unknown as PageResult<ScanRow>;
  };

  const [assignmentResult, scanResult] = await Promise.all([
    fetchAllPages(assignmentPage, "Could not load assigned audits."),
    fetchAllPages(scanPage, "Could not load audit history."),
  ]);
  let truncated = assignmentResult.truncated || scanResult.truncated;

  const assignmentsById = new Map(assignmentResult.rows.map((row) => [row.id, row]));
  const scansById = new Map(scanResult.rows.map((row) => [row.id, row]));

  // Audits I assigned to someone else were run by them — load those scans too.
  if (!team && assignmentsById.size > 0) {
    for (const ids of chunk([...assignmentsById.keys()], ID_CHUNK)) {
      const { rows, truncated: more } = await fetchAllPages(
        (from, to) => {
          let query = supabase.from("shelf_scans").select(SCAN_COLUMNS).in("assignment_id", ids);
          if (cutoff) query = query.gte("created_at", cutoff);
          return query.order("created_at", { ascending: false }).range(from, to) as unknown as PageResult<ScanRow>;
        },
        "Could not load audit history.",
      );
      truncated ||= more;
      for (const row of rows) scansById.set(row.id, row);
    }
  }

  // Scans whose assignment is outside the loaded set still need its status.
  const missingAssignmentIds = Array.from(
    new Set(
      [...scansById.values()]
        .map((scan) => scan.assignment_id)
        .filter((id): id is string => Boolean(id) && !assignmentsById.has(id!)),
    ),
  );
  for (const ids of chunk(missingAssignmentIds, ID_CHUNK)) {
    const { data } = await supabase.from("scan_assignments").select(ASSIGNMENT_COLUMNS).in("id", ids);
    for (const row of (data ?? []) as unknown as AssignmentRow[]) assignmentsById.set(row.id, row);
  }

  const scannedAssignmentIds = new Set(
    [...scansById.values()].map((scan) => scan.assignment_id).filter((id): id is string => Boolean(id)),
  );

  const scans = [...scansById.values()];
  const unscannedAssignments = assignmentResult.rows.filter(
    (assignment) => !assignment.scan_id && !scannedAssignmentIds.has(assignment.id),
  );

  const conductorOf = (scan: ScanRow) =>
    scan.finalized_by ?? (toScanStatus(scan.status) === "completed" ? scan.created_by : null);

  const profileIds = new Set<string>();
  for (const scan of scans) {
    const conductor = conductorOf(scan);
    if (conductor) profileIds.add(conductor);
  }
  for (const assignment of assignmentsById.values()) {
    if (assignment.assignee_id) profileIds.add(assignment.assignee_id);
  }

  const [{ data: storeRows }, profileRows] = await Promise.all([
    supabase.from("stores").select("id, name").eq("org_id", orgId),
    (async () => {
      const out: { id: string; full_name: string | null; email: string | null }[] = [];
      for (const ids of chunk([...profileIds], ID_CHUNK)) {
        const { data } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
        out.push(...((data ?? []) as typeof out));
      }
      return out;
    })(),
  ]);
  const storeName = new Map((storeRows ?? []).map((row) => [row.id as string, row.name as string]));
  const personName = new Map(
    profileRows.map((row) => [row.id, row.full_name?.trim() || row.email || "Member"]),
  );
  const nameOf = (id: string | null | undefined) => (id ? (personName.get(id) ?? null) : null);

  const rows: AuditHistoryRow[] = [];

  for (const scan of scans) {
    const assignment = scan.assignment_id ? assignmentsById.get(scan.assignment_id) : undefined;
    const conductor = conductorOf(scan);
    const mode = toMode(scan.audit_mode);
    rows.push({
      key: scan.id,
      scan_id: scan.id,
      assignment_id: scan.assignment_id,
      store_id: scan.store_id,
      store: (scan.store_id && storeName.get(scan.store_id)) || "—",
      date: scan.created_at,
      due_at: assignment?.due_at ?? null,
      location: scan.shelf_label,
      category: scan.category,
      // Digital audits never write total_products; its 0 default is not a count.
      products_detected: mode === "digital" ? null : scan.total_products,
      audit_mode: mode,
      scan_status: toScanStatus(scan.status),
      status: scanStatus(scan, assignment),
      compliance: compliance(assignment),
      assignee_id: assignment?.assignee_id ?? null,
      assignee_name: nameOf(assignment?.assignee_id),
      assigner_id: assignment?.assigner_id ?? null,
      conducted_by_id: conductor,
      conducted_by_name: nameOf(conductor),
      schedule_id: assignment?.schedule_id ?? null,
      series: null,
    });
  }

  for (const assignment of unscannedAssignments) {
    rows.push({
      key: `assignment:${assignment.id}`,
      scan_id: null,
      assignment_id: assignment.id,
      store_id: assignment.store_id,
      store: (assignment.store_id && storeName.get(assignment.store_id)) || "—",
      date: assignment.created_at,
      due_at: assignment.due_at,
      location: null,
      category: null,
      products_detected: null,
      audit_mode: toMode(assignment.audit_mode),
      scan_status: null,
      status: assignmentStatus(assignment, false),
      compliance: null,
      assignee_id: assignment.assignee_id,
      assignee_name: nameOf(assignment.assignee_id),
      assigner_id: assignment.assigner_id,
      conducted_by_id: null,
      conducted_by_name: null,
      schedule_id: assignment.schedule_id,
      series: null,
    });
  }

  rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return { rows, userId, canSeeTeam, truncated };
}

/* -------------------------------- filtering ------------------------------- */

export type AuditHistoryFilters = {
  q: string;
  store: string;
  dateFrom: string;
  dateTo: string;
  status: AuditHistoryStatus | "all";
  assignee: string;
  conductedBy: string;
  type: "all" | "assigned" | "adhoc" | "recurring";
  mode: "all" | "ai" | "digital";
  sort: "newest" | "oldest";
};

export const EMPTY_AUDIT_HISTORY_FILTERS: AuditHistoryFilters = {
  q: "",
  store: "all",
  dateFrom: "",
  dateTo: "",
  status: "all",
  assignee: "all",
  conductedBy: "all",
  type: "all",
  mode: "all",
  sort: "newest",
};

/** Number of narrowing filters in use (search and sort excluded). */
export function activeAuditHistoryFilterCount(filters: AuditHistoryFilters): number {
  return [
    filters.store !== "all",
    Boolean(filters.dateFrom),
    Boolean(filters.dateTo),
    filters.status !== "all",
    filters.assignee !== "all",
    filters.conductedBy !== "all",
    filters.type !== "all",
    filters.mode !== "all",
  ].filter(Boolean).length;
}

function localDayStart(day: string): number {
  return new Date(`${day}T00:00:00`).getTime();
}

export function filterAuditHistory(rows: AuditHistoryRow[], filters: AuditHistoryFilters): AuditHistoryRow[] {
  const q = filters.q.trim().toLowerCase();
  const from = filters.dateFrom ? localDayStart(filters.dateFrom) : null;
  const to = filters.dateTo ? localDayStart(filters.dateTo) + 24 * 60 * 60 * 1000 : null;

  const out = rows.filter((row) => {
    const series = row.series;
    if (filters.store !== "all" && !(series ? series.storeIds.includes(filters.store) : row.store_id === filters.store)) {
      return false;
    }
    if (filters.status !== "all" && (series || row.status !== filters.status)) return false;
    if (
      filters.assignee !== "all" &&
      !(series ? series.assigneeIds.includes(filters.assignee) : row.assignee_id === filters.assignee)
    ) {
      return false;
    }
    if (filters.conductedBy !== "all" && row.conducted_by_id !== filters.conductedBy) return false;
    if (filters.type === "assigned" && !row.assignment_id) return false;
    if (filters.type === "adhoc" && (row.assignment_id || series)) return false;
    if (filters.type === "recurring" && !isRecurringRow(row)) return false;
    if (filters.mode !== "all" && row.audit_mode !== filters.mode) return false;
    const time = new Date(row.date).getTime();
    if (from !== null && time < from) return false;
    if (to !== null && time >= to) return false;
    if (q) {
      const haystack = [
        series?.name,
        series?.repeatLabel,
        row.store,
        row.scan_id,
        row.assignment_id,
        row.location,
        row.category,
        row.assignee_name,
        row.conducted_by_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  if (filters.sort === "oldest") out.reverse();
  return out;
}

export type AuditHistoryOption = { id: string; name: string };

function uniqueOptions(entries: [string | null, string | null][]): AuditHistoryOption[] {
  const byId = new Map<string, string>();
  for (const [id, name] of entries) if (id && !byId.has(id)) byId.set(id, name ?? "—");
  return [...byId.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}

export function auditHistoryOptions(rows: AuditHistoryRow[]) {
  return {
    stores: uniqueOptions(rows.map((row) => [row.store_id, row.store])),
    assignees: uniqueOptions(rows.map((row) => [row.assignee_id, row.assignee_name])),
    conductors: uniqueOptions(rows.map((row) => [row.conducted_by_id, row.conducted_by_name])),
  };
}
