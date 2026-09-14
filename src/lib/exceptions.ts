/**
 * Workspace exception records — materialized from variances, reviews, and corrective actions.
 */

import { supabase } from "@/integrations/supabase/client";
import { dbError, requireOrgId, requireUserId } from "@/lib/db/context";
import type { ExceptionTier } from "@/lib/audit-intelligence";

export type ExceptionLifecycle =
  | "open"
  | "acknowledged"
  | "investigating"
  | "action_assigned"
  | "awaiting_verification"
  | "resolved"
  | "reopened";

export type ExceptionSourceType = "digital_variance" | "pending_review" | "corrective_action";

export type ExceptionRecord = {
  id: string;
  source_type: ExceptionSourceType;
  source_id: string;
  scan_id: string | null;
  store_id: string | null;
  store_name: string;
  assignment_id: string | null;
  severity: ExceptionTier;
  lifecycle: ExceptionLifecycle;
  owner_id: string | null;
  owner_name: string;
  due_at: string | null;
  title: string;
  description: string | null;
  impact_label: string | null;
  shelf_label: string | null;
  sku_label: string | null;
  created_at: string;
  updated_at: string;
};

export type ExceptionFilters = {
  storeId?: string;
  severity?: ExceptionTier | "all";
  lifecycle?: ExceptionLifecycle | "all";
  ownerId?: string;
};

const CRITICAL_INR = 10_000;

const LIFECYCLE_LABELS: Record<ExceptionLifecycle, string> = {
  open: "Open",
  acknowledged: "Acknowledged",
  investigating: "Investigating",
  action_assigned: "Action assigned",
  awaiting_verification: "Awaiting verification",
  resolved: "Resolved",
  reopened: "Reopened",
};

export function exceptionLifecycleLabel(lifecycle: ExceptionLifecycle): string {
  return LIFECYCLE_LABELS[lifecycle] ?? lifecycle;
}

async function syncVirtualExceptions(orgId: string): Promise<void> {
  const inserts: Record<string, unknown>[] = [];

  const { data: pendingReview } = await supabase
    .from("scan_assignments")
    .select("id, scan_id, due_at, store_id, stores:store_id (name)")
    .eq("org_id", orgId)
    .eq("approval_status", "pending_review");

  for (const row of pendingReview ?? []) {
    inserts.push({
      org_id: orgId,
      source_type: "pending_review",
      source_id: row.id as string,
      scan_id: row.scan_id as string | null,
      store_id: row.store_id as string,
      assignment_id: row.id as string,
      severity: "attention",
      title: "Audit pending review",
      description: "Submitted audit awaiting manager approval",
      shelf_label: "—",
      sku_label: "Full audit",
      due_at: row.due_at as string | null,
      impact_label: "—",
    });
  }

  const { data: lines } = await supabase
    .from("digital_audit_lines")
    .select(
      "id, product_name, sku, variance_value_inr, variance_qty, scan_id, location, store_id, stores:store_id (name)",
    )
    .eq("org_id", orgId)
    .not("variance_qty", "is", null)
    .neq("variance_qty", 0)
    .order("updated_at", { ascending: false })
    .limit(200);

  for (const line of lines ?? []) {
    const valueInr = Math.abs(Number(line.variance_value_inr) || 0);
    const severity: ExceptionTier =
      valueInr >= CRITICAL_INR ? "critical" : valueInr > 0 ? "attention" : "normal";
    inserts.push({
      org_id: orgId,
      source_type: "digital_variance",
      source_id: line.id as string,
      scan_id: line.scan_id as string,
      store_id: line.store_id as string,
      severity,
      title: `Quantity variance ${line.variance_qty}`,
      description: (line.product_name as string) || (line.sku as string) || "SKU variance",
      shelf_label: (line.location as string) || "Shelf",
      sku_label: (line.product_name as string) || (line.sku as string) || "SKU",
      impact_label: valueInr ? `₹${valueInr.toFixed(0)} signed value` : "Qty discrepancy",
    });
  }

  const { data: actions } = await supabase
    .from("corrective_actions")
    .select("id, issue_type, suggestion, status, assigned_to, comparison_id")
    .eq("org_id", orgId)
    .in("status", ["open", "in_progress"]);

  if (actions?.length) {
    const compIds = [...new Set(actions.map((a) => a.comparison_id as string))];
    const { data: comps } = await supabase
      .from("planogram_comparisons")
      .select("id, scan_id, store_id, assignment_id, stores:store_id (name)")
      .in("id", compIds);
    const compById = new Map((comps ?? []).map((c) => [c.id as string, c]));

    for (const action of actions) {
      const comp = compById.get(action.comparison_id as string);
      inserts.push({
        org_id: orgId,
        source_type: "corrective_action",
        source_id: action.id as string,
        scan_id: (comp?.scan_id as string) ?? null,
        store_id: (comp?.store_id as string) ?? null,
        assignment_id: (comp?.assignment_id as string) ?? null,
        owner_id: action.assigned_to as string | null,
        severity: "attention",
        lifecycle: action.status === "in_progress" ? "investigating" : "open",
        title: String(action.issue_type ?? "Corrective action"),
        description: String(action.suggestion ?? ""),
        shelf_label: "Planogram",
        sku_label: "—",
        impact_label: "Compliance gap",
      });
    }
  }

  if (!inserts.length) return;

  const { error } = await supabase.from("audit_exceptions").upsert(inserts, {
    onConflict: "org_id,source_type,source_id",
    ignoreDuplicates: false,
  });
  if (error && !String(error.message).includes("audit_exceptions")) {
    dbError(error, "Could not sync exception records.");
  }
}

export async function fetchExceptions(filters: ExceptionFilters = {}): Promise<ExceptionRecord[]> {
  const orgId = await requireOrgId();
  await syncVirtualExceptions(orgId);

  let query = supabase
    .from("audit_exceptions")
    .select("*")
    .eq("org_id", orgId)
    .order("updated_at", { ascending: false })
    .limit(100);

  if (filters.storeId && filters.storeId !== "all") {
    query = query.eq("store_id", filters.storeId);
  }
  if (filters.severity && filters.severity !== "all") {
    query = query.eq("severity", filters.severity);
  }
  if (filters.lifecycle && filters.lifecycle !== "all") {
    query = query.eq("lifecycle", filters.lifecycle);
  }
  if (filters.ownerId && filters.ownerId !== "all") {
    query = filters.ownerId === "unassigned"
      ? query.is("owner_id", null)
      : query.eq("owner_id", filters.ownerId);
  }

  const { data, error } = await query;
  if (error) {
    if (String(error.message).includes("audit_exceptions") || error.code === "42P01") {
      return fetchExceptionsFallback(orgId, filters);
    }
    dbError(error, "Could not load exceptions.");
  }

  const rows = data ?? [];
  const storeIds = [...new Set(rows.map((r) => r.store_id).filter(Boolean))] as string[];
  const ownerIds = [...new Set(rows.map((r) => r.owner_id).filter(Boolean))] as string[];

  const [{ data: stores }, { data: profiles }] = await Promise.all([
    storeIds.length
      ? supabase.from("stores").select("id, name").in("id", storeIds)
      : Promise.resolve({ data: [] }),
    ownerIds.length
      ? supabase.from("profiles").select("id, full_name, email").in("id", ownerIds)
      : Promise.resolve({ data: [] }),
  ]);

  const storeNames = new Map((stores ?? []).map((s) => [s.id as string, s.name as string]));
  const ownerNames = new Map(
    (profiles ?? []).map((p) => [
      p.id as string,
      (p.full_name as string)?.trim() || (p.email as string) || "Unassigned",
    ]),
  );

  return rows.map((row) => ({
    id: row.id as string,
    source_type: row.source_type as ExceptionSourceType,
    source_id: row.source_id as string,
    scan_id: row.scan_id as string | null,
    store_id: row.store_id as string | null,
    store_name: storeNames.get(row.store_id as string) ?? "Store",
    assignment_id: row.assignment_id as string | null,
    severity: row.severity as ExceptionTier,
    lifecycle: row.lifecycle as ExceptionLifecycle,
    owner_id: row.owner_id as string | null,
    owner_name: row.owner_id ? (ownerNames.get(row.owner_id as string) ?? "Assigned") : "Unassigned",
    due_at: row.due_at as string | null,
    title: row.title as string,
    description: row.description as string | null,
    impact_label: row.impact_label as string | null,
    shelf_label: row.shelf_label as string | null,
    sku_label: row.sku_label as string | null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }));
}

async function fetchExceptionsFallback(
  orgId: string,
  filters: ExceptionFilters,
): Promise<ExceptionRecord[]> {
  const { fetchActionRequiredQueue } = await import("@/lib/audit-executive");
  const queue = await fetchActionRequiredQueue(50);
  return queue
    .filter((item) => {
      if (filters.severity && filters.severity !== "all" && item.severity !== filters.severity) {
        return false;
      }
      return true;
    })
    .map((item) => ({
      id: item.id,
      source_type: item.scan_id ? "digital_variance" : "pending_review",
      source_id: item.id,
      scan_id: item.scan_id ?? null,
      store_id: null,
      store_name: item.store_name,
      assignment_id: item.assignment_id ?? null,
      severity: item.severity,
      lifecycle: "open" as ExceptionLifecycle,
      owner_id: null,
      owner_name: item.owner,
      due_at: null,
      title: item.issue,
      description: item.sku_label,
      impact_label: item.impact,
      shelf_label: item.shelf_label,
      sku_label: item.sku_label,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
}

export async function fetchExceptionById(id: string): Promise<ExceptionRecord | null> {
  const orgId = await requireOrgId();
  await syncVirtualExceptions(orgId);

  const { data, error } = await supabase
    .from("audit_exceptions")
    .select("*")
    .eq("org_id", orgId)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    if (error.code === "42P01") return null;
    dbError(error, "Could not load exception.");
  }
  if (!data) return null;

  const list = await fetchExceptions({});
  return list.find((e) => e.id === id) ?? null;
}

export async function assignExceptionOwner(input: {
  exceptionId: string;
  ownerId: string;
  dueAt?: string | null;
  lifecycle?: ExceptionLifecycle;
}): Promise<void> {
  await requireUserId();
  const { error } = await supabase
    .from("audit_exceptions")
    .update({
      owner_id: input.ownerId,
      due_at: input.dueAt ?? null,
      lifecycle: input.lifecycle ?? "action_assigned",
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.exceptionId);

  if (error) {
    if (error.code === "42P01") {
      throw new Error("Exception records are not available yet. Apply the audit_exceptions migration.");
    }
    dbError(error, "Could not assign owner.");
  }
}

export async function updateExceptionLifecycle(
  id: string,
  lifecycle: ExceptionLifecycle,
): Promise<void> {
  const { error } = await supabase
    .from("audit_exceptions")
    .update({ lifecycle, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) dbError(error, "Could not update exception.");
}
