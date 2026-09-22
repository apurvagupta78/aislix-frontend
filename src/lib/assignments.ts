/**
 * Assigned Scans — Milestone 2.
 *
 * Managers (owner / admin / manager) assign a scan scope to any active member
 * of their organization; assignees see their tasks on /my-scans.
 */

import { supabase } from "@/integrations/supabase/client";
import { formatCategorySelections, type CategorySelection } from "@/lib/category-selections";
import {
  dbError,
  getMembership,
  requireOrgId,
  requireUserId,
  unauthorized,
} from "@/lib/db/context";
import { notifyMember } from "@/lib/notifications.functions";
import type { AuditEvidencePolicy } from "@/lib/audit-evidence-policy";

export type ScopeType = "category" | "sub_category" | "location" | "planogram";

export type ScopeValues = {
  category?: string;
  sub_category?: string;
  location?: string;
  /** Planogram scope only: counts derived from the assignment's own row list. */
  product_count?: number;
  facing_count?: number;
  /** Display name / description from New Audit for assignee lists. */
  audit_name?: string;
  audit_description?: string;
  /** Multi shelf types for sub-category scope (mixed racks). */
  category_selections?: CategorySelection[];
  categories?: string[];
  sub_categories?: string[];
  /** Audit identity captured at creation time. */
  audit_name?: string;
  audit_description?: string;
};

export type AssignmentStatus =
  "pending" | "in_progress" | "needs_correction" | "completed" | "cancelled";

export type AssignableMember = {
  user_id: string;
  role: string;
  name: string;
  email: string;
  status: string;
};

export type AuditMode = "ai" | "digital";

export type ApprovalStatus =
  "pending" | "incomplete" | "submitted" | "pending_review" | "approved" | "rejected" | "flagged";

export type Assignment = {
  id: string;
  org_id: string;
  store_id: string;
  store_name: string;
  scope_type: ScopeType;
  scope_values: ScopeValues;
  status: AssignmentStatus;
  audit_mode: AuditMode;
  approval_status: ApprovalStatus;
  due_at: string | null;
  instructions: string | null;
  created_at: string;
  assignee_id: string;
  assignee_name: string;
  assigner_id: string;
  assigner_name: string;
  expected_products: number;
  planogram_version_id: string | null;
  /** Aisle / location label resolved from the scope or the planogram rows. */
  location: string | null;
  scan_id: string | null;
  /** Planogram compliance for the completed scan, when available. */
  compliance_percent: number | null;
  /** Compliance of the latest attempt, persisted on the assignment. */
  last_compliance_percent: number | null;
  /** How many times the assignee has scanned this shelf. */
  scan_attempts: number;
  /** Corrective actions still open across every attempt. */
  open_issue_count: number;
  verified_at: string | null;
  template_id: string | null;
  template_version: number | null;
};

export type AssignmentAttempt = {
  attempt: number;
  scan_id: string;
  compliance_percent: number | null;
  created_at: string;
  open_issues: number;
  passed: boolean;
};

/** Row of the manager "Team Scans" table. */
export type TeamScan = {
  scan_id: string;
  assignment_id: string | null;
  created_at: string;
  assignee_name: string;
  store_name: string;
  location: string | null;
  compliance_percent: number | null;
  missing: number | null;
  wrong_product: number | null;
  unexpected: number | null;
};

/** Planogram row shape sent to the vision backend. */
export type PlanogramScopeItem = {
  location: string;
  aisle: string;
  category: string;
  sub_category: string;
  brand: string;
  product_name: string;
  sku: string;
  expected_qty: number;
  match_key: string;
};

export const MANAGER_ROLES = ["owner", "admin", "manager", "store_manager"] as const;

export function scopeSummary(type: ScopeType, values: ScopeValues): string {
  if (type === "planogram") {
    const parts = [values.category, values.sub_category, values.location].filter(Boolean);
    return `Planogram · ${parts.length ? parts.join(" · ") : "exact product list"}`;
  }
  if (type === "location") return `Location · ${values.location ?? "—"}`;
  if (type === "sub_category") {
    if (values.category_selections?.length)
      return formatCategorySelections(values.category_selections, 2);
    return `${values.category ?? "—"} · ${values.sub_category ?? "—"}`;
  }
  return `Category · ${values.category ?? "—"}`;
}

/**
 * Manager gate for assignment / schedule / review surfaces.
 * Prefer a direct role row against the active org (fast via requireOrgId stored
 * path) — never race getMembership to null, which falsely denied owners when
 * membership enrichment was slow.
 */
export async function isOrgManager(): Promise<boolean> {
  try {
    const userId = await requireUserId();
    const orgId = await requireOrgId();
    const { data, error } = await supabase
      .from("organization_members")
      .select("role")
      .eq("user_id", userId)
      .eq("org_id", orgId)
      .eq("status", "active")
      .maybeSingle();
    if (error) return false;
    const role = String(data?.role ?? "").toLowerCase();
    return (MANAGER_ROLES as readonly string[]).includes(role);
  } catch {
    return false;
  }
}

/** Every active member of the org except the signed-in user. */
export async function fetchAssignableMembers(): Promise<AssignableMember[]> {
  const orgId = await requireOrgId();
  const userId = await requireUserId();

  const { data, error } = await supabase
    .from("organization_members")
    .select("user_id, role, status, invited_email, profiles:user_id (full_name, email)")
    .eq("org_id", orgId)
    .in("status", ["active", "invited"])
    .neq("user_id", userId);
  if (error) dbError(error, "Could not load your team members.");

  return (data ?? []).map((row) => {
    const profile = (
      row as { profiles?: { full_name?: string | null; email?: string | null } | null }
    ).profiles;
    const email = profile?.email ?? (row as { invited_email?: string | null }).invited_email ?? "";
    return {
      user_id: row.user_id as string,
      role: String(row.role),
      name: profile?.full_name?.trim() || email || "Team member",
      status: String((row as { status?: string }).status ?? "active"),
      email,
    };
  });
}

const ITEM_SELECT =
  "id, location, aisle, category, sub_category, brand, product_name, sku, expected_qty, match_key, shelf_position";

function toScopeItem(row: Record<string, unknown>): PlanogramScopeItem {
  const s = (value: unknown) => (typeof value === "string" ? value : "");
  return {
    location: s(row["location"]),
    aisle: s(row["aisle"]) || s(row["location"]),
    category: s(row["category"]),
    sub_category: s(row["sub_category"]),
    brand: s(row["brand"]),
    product_name: s(row["product_name"]),
    sku: s(row["sku"]),
    expected_qty: Number(row["expected_qty"]) || 0,
    match_key: s(row["match_key"]),
  };
}

/**
 * Planogram rows for a version, narrowed to the assignment scope. A `planogram`
 * scope carries its own exact product list, so every row on the version counts.
 */
export function filterScopeItems(
  items: PlanogramScopeItem[],
  type: ScopeType,
  values: ScopeValues,
): PlanogramScopeItem[] {
  if (type === "planogram") return items;
  const eq = (a: string, b?: string) =>
    Boolean(b) && a.trim().toLowerCase() === String(b).trim().toLowerCase();
  return items.filter((item) => {
    if (type === "location")
      return eq(item.location, values.location) || eq(item.aisle, values.location);
    if (type === "sub_category")
      return eq(item.category, values.category) && eq(item.sub_category, values.sub_category);
    return eq(item.category, values.category);
  });
}

export async function fetchPlanogramScopeItems(
  versionId: string | null,
): Promise<PlanogramScopeItem[]> {
  if (!versionId) return [];
  const { data, error } = await supabase
    .from("planogram_items")
    .select(ITEM_SELECT)
    .eq("version_id", versionId);
  if (error) return [];
  return (data ?? []).map((row) => toScopeItem(row as Record<string, unknown>));
}

async function scopeMeta(
  versionId: string | null,
  type: ScopeType,
  values: ScopeValues,
): Promise<{ count: number; location: string | null }> {
  const scoped = filterScopeItems(await fetchPlanogramScopeItems(versionId), type, values);
  const location =
    values.location?.trim() ||
    scoped.find((item) => item.location || item.aisle)?.location ||
    scoped.find((item) => item.aisle)?.aisle ||
    null;
  // Planogram assignments never show "0 expected products": fall back to the
  // product count captured on the assignment when rows are not readable.
  const count = scoped.length || (type === "planogram" ? Number(values.product_count) || 0 : 0);
  return { count, location: location || null };
}

export async function createScanAssignment(input: {
  storeId: string;
  scopeType: ScopeType;
  scopeValues: ScopeValues;
  assigneeId: string;
  assigneeName: string;
  dueAt?: string | null;
  instructions?: string | null;
  /** Planogram scope: the assignment's own draft planogram version. */
  planogramVersionId?: string | null;
  auditMode?: AuditMode;
  /** Custom audit builder template linkage. */
  templateId?: string | null;
  templateVersion?: number | null;
  templateSnapshot?: Record<string, unknown> | null;
  reviewerId?: string | null;
  evidencePolicy?: AuditEvidencePolicy | null;
  requireRca?: boolean;
  creationSource?: "legacy" | "unified_new_audit" | "schedule" | "api";
  inputSource?:
    "manual_rows" | "csv_upload" | "existing_planogram" | "camera" | "photo_upload" | "template";
}): Promise<string> {
  const orgId = await requireOrgId();
  const assignerId = await requireUserId();

  // Only auto-attach the store's active planogram when the caller omitted
  // planogramVersionId. Explicit null means shelf-only / no-planogram AI audit.
  let versionId: string | null;
  if (input.planogramVersionId === undefined) {
    const { data: version } = await supabase
      .from("planogram_versions")
      .select("id")
      .eq("org_id", orgId)
      .eq("store_id", input.storeId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    versionId = (version?.id as string | null) ?? null;
  } else {
    versionId = input.planogramVersionId;
  }

  const auditMode = input.auditMode ?? "ai";
  const { data, error } = await supabase
    .from("scan_assignments")
    .insert({
      org_id: orgId,
      store_id: input.storeId,
      planogram_version_id: versionId,
      assignee_id: input.assigneeId,
      assigner_id: assignerId,
      scope_type: input.scopeType,
      scope_values: input.scopeValues,
      status: "pending",
      due_at: input.dueAt || null,
      instructions: input.instructions?.trim() || null,
      audit_mode: auditMode,
      approval_status: "pending",
      template_id: input.templateId ?? null,
      template_version: input.templateVersion ?? null,
      template_snapshot: input.templateSnapshot ?? null,
      reviewer_id: input.reviewerId ?? null,
      evidence_policy: input.evidencePolicy ?? undefined,
      require_rca: input.requireRca ?? true,
      creation_source: input.creationSource ?? "legacy",
      input_source: input.inputSource ?? null,
    } as Record<string, unknown>)
    .select("id")
    .single();
  if (error) {
    console.error("[createScanAssignment] scan_assignments insert failed:", error);
    dbError(error, "Could not create the assignment. Please check the assignment setup or permissions.");
  }

  const assignmentId = data!.id as string;

  try {
    await notifyMember({
      data: {
        org_id: orgId,
        user_id: input.assigneeId,
        type: "scan_assigned",
        title: auditMode === "digital" ? "New Digital Audit Assigned" : "New AI Audit Assigned",
        body:
          input.scopeType === "planogram"
            ? `${[input.scopeValues.location, `${input.scopeValues.product_count ?? 0} products`]
                .filter(Boolean)
                .join(" · ")} · ${auditMode === "digital" ? "digital audit" : "planogram audit"}`
            : `You have a new ${auditMode === "digital" ? "digital audit" : "AI audit"} task: ${scopeSummary(input.scopeType, input.scopeValues)}.`,
        payload: { assignment_id: assignmentId, store_id: input.storeId },
      },
    });
  } catch (notifyError) {
    console.error("[assignments] notification delivery failed", notifyError);
  }

  try {
    const { sendAuditAssignedEmail } = await import("@/lib/assignment-emails.functions");
    await sendAuditAssignedEmail({
      data: {
        assignmentId,
        assigneeId: input.assigneeId,
        assignerId,
        storeId: input.storeId,
        auditMode,
        dueAt: input.dueAt ?? null,
        scopeValues: input.scopeValues as Record<string, unknown>,
      },
    });
  } catch (emailError) {
    console.error("[assignments] assignment email failed", emailError);
  }

  return assignmentId;
}

/** Create the same audit task across multiple stores (digital or AI). */
export async function createBulkScanAssignments(input: {
  storeIds: string[];
  scopeType: ScopeType;
  scopeValues: ScopeValues;
  assigneeId: string;
  assigneeName: string;
  dueAt?: string | null;
  instructions?: string | null;
  auditMode?: AuditMode;
  planogramVersionIdByStore?: Record<string, string>;
}): Promise<string[]> {
  const ids: string[] = [];
  for (const storeId of input.storeIds) {
    const id = await createScanAssignment({
      storeId,
      scopeType: input.scopeType,
      scopeValues: input.scopeValues,
      assigneeId: input.assigneeId,
      assigneeName: input.assigneeName,
      dueAt: input.dueAt,
      instructions: input.instructions,
      auditMode: input.auditMode,
      planogramVersionId: input.planogramVersionIdByStore?.[storeId] ?? null,
    });
    ids.push(id);
  }
  return ids;
}

type AssignmentRow = {
  id: string;
  org_id: string;
  store_id: string;
  scope_type: string;
  scope_values: unknown;
  status: string;
  due_at: string | null;
  instructions: string | null;
  created_at: string;
  assignee_id: string;
  assigner_id: string;
  planogram_version_id: string | null;
  scan_id: string | null;
  last_compliance_percent: number | string | null;
  scan_attempts: number | null;
  verified_at: string | null;
  audit_mode?: string | null;
  approval_status?: string | null;
  template_id?: string | null;
  template_version?: number | null;
  stores?: { name?: string | null } | null;
};

const SELECT =
  "id, org_id, store_id, scope_type, scope_values, status, audit_mode, approval_status, due_at, instructions, created_at, assignee_id, assigner_id, planogram_version_id, scan_id, last_compliance_percent, scan_attempts, verified_at, template_id, template_version, stores:store_id (name)";

/** scan_assignments references auth.users, so profile names are resolved separately. */
async function fetchNames(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map();
  const { data } = await supabase.from("profiles").select("id, full_name, email").in("id", unique);
  const map = new Map<string, string>();
  for (const row of data ?? []) {
    map.set(
      row.id as string,
      (row.full_name as string | null)?.trim() || (row.email as string | null) || "Team member",
    );
  }
  return map;
}

/** Compliance percentages keyed by scan id, for completed assignment scans. */
async function fetchCompliance(scanIds: string[]): Promise<Map<string, number | null>> {
  const unique = [...new Set(scanIds.filter(Boolean))];
  const map = new Map<string, number | null>();
  if (!unique.length) return map;
  const { data } = await supabase
    .from("planogram_comparisons")
    .select("scan_id, compliance_percent, created_at")
    .in("scan_id", unique)
    .order("created_at", { ascending: true });
  for (const row of data ?? []) {
    const scanId = row.scan_id as string | null;
    if (!scanId) continue;
    map.set(scanId, row.compliance_percent === null ? null : Number(row.compliance_percent));
  }
  return map;
}

/** Open (or in-progress) corrective actions per assignment, across all attempts. */
export async function fetchOpenIssueCounts(assignmentIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  const unique = [...new Set(assignmentIds.filter(Boolean))];
  if (!unique.length) return counts;

  const { data: comparisons } = await supabase
    .from("planogram_comparisons")
    .select("id, assignment_id")
    .in("assignment_id", unique);
  const rows = (comparisons ?? []) as { id: string; assignment_id: string | null }[];
  if (!rows.length) return counts;

  const assignmentByComparison = new Map(rows.map((row) => [row.id, row.assignment_id]));
  const { data: actions } = await supabase
    .from("corrective_actions")
    .select("id, comparison_id, status")
    .in(
      "comparison_id",
      rows.map((row) => row.id),
    )
    .in("status", ["open", "in_progress"]);

  for (const action of (actions ?? []) as { comparison_id: string }[]) {
    const assignmentId = assignmentByComparison.get(action.comparison_id);
    if (!assignmentId) continue;
    counts.set(assignmentId, (counts.get(assignmentId) ?? 0) + 1);
  }
  return counts;
}

async function mapAssignments(rows: AssignmentRow[]): Promise<Assignment[]> {
  const names = await fetchNames(rows.flatMap((row) => [row.assignee_id, row.assigner_id]));
  const compliance = await fetchCompliance(rows.map((row) => row.scan_id ?? ""));
  const openIssues = await fetchOpenIssueCounts(rows.map((row) => row.id));
  return Promise.all(
    rows.map(async (row) => {
      const scopeType = (row.scope_type as ScopeType) ?? "category";
      const scopeValues = (row.scope_values ?? {}) as ScopeValues;
      const meta = await scopeMeta(row.planogram_version_id, scopeType, scopeValues);
      const last = num(row.last_compliance_percent);
      const scanCompliance = row.scan_id ? (compliance.get(row.scan_id) ?? null) : null;
      return {
        id: row.id,
        org_id: row.org_id,
        store_id: row.store_id,
        store_name: row.stores?.name ?? "Store",
        scope_type: scopeType,
        scope_values: scopeValues,
        status: (row.status as AssignmentStatus) ?? "pending",
        due_at: row.due_at,
        instructions: row.instructions,
        created_at: row.created_at,
        assignee_id: row.assignee_id,
        assignee_name: names.get(row.assignee_id) ?? "Team member",
        assigner_id: row.assigner_id,
        assigner_name: names.get(row.assigner_id) ?? "Team member",
        planogram_version_id: row.planogram_version_id,
        scan_id: row.scan_id ?? null,
        compliance_percent: scanCompliance ?? last,
        last_compliance_percent: last,
        scan_attempts: Number(row.scan_attempts ?? 0) || 0,
        open_issue_count: openIssues.get(row.id) ?? 0,
        verified_at: (row as { verified_at?: string | null }).verified_at ?? null,
        audit_mode: ((row as { audit_mode?: string }).audit_mode as AuditMode) ?? "ai",
        approval_status:
          ((row as { approval_status?: string }).approval_status as ApprovalStatus) ?? "pending",
        location: meta.location,
        expected_products: meta.count,
        template_id: row.template_id ?? null,
        template_version: row.template_version ?? null,
      };
    }),
  );
}

/** All planogram comparison attempts for an assignment (fix → re-scan history). */
export async function fetchAssignmentAttempts(assignmentId: string): Promise<AssignmentAttempt[]> {
  const { data: comparisons, error } = await supabase
    .from("planogram_comparisons")
    .select("id, scan_id, compliance_percent, created_at, summary")
    .eq("assignment_id", assignmentId)
    .order("created_at", { ascending: true });
  if (error) dbError(error, "Could not load assignment attempts.");

  const comparisonIds = (comparisons ?? []).map((c) => c.id as string);
  const openByComparison = new Map<string, number>();
  if (comparisonIds.length) {
    const { data: actions } = await supabase
      .from("corrective_actions")
      .select("comparison_id, status")
      .in("comparison_id", comparisonIds)
      .in("status", ["open", "in_progress"]);
    for (const action of actions ?? []) {
      const cid = action.comparison_id as string;
      openByComparison.set(cid, (openByComparison.get(cid) ?? 0) + 1);
    }
  }

  return (comparisons ?? []).map((row, index) => {
    const summary = (row.summary ?? {}) as Record<string, unknown>;
    const missing = Number(summary.missing_products ?? summary.missing ?? 0);
    const openIssues = openByComparison.get(row.id as string) ?? missing;
    const pct = num(row.compliance_percent);
    return {
      attempt: index + 1,
      scan_id: row.scan_id as string,
      compliance_percent: pct,
      created_at: row.created_at as string,
      open_issues: openIssues,
      passed: pct !== null && pct >= 100 && openIssues === 0,
    };
  });
}

/** Full assignment context used to pre-fill and lock the scan setup form. */
export async function fetchAssignmentById(assignmentId: string): Promise<Assignment | null> {
  const { data, error } = await supabase
    .from("scan_assignments")
    .select(SELECT)
    .eq("id", assignmentId)
    .maybeSingle();
  if (error) dbError(error, "Could not load this assignment.");
  if (!data) return null;
  const [assignment] = await mapAssignments([data as unknown as AssignmentRow]);
  return assignment ?? null;
}

export function isOverdue(assignment: Assignment): boolean {
  if (!assignment.due_at) return false;
  if (assignment.status !== "pending" && assignment.status !== "in_progress") return false;
  return new Date(assignment.due_at).getTime() < Date.now();
}

/** Assignments where the signed-in user is the assignee. */
export async function fetchMyAssignments(): Promise<Assignment[]> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("scan_assignments")
    .select(SELECT)
    .eq("assignee_id", userId)
    .order("created_at", { ascending: false });
  if (error) dbError(error, "Could not load your assigned audits.");
  return mapAssignments((data ?? []) as unknown as AssignmentRow[]);
}

/**
 * Manager view: assignments the signed-in user created, plus every assignment in
 * the org when they manage it. RLS already restricts non-managers to their own.
 */
export async function fetchOrgAssignments(): Promise<Assignment[]> {
  const orgId = await requireOrgId();
  const userId = await requireUserId();
  const manager = await isOrgManager();

  let builder = supabase.from("scan_assignments").select(SELECT).eq("org_id", orgId);
  if (!manager) builder = builder.eq("assigner_id", userId);

  const { data, error } = await builder.order("created_at", { ascending: false });
  if (error) dbError(error, "Could not load team assignments.");
  return mapAssignments((data ?? []) as unknown as AssignmentRow[]);
}

export async function startAssignment(assignmentId: string): Promise<void> {
  const { error } = await supabase
    .from("scan_assignments")
    .update({ status: "in_progress" })
    .eq("id", assignmentId);
  if (error) dbError(error, "Could not start this audit.");
}

export async function cancelAssignment(assignmentId: string): Promise<void> {
  const { error } = await supabase
    .from("scan_assignments")
    .update({ status: "cancelled" })
    .eq("id", assignmentId);
  if (error) dbError(error, "Could not cancel this assignment.");
}

/** Manager action: re-send the "fix the shelf and re-scan" nudge to the assignee. */
export async function requestReScan(assignmentOrId: Assignment | string): Promise<void> {
  const assignment =
    typeof assignmentOrId === "string" ? await fetchAssignmentById(assignmentOrId) : assignmentOrId;
  if (!assignment) return;
  const percent = assignment.last_compliance_percent ?? assignment.compliance_percent ?? null;
  const percentLabel = percent === null ? "—" : `${Math.round(percent)}`;
  await notifyMember({
    data: {
      org_id: assignment.org_id,
      user_id: assignment.assignee_id,
      type: "scan_needs_correction",
      title: "Shelf audit needs correction",
      body: `${percentLabel}% compliance — ${assignment.open_issue_count} issue(s) to fix. Re-audit after correcting the shelf.`,
      payload: {
        assignment_id: assignment.id,
        scan_id: assignment.scan_id,
        compliance_percent: percent,
        open_issue_count: assignment.open_issue_count,
      },
    },
  });
}

/** Count of open tasks assigned to the signed-in user, across every workspace. */
export async function fetchMyPendingCount(): Promise<number> {
  const userId = await requireUserId();
  const { count, error } = await supabase
    .from("scan_assignments")
    .select("id", { count: "exact", head: true })
    .eq("assignee_id", userId)
    .in("status", ["pending", "in_progress", "needs_correction"]);
  if (error) return 0;
  return count ?? 0;
}

/* -------------------------------------------------------------------------- */
/* Manager: team scans                                                        */
/* -------------------------------------------------------------------------- */

const num = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value)))
    return Number(value);
  return null;
};

/** Every scan in the org that was launched from an assignment. */
export async function fetchTeamScans(): Promise<TeamScan[]> {
  const orgId = await requireOrgId();

  const { data, error } = await supabase
    .from("shelf_scans")
    .select("id, created_at, created_by, store_id, assignment_id, stores:store_id (name)")
    .eq("org_id", orgId)
    .not("assignment_id", "is", null)
    .order("created_at", { ascending: false });
  if (error) dbError(error, "Could not load team audits.");

  const rows = (data ?? []) as unknown as {
    id: string;
    created_at: string;
    created_by: string | null;
    assignment_id: string | null;
    stores?: { name?: string | null } | null;
  }[];
  if (!rows.length) return [];

  const [names, { data: comparisons }, { data: assignments }] = await Promise.all([
    fetchNames(rows.map((row) => row.created_by ?? "")),
    supabase
      .from("planogram_comparisons")
      .select("scan_id, compliance_percent, summary, created_at")
      .in(
        "scan_id",
        rows.map((row) => row.id),
      )
      .order("created_at", { ascending: true }),
    supabase
      .from("scan_assignments")
      .select("id, scope_type, scope_values, planogram_version_id")
      .in("id", rows.map((row) => row.assignment_id).filter(Boolean) as string[]),
  ]);

  const byScan = new Map<string, { percent: number | null; summary: Record<string, unknown> }>();
  for (const row of comparisons ?? []) {
    const scanId = row.scan_id as string | null;
    if (!scanId) continue;
    byScan.set(scanId, {
      percent: num(row.compliance_percent),
      summary: (row.summary ?? {}) as Record<string, unknown>,
    });
  }

  // Location falls back to the aisle recorded on the scoped planogram rows.
  const locations = new Map<string, string | null>();
  await Promise.all(
    (assignments ?? []).map(async (row) => {
      const values = (row.scope_values ?? {}) as ScopeValues;
      const explicit = values.location?.trim() || "";
      if (explicit) {
        locations.set(row.id as string, explicit);
        return;
      }
      const meta = await scopeMeta(
        (row.planogram_version_id as string | null) ?? null,
        ((row.scope_type as ScopeType) ?? "category") as ScopeType,
        values,
      );
      locations.set(row.id as string, meta.location);
    }),
  );

  const pick = (summary: Record<string, unknown>, keys: string[]) => {
    for (const key of keys) {
      const value = num(summary[key]);
      if (value !== null) return value;
    }
    return null;
  };

  return rows.map((row) => {
    const comparison = byScan.get(row.id);
    const summary = comparison?.summary ?? {};
    return {
      scan_id: row.id,
      assignment_id: row.assignment_id ?? null,
      created_at: row.created_at,
      assignee_name: names.get(row.created_by ?? "") ?? "Team member",
      store_name: row.stores?.name ?? "Store",
      location: row.assignment_id ? (locations.get(row.assignment_id) ?? null) : null,
      compliance_percent: comparison?.percent ?? null,
      missing: pick(summary, ["missing_products", "missing"]),
      wrong_product: pick(summary, ["wrong_products", "wrong_product"]),
      unexpected: pick(summary, ["unexpected_products", "unexpected"]),
    };
  });
}

/** Manager sign-off after a completed assignment passes compliance checks. */
export async function verifyAssignmentPass(assignmentId: string): Promise<void> {
  const userId = await requireUserId();
  if (!(await isOrgManager())) unauthorized("Only managers can verify assignment passes.");
  const { error } = await supabase
    .from("scan_assignments")
    .update({
      verified_at: new Date().toISOString(),
      verified_by: userId,
    })
    .eq("id", assignmentId)
    .eq("status", "completed");
  if (error) dbError(error, "Could not verify this assignment.");
}

/** Assignment a scan was launched from, if any (used for the results badge). */
export async function fetchScanAssignmentId(scanId: string): Promise<string | null> {
  const meta = await fetchScanAssignmentMeta(scanId);
  return meta?.id ?? null;
}

export type ScanAssignmentMeta = {
  id: string | null;
  assigneeLabel: string | null;
  auditName: string;
  auditDescription: string | null;
  /** Assignment workflow status (pending / in_progress / completed / …). */
  status: string | null;
  assignmentState: string | null;
  submitted: boolean;
};

/** Audit name, description, and assignee label for the results header. */
export async function fetchScanAssignmentMeta(scanId: string): Promise<ScanAssignmentMeta | null> {
  const { data: scan } = await supabase
    .from("shelf_scans")
    .select(
      "assignment_id, category, sub_category_label, sub_category, notes, shelf_label, submission_status, submitted_at",
    )
    .eq("id", scanId)
    .maybeSingle();
  if (!scan) return null;

  let userId: string | null = null;
  try {
    userId = await requireUserId();
  } catch {
    userId = null;
  }

  const assignmentId = (scan.assignment_id as string | null) ?? null;
  let assigneeLabel: string | null = null;
  let auditName: string | null = null;
  let auditDescription: string | null = null;
  let status: string | null = null;
  let assignmentState: string | null = null;

  if (assignmentId) {
    const { data: assignment } = await supabase
      .from("scan_assignments")
      .select("assignee_id, instructions, campaign_id, scope_values, status, assignment_state")
      .eq("id", assignmentId)
      .maybeSingle();
    status = (assignment?.status as string | null) ?? null;
    assignmentState = (assignment?.assignment_state as string | null) ?? null;
    if (assignment?.assignee_id) {
      const names = await fetchNames([assignment.assignee_id as string]);
      const name = names.get(assignment.assignee_id as string) ?? "Team member";
      assigneeLabel =
        userId && assignment.assignee_id === userId ? "Self" : name;
    }
    const scopeValues = (assignment?.scope_values ?? {}) as ScopeValues;
    auditName = scopeValues.audit_name?.trim() || null;
    auditDescription = scopeValues.audit_description?.trim() || null;

    const campaignId = assignment?.campaign_id as string | null;
    if (campaignId) {
      const { data: campaign } = await supabase
        .from("assignment_campaigns")
        .select("name, audit_purpose, instructions")
        .eq("id", campaignId)
        .maybeSingle();
      if (!auditName && campaign?.name) auditName = String(campaign.name).trim() || null;
      if (!auditDescription) {
        auditDescription =
          (campaign?.audit_purpose as string | null)?.trim() ||
          (campaign?.instructions as string | null)?.trim() ||
          null;
      }
    }

    const instructions = (assignment?.instructions as string | null)?.trim() || "";
    if (instructions) {
      const singleShortLine = instructions.length <= 120 && !instructions.includes("\n");
      if (!auditName && singleShortLine) {
        auditName = instructions;
      } else if (!auditDescription) {
        auditDescription = instructions;
      }
    }
  }

  const category = (scan.category as string | null)?.trim() || "";
  const sub =
    ((scan.sub_category_label as string | null) ||
      (scan.sub_category as string | null) ||
      "").trim();
  if (!auditName) {
    auditName = [category, sub].filter(Boolean).join(" · ") || "Shelf audit";
  }
  if (!auditDescription) {
    const shelf = (scan.shelf_label as string | null)?.trim();
    const notes = (scan.notes as string | null)?.trim();
    auditDescription = notes || (shelf ? `Shelf photo audit · ${shelf}` : null);
  }

  const submissionStatus = (scan as { submission_status?: string | null }).submission_status;
  const submittedAt = (scan as { submitted_at?: string | null }).submitted_at;
  const submitted =
    Boolean(submittedAt) ||
    submissionStatus === "pending_review" ||
    submissionStatus === "approved" ||
    assignmentState === "submitted";

  return {
    id: assignmentId,
    assigneeLabel,
    auditName,
    auditDescription,
    status,
    assignmentState,
    submitted,
  };
}
