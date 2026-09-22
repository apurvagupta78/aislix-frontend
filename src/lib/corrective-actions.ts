/**
 * Corrective actions raised by planogram comparisons.
 *
 * Owner/admin: org-wide. Managers: effective store scope only.
 * Members: actions assigned to them (still store-clamped).
 */

import { supabase } from "@/integrations/supabase/client";
import { dbError, requireOrgId, requireUserId } from "@/lib/db/context";
import { isOrgManager } from "@/lib/assignments";

export type ActionStatus = "open" | "in_progress" | "resolved";

export type CorrectiveActionRow = {
  id: string;
  issue_type: string;
  suggestion: string;
  status: ActionStatus;
  created_at: string;
  resolved_at: string | null;
  store_id: string | null;
  store_name: string;
  assignee_id: string | null;
  assignee_name: string;
  scan_id: string | null;
  scan_date: string | null;
  product: string | null;
  assignment_id: string | null;
  compliance_percent: number | null;
};

type ScanLite = {
  id: string;
  created_at: string;
  processing_completed_at: string | null;
  created_by: string | null;
  assignment_id: string | null;
};

const SELECT =
  "id, issue_type, suggestion, status, created_at, resolved_at, comparison_id, comparison_line_id";

export const ACTION_STATUSES: { value: ActionStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
];

export function actionStatusClass(status: string): string {
  if (status === "resolved") return "bg-success/10 text-success";
  if (status === "in_progress") return "bg-brand-soft text-brand";
  return "bg-warning/10 text-warning";
}

export async function fetchCorrectiveActions(): Promise<CorrectiveActionRow[]> {
  const orgId = await requireOrgId();
  const userId = await requireUserId();
  const manager = await isOrgManager();
  const { resolveEffectiveAccessScope, applyStoreScopeFilter } = await import("@/lib/access-scope");
  const scope = await resolveEffectiveAccessScope({ orgId });
  if (!scope.isOrgAdmin && !scope.hasStoreScope) return [];

  let actionsQuery = supabase
    .from("corrective_actions")
    .select(SELECT)
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  // Prefer direct store_id clamp when populated; null store_id rows are filtered via comparisons below.
  if (!scope.isOrgAdmin) {
    const ids = scope.effectiveStoreIds.map((id) => `"${id}"`).join(",");
    actionsQuery = actionsQuery.or(`store_id.in.(${ids}),store_id.is.null`);
  }

  const { data, error } = await actionsQuery;
  if (error) dbError(error, "Could not load corrective actions.");

  const rows = (data ?? []) as unknown as {
    id: string;
    issue_type: string;
    suggestion: string;
    status: string;
    created_at: string;
    resolved_at: string | null;
    comparison_id: string;
    comparison_line_id: string | null;
  }[];
  if (!rows.length) return [];

  let comparisonsQuery = supabase
    .from("planogram_comparisons")
    .select(
      "id, scan_id, store_id, assignment_id, compliance_percent, stores:store_id (name)",
    )
    .in("id", [...new Set(rows.map((row) => row.comparison_id))]);
  comparisonsQuery = applyStoreScopeFilter(comparisonsQuery, scope) ?? comparisonsQuery;

  const [{ data: comparisons }, { data: lines }] = await Promise.all([
    comparisonsQuery,
    supabase
      .from("planogram_comparison_lines")
      .select("id, expected_product, expected_brand, actual_product")
      .in(
        "id",
        rows.map((row) => row.comparison_line_id).filter(Boolean) as string[],
      ),
  ]);

  // Drop actions whose comparison store fell outside scope (null store_id on CA row).
  const comparisonIdsInScope = new Set((comparisons ?? []).map((c) => c.id as string));
  const scopedRows = scope.isOrgAdmin
    ? rows
    : rows.filter((row) => comparisonIdsInScope.has(row.comparison_id));
  if (!scopedRows.length) return [];

  const scanIds = [
    ...new Set(
      ((comparisons ?? []) as { scan_id: string | null }[]).map((c) => c.scan_id ?? ""),
    ),
  ].filter(Boolean);

  const { data: scans } = scanIds.length
    ? await supabase
        .from("shelf_scans")
        .select("id, created_at, processing_completed_at, created_by, assignment_id")
        .in("id", scanIds)
    : { data: [] as ScanLite[] };

  const creatorIds = [
    ...new Set(
      ((scans ?? []) as { created_by: string | null }[]).map((scan) => scan.created_by ?? ""),
    ),
  ].filter(Boolean);

  const { data: profiles } = creatorIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", creatorIds)
    : { data: [] as { id: string; full_name: string | null; email: string | null }[] };

  const nameById = new Map<string, string>();
  for (const profile of profiles ?? []) {
    nameById.set(
      profile.id as string,
      (profile.full_name as string | null)?.trim() ||
        (profile.email as string | null) ||
        "Team member",
    );
  }

  const scanById = new Map(((scans ?? []) as ScanLite[]).map((scan) => [scan.id, scan]));

  // The scan operator and the assignment assignee are normally the same person,
  // but the assignment is the source of truth for who owns the fix.
  const assignmentIds = [
    ...new Set(
      (comparisons ?? [])
        .map((row) => (row as { assignment_id?: string | null }).assignment_id ?? "")
        .filter(Boolean),
    ),
  ] as string[];
  const { data: assignmentRows } = assignmentIds.length
    ? await supabase.from("scan_assignments").select("id, assignee_id").in("id", assignmentIds)
    : { data: [] as { id: string; assignee_id: string | null }[] };
  const assigneeByAssignment = new Map(
    ((assignmentRows ?? []) as { id: string; assignee_id: string | null }[]).map((row) => [
      row.id,
      row.assignee_id,
    ]),
  );
  const assigneeIds = [...new Set([...assigneeByAssignment.values()].filter(Boolean))] as string[];
  const missingNames = assigneeIds.filter((id) => !nameById.has(id));
  if (missingNames.length) {
    const { data: extra } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", missingNames);
    for (const profile of extra ?? []) {
      nameById.set(
        profile.id as string,
        (profile.full_name as string | null)?.trim() ||
          (profile.email as string | null) ||
          "Team member",
      );
    }
  }

  const comparisonById = new Map(
    (
      (comparisons ?? []) as {
        id: string;
        scan_id: string | null;
        store_id: string | null;
        assignment_id: string | null;
        compliance_percent: number | string | null;
        stores?: { name?: string | null } | null;
      }[]
    ).map((row) => [row.id, row]),
  );

  const lineById = new Map(
    (
      (lines ?? []) as {
        id: string;
        expected_product: string | null;
        expected_brand: string | null;
        actual_product: string | null;
      }[]
    ).map((row) => [row.id, row]),
  );

  const mapped = scopedRows.map((row) => {
    const comparison = comparisonById.get(row.comparison_id);
    const scan = comparison?.scan_id ? scanById.get(comparison.scan_id) : undefined;
    const line = row.comparison_line_id ? lineById.get(row.comparison_line_id) : undefined;
    const assignmentId = comparison?.assignment_id ?? null;
    const assigneeId =
      (assignmentId ? assigneeByAssignment.get(assignmentId) : null) ?? scan?.created_by ?? null;
    const product =
      line?.expected_product ||
      line?.actual_product ||
      (line?.expected_brand ? line.expected_brand : null);
    return {
      id: row.id,
      issue_type: String(row.issue_type ?? "other"),
      suggestion: String(row.suggestion ?? ""),
      status: (row.status as ActionStatus) ?? "open",
      created_at: row.created_at,
      resolved_at: row.resolved_at,
      store_id: comparison?.store_id ?? null,
      store_name: comparison?.stores?.name?.trim() || "Unassigned store",
      assignee_id: assigneeId,
      assignee_name: nameById.get(assigneeId ?? "") ?? "Team member",
      scan_id: comparison?.scan_id ?? null,
      scan_date: scan?.processing_completed_at ?? scan?.created_at ?? null,
      product: product ?? null,
      assignment_id: comparison?.assignment_id ?? null,
      compliance_percent:
        comparison?.compliance_percent === null || comparison?.compliance_percent === undefined
          ? null
          : Number(comparison.compliance_percent),
    } satisfies CorrectiveActionRow;
  });

  // Managers: store-scoped (already clamped). Members: assignee filter.
  if (manager && !scope.isOrgAdmin) {
    return mapped.filter(
      (row) => !row.store_id || scope.effectiveStoreIds.includes(row.store_id),
    );
  }
  return manager ? mapped : mapped.filter((row) => row.assignee_id === userId);
}

export async function updateCorrectiveActionStatus(
  id: string,
  status: ActionStatus,
): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase
    .from("corrective_actions")
    .update({
      status,
      resolved_at: status === "resolved" ? new Date().toISOString() : null,
      resolved_by: status === "resolved" ? userId : null,
    })
    .eq("id", id);
  if (error) dbError(error, "Could not update this corrective action.");
}
