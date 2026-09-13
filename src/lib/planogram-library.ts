/**
 * Planogram library — every uploaded planogram for a store, split into
 * "ready to assign" (no live assignment) and "assigned to team" (read-only).
 *
 * Managers add / edit / delete planograms freely while they are unassigned;
 * assigning a planogram locks it because the assignment owns that snapshot.
 */

import { supabase } from "@/integrations/supabase/client";
import { dbError, requireOrgId, requireUserId } from "@/lib/db/context";
import {
  dominantScopeFromRows,
  toDraftRow,
  type DraftRow,
  type PlanogramRow,
  type SourceType,
} from "@/lib/planogram";
import {
  packageForSave,
  packageFromDb,
  type PlanogramAuditPackage,
} from "@/lib/planogram-audit-package";

export type PlanogramLibraryStatus = "draft" | "active" | "archived";

export type PlanogramVersionSummary = {
  id: string;
  name: string;
  status: PlanogramLibraryStatus;
  source_type: SourceType;
  row_count: number;
  created_at: string;
  location: string;
  category: string;
  sub_category: string;
  facing_count: number;
  is_assigned: boolean;
  assignment: {
    id: string;
    assignee_name: string;
    status: string;
    due_at: string | null;
  } | null;
};

export type PlanogramLibrary = {
  unassigned: PlanogramVersionSummary[];
  assigned: PlanogramVersionSummary[];
};

/** Human label for a planogram when the manager leaves the name blank. */
export function defaultPlanogramName(rows: DraftRow[]): string {
  const scope = dominantScopeFromRows(rows);
  const parts = [scope.location, scope.sub_category || scope.category].filter(Boolean);
  if (parts.length) return parts.join(" · ");
  return `Planogram ${new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })}`;
}

/** Loads every non-archived planogram for a store, with assignment state. */
export async function loadStorePlanograms(storeId: string): Promise<PlanogramLibrary> {
  const orgId = await requireOrgId();

  const { data: versions, error } = await supabase
    .from("planogram_versions")
    .select("id, name, status, source_type, row_count, created_at")
    .eq("org_id", orgId)
    .eq("store_id", storeId)
    .neq("status", "archived")
    .order("created_at", { ascending: false });
  if (error) dbError(error, "Could not load planograms for this store.");

  const rows = (versions ?? []) as Array<{
    id: string;
    name: string | null;
    status: string;
    source_type: string;
    row_count: number | null;
    created_at: string;
  }>;
  if (!rows.length) return { unassigned: [], assigned: [] };

  const versionIds = rows.map((row) => row.id);

  const [{ data: items }, { data: assignments }] = await Promise.all([
    supabase
      .from("planogram_items")
      .select("version_id, location, category, sub_category, expected_qty")
      .in("version_id", versionIds),
    supabase
      .from("scan_assignments")
      .select("id, planogram_version_id, status, due_at, assignee_id")
      .in("planogram_version_id", versionIds)
      .neq("status", "cancelled"),
  ]);

  const itemRows = (items ?? []) as Array<{
    version_id: string;
    location: string | null;
    category: string | null;
    sub_category: string | null;
    expected_qty: number | null;
  }>;
  const assignmentRows = (assignments ?? []) as Array<{
    id: string;
    planogram_version_id: string | null;
    status: string;
    due_at: string | null;
    assignee_id: string;
  }>;

  const names = new Map<string, string>();
  const assigneeIds = [...new Set(assignmentRows.map((row) => row.assignee_id).filter(Boolean))];
  if (assigneeIds.length) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", assigneeIds);
    for (const profile of profiles ?? []) {
      names.set(
        profile.id as string,
        (profile.full_name as string | null)?.trim() ||
          (profile.email as string | null) ||
          "Team member",
      );
    }
  }

  const unassigned: PlanogramVersionSummary[] = [];
  const assigned: PlanogramVersionSummary[] = [];

  for (const version of rows) {
    const versionItems = itemRows.filter((item) => item.version_id === version.id);
    const scope = dominantScopeFromRows(
      versionItems.map((item) => ({
        location: item.location ?? "",
        category: item.category ?? "",
        sub_category: item.sub_category ?? "",
        expected_qty: Number(item.expected_qty ?? 0),
      })),
    );
    const assignment = assignmentRows.find((row) => row.planogram_version_id === version.id);

    const summary: PlanogramVersionSummary = {
      id: version.id,
      name: version.name?.trim() || "Planogram",
      status: (version.status as PlanogramLibraryStatus) ?? "draft",
      source_type: (version.source_type as SourceType) ?? "csv",
      row_count: Number(version.row_count ?? versionItems.length) || versionItems.length,
      created_at: version.created_at,
      location: scope.location,
      category: scope.category,
      sub_category: scope.sub_category,
      facing_count: scope.facingCount,
      is_assigned: Boolean(assignment),
      assignment: assignment
        ? {
            id: assignment.id,
            assignee_name: names.get(assignment.assignee_id) ?? "Team member",
            status: assignment.status,
            due_at: assignment.due_at,
          }
        : null,
    };

    if (summary.is_assigned) assigned.push(summary);
    else unassigned.push(summary);
  }

  return { unassigned, assigned };
}

function itemPayload(row: DraftRow, orgId: string, storeId: string, versionId: string) {
  return {
    version_id: versionId,
    org_id: orgId,
    store_id: storeId,
    location: row.location,
    aisle: row.location || null,
    category: row.category,
    sub_category: row.sub_category,
    brand: row.brand,
    product_name: row.product_name,
    variant: row.variant || null,
    sku: row.sku || null,
    expected_qty: row.expected_qty,
    expected_facings: row.expected_facings ?? null,
    min_facings: row.min_facings ?? null,
    max_facings: row.max_facings ?? null,
    expected_shelf_units: row.expected_shelf_units ?? null,
    mrp_inr: row.mrp_inr ?? null,
    avg_daily_sales: row.avg_daily_sales ?? null,
    shelf_position: row.shelf_position || null,
    match_key: row.match_key || null,
  };
}

/** Creates a new draft planogram in the store's library. */
export async function createStorePlanogram(input: {
  storeId: string;
  rows: DraftRow[];
  sourceType: SourceType;
  name?: string | null;
  sourceFilename?: string | null;
  auditPackage?: PlanogramAuditPackage;
}): Promise<string> {
  const orgId = await requireOrgId();
  const userId = await requireUserId();

  const auditPayload = input.auditPackage ? packageForSave(input.auditPackage) : {};
  const { data: version, error } = await supabase
    .from("planogram_versions")
    .insert({
      org_id: orgId,
      store_id: input.storeId,
      name: input.name?.trim() || defaultPlanogramName(input.rows),
      status: "draft",
      source_type: input.sourceType,
      uploaded_by: userId,
      source_filename: input.sourceFilename ?? null,
      row_count: input.rows.length,
      audit_package: auditPayload as never,
      fixture_id: input.auditPackage?.fixture_id || null,
      store_timezone: input.auditPackage?.store_timezone || null,
    })
    .select("id")
    .single();
  if (error) dbError(error, "Could not save this planogram.");

  const versionId = version!.id as string;
  if (input.rows.length) {
    const { error: itemsError } = await supabase
      .from("planogram_items")
      .insert(input.rows.map((row) => itemPayload(row, orgId, input.storeId, versionId)));
    if (itemsError) dbError(itemsError, "Could not save the expected products.");
  }
  return versionId;
}

/** Loads one planogram plus its rows for editing. */
export async function loadPlanogramForEdit(versionId: string): Promise<{
  id: string;
  name: string;
  source_type: SourceType;
  rows: DraftRow[];
  auditPackage: PlanogramAuditPackage;
}> {
  const { data: version, error } = await supabase
    .from("planogram_versions")
    .select("id, name, source_type, audit_package, fixture_id, store_timezone")
    .eq("id", versionId)
    .single();
  if (error) dbError(error, "Could not load this planogram.");

  const { data: items, error: itemsError } = await supabase
    .from("planogram_items")
    .select(
      "location, category, sub_category, brand, product_name, variant, sku, expected_qty, expected_facings, min_facings, max_facings, expected_shelf_units, mrp_inr, avg_daily_sales, shelf_position, match_key",
    )
    .eq("version_id", versionId)
    .order("created_at", { ascending: true });
  if (itemsError) dbError(itemsError, "Could not load the expected products.");

  const auditPackage = packageFromDb(version!.audit_package);
  if (version!.fixture_id) auditPackage.fixture_id = String(version!.fixture_id);
  if (version!.store_timezone) auditPackage.store_timezone = String(version!.store_timezone);

  return {
    id: version!.id as string,
    name: ((version!.name as string | null) ?? "").trim(),
    source_type: ((version!.source_type as SourceType) ?? "csv") as SourceType,
    rows: (items ?? []).map((item) => toDraftRow(item as Partial<PlanogramRow>)),
    auditPackage,
  };
}

/** Replaces the name and rows of an existing (unassigned) planogram. */
export async function updateStorePlanogram(input: {
  versionId: string;
  storeId: string;
  rows: DraftRow[];
  sourceType: SourceType;
  name?: string | null;
  auditPackage?: PlanogramAuditPackage;
}): Promise<void> {
  const orgId = await requireOrgId();

  const auditPayload = input.auditPackage ? packageForSave(input.auditPackage) : {};
  const { error } = await supabase
    .from("planogram_versions")
    .update({
      name: input.name?.trim() || defaultPlanogramName(input.rows),
      source_type: input.sourceType,
      row_count: input.rows.length,
      updated_at: new Date().toISOString(),
      audit_package: auditPayload as never,
      fixture_id: input.auditPackage?.fixture_id || null,
      store_timezone: input.auditPackage?.store_timezone || null,
    })
    .eq("id", input.versionId);
  if (error) dbError(error, "Could not update this planogram.");

  const { error: deleteError } = await supabase
    .from("planogram_items")
    .delete()
    .eq("version_id", input.versionId);
  if (deleteError) dbError(deleteError, "Could not replace the expected products.");

  if (input.rows.length) {
    const { error: insertError } = await supabase
      .from("planogram_items")
      .insert(input.rows.map((row) => itemPayload(row, orgId, input.storeId, input.versionId)));
    if (insertError) dbError(insertError, "Could not save the expected products.");
  }
}

/** Deletes an unassigned planogram (items cascade). Refuses when assigned. */
export async function deleteStorePlanogram(versionId: string): Promise<void> {
  const { count, error: countError } = await supabase
    .from("scan_assignments")
    .select("id", { count: "exact", head: true })
    .eq("planogram_version_id", versionId)
    .neq("status", "cancelled");
  if (countError) dbError(countError, "Could not check this planogram's assignments.");
  if (count && count > 0) {
    throw new Error("Cannot delete — this planogram is assigned to a team member.");
  }

  const { error } = await supabase.from("planogram_versions").delete().eq("id", versionId);
  if (error) dbError(error, "Could not delete this planogram.");
}

/** Marks a planogram as active once it has been assigned. */
export async function markPlanogramAssigned(versionId: string): Promise<void> {
  const now = new Date().toISOString();
  await supabase
    .from("planogram_versions")
    .update({ status: "active", activated_at: now, effective_from: now })
    .eq("id", versionId)
    .eq("status", "draft");
}
