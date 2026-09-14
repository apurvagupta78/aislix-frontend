/**
 * Executive overview aggregates — scorecards and action-required queue.
 */

import { supabase } from "@/integrations/supabase/client";
import { dbError, requireOrgId } from "@/lib/db/context";
import type { ExceptionTier } from "@/lib/audit-intelligence";

export type ExecutiveScorecards = {
  assigned: number;
  submitted: number;
  approved: number;
  in_progress: number;
  overdue: number;
  pending_approvals: number;
  stores_critical_variance: number;
  open_corrective_actions: number;
  planogram_compliance_avg: number | null;
  signed_variance_inr: number;
  absolute_variance_inr: number;
  store_health_avg: number | null;
  auditor_on_time_pct: number | null;
  last_refreshed_at: string;
};

export type ActionRequiredItem = {
  id: string;
  severity: ExceptionTier;
  store_name: string;
  shelf_label: string;
  sku_label: string;
  issue: string;
  impact: string;
  recurrence: string;
  owner: string;
  age_due: string;
  evidence_state: "complete" | "missing" | "partial";
  next_action: "review" | "assign" | "investigate" | "recount";
  scan_id?: string;
  assignment_id?: string;
};

const CRITICAL_INR = 10_000;

export async function fetchExecutiveScorecards(days = 7): Promise<ExecutiveScorecards> {
  const orgId = await requireOrgId();
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceIso = since.toISOString();
  const now = new Date();

  const { data: assignments, error: aErr } = await supabase
    .from("scan_assignments")
    .select("id, status, approval_status, due_at, completed_at, audit_mode")
    .eq("org_id", orgId)
    .gte("created_at", sinceIso);
  if (aErr) dbError(aErr, "Could not load assignment metrics.");

  const rows = assignments ?? [];
  let overdue = 0;
  let inProgress = 0;
  let pendingApprovals = 0;
  let approved = 0;
  for (const row of rows) {
    if (row.status === "in_progress") inProgress++;
    if (row.approval_status === "pending_review") pendingApprovals++;
    if (row.status === "completed" || row.approval_status === "approved") approved++;
    if (
      row.due_at &&
      new Date(row.due_at) < now &&
      row.status !== "completed" &&
      row.status !== "cancelled"
    ) {
      overdue++;
    }
  }

  const { data: scans } = await supabase
    .from("shelf_scans")
    .select("id, submission_status, planogram_compliance_percent, store_id, audit_mode")
    .eq("org_id", orgId)
    .gte("created_at", sinceIso);

  const submitted = (scans ?? []).filter(
    (s) =>
      (s as { submission_status?: string }).submission_status === "pending_review" ||
      (s as { submission_status?: string }).submission_status === "submitted",
  ).length;

  const complianceValues = (scans ?? [])
    .map((s) => s.planogram_compliance_percent as number | null)
    .filter((v): v is number => v != null);
  const complianceAvg =
    complianceValues.length > 0
      ? Math.round(
          (complianceValues.reduce((a, b) => a + b, 0) / complianceValues.length) * 10,
        ) / 10
      : null;

  const digitalScanIds = (scans ?? [])
    .filter((s) => (s as { audit_mode?: string }).audit_mode === "digital")
    .map((s) => s.id as string);

  let signedVariance = 0;
  let absVariance = 0;
  const storeVariance = new Set<string>();
  if (digitalScanIds.length) {
    const { data: lines } = await supabase
      .from("digital_audit_lines")
      .select("variance_value_inr, store_id")
      .in("scan_id", digitalScanIds);
    for (const line of lines ?? []) {
      const v = Number(line.variance_value_inr) || 0;
      signedVariance += v;
      absVariance += Math.abs(v);
      if (Math.abs(v) >= CRITICAL_INR) storeVariance.add(line.store_id as string);
    }
  }

  const { count: caCount } = await supabase
    .from("corrective_actions")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .in("status", ["open", "in_progress", "pending"]);

  return {
    assigned: rows.length,
    submitted,
    approved,
    in_progress: inProgress,
    overdue,
    pending_approvals: pendingApprovals,
    stores_critical_variance: storeVariance.size,
    open_corrective_actions: caCount ?? 0,
    planogram_compliance_avg: complianceAvg,
    signed_variance_inr: Math.round(signedVariance * 100) / 100,
    absolute_variance_inr: Math.round(absVariance * 100) / 100,
    store_health_avg: complianceAvg,
    auditor_on_time_pct: null,
    last_refreshed_at: new Date().toISOString(),
  };
}

export async function fetchActionRequiredQueue(limit = 12): Promise<ActionRequiredItem[]> {
  const orgId = await requireOrgId();
  const items: ActionRequiredItem[] = [];

  const { data: pendingReview } = await supabase
    .from("scan_assignments")
    .select("id, scan_id, due_at, assignee_id, stores:store_id (name)")
    .eq("org_id", orgId)
    .eq("approval_status", "pending_review")
    .limit(limit);

  for (const row of pendingReview ?? []) {
    items.push({
      id: `review-${row.id}`,
      severity: "attention",
      store_name: (row.stores as { name?: string })?.name ?? "Store",
      shelf_label: "—",
      sku_label: "Audit pending review",
      issue: "Submitted audit awaiting approval",
      impact: "—",
      recurrence: "—",
      owner: "Unassigned reviewer",
      age_due: row.due_at ? new Date(row.due_at as string).toLocaleDateString() : "—",
      evidence_state: "partial",
      next_action: "review",
      scan_id: row.scan_id as string | undefined,
      assignment_id: row.id as string,
    });
  }

  const { data: lines } = await supabase
    .from("digital_audit_lines")
    .select(
      "id, product_name, sku, variance_value_inr, variance_qty, scan_id, location, stores:store_id (name)",
    )
    .eq("org_id", orgId)
    .not("variance_qty", "is", null)
    .neq("variance_qty", 0)
    .order("updated_at", { ascending: false })
    .limit(limit);

  for (const line of lines ?? []) {
    const valueInr = Math.abs(Number(line.variance_value_inr) || 0);
    const severity: ExceptionTier =
      valueInr >= CRITICAL_INR ? "critical" : valueInr > 0 ? "attention" : "normal";
    items.push({
      id: `var-${line.id}`,
      severity,
      store_name: (line.stores as { name?: string })?.name ?? "Store",
      shelf_label: (line.location as string) || "Shelf",
      sku_label: (line.product_name as string) || (line.sku as string) || "SKU",
      issue: `Quantity variance ${line.variance_qty}`,
      impact: valueInr ? `₹${valueInr.toFixed(0)} signed value` : "Qty discrepancy",
      recurrence: "—",
      owner: "Unassigned",
      age_due: "—",
      evidence_state: "partial",
      next_action: severity === "critical" ? "investigate" : "review",
      scan_id: line.scan_id as string,
    });
  }

  return items.slice(0, limit);
}
