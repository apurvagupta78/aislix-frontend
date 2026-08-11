/**
 * Corrective actions raised by planogram comparisons.
 *
 * Managers (owner / admin / manager) see every action in the workspace; other
 * members only see actions raised by scans they ran themselves.
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

  const { data, error } = await supabase
    .from("corrective_actions")
    .select(SELECT)
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
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

  const [{ data: comparisons }, { data: lines }] = await Promise.all([
    supabase
      .from("planogram_comparisons")
      .select("id, scan_id, store_id, stores:store_id (name)")
      .in("id", [...new Set(rows.map((row) => row.comparison_id))]),
    supabase
      .from("planogram_comparison_lines")
      .select("id, expected_product, expected_brand, actual_product")
      .in(
        "id",
        rows.map((row) => row.comparison_line_id).filter(Boolean) as string[],
      ),
  ]);

  const scanIds = [
    ...new Set(((comparisons ?? []) as { scan_id: string | null }[]).map((c) => c.scan_id ?? "")),
  ].filter(Boolean);

  const { data: scans } = scanIds.length
    ? await supabase.from("shelf_scans").select("id, created_at, created_by").in("id", scanIds)
    : { data: [] as { id: string; created_at: string; created_by: string | null }[] };

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

  const scanById = new Map(
    ((scans ?? []) as { id: string; created_at: string; created_by: string | null }[]).map(
      (scan) => [scan.id, scan],
    ),
  );

  const comparisonById = new Map(
    (
      (comparisons ?? []) as {
        id: string;
        scan_id: string | null;
        store_id: string | null;
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

  const mapped = rows.map((row) => {
    const comparison = comparisonById.get(row.comparison_id);
    const scan = comparison?.scan_id ? scanById.get(comparison.scan_id) : undefined;
    const line = row.comparison_line_id ? lineById.get(row.comparison_line_id) : undefined;
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
      store_name: comparison?.stores?.name ?? "Store",
      assignee_id: scan?.created_by ?? null,
      assignee_name: nameById.get(scan?.created_by ?? "") ?? "Team member",
      scan_id: comparison?.scan_id ?? null,
      scan_date: scan?.created_at ?? null,
      product: product ?? null,
    } satisfies CorrectiveActionRow;
  });

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
