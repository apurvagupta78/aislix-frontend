/**
 * First-class Findings — problems discovered during Digital / AI / AI-Assisted audits.
 * Auto-created from digital_audit_lines and planogram_comparison_lines; never duplicates
 * existing source rows (unique org_id + source_type + source_id).
 */

import { supabase } from "@/integrations/supabase/client";
import { dbError, requireOrgId, requireUserId } from "@/lib/db/context";
import type { RcaCode } from "@/lib/digital-audit";
import { RCA_OPTIONS } from "@/lib/digital-audit";
import type { DashboardFilterState } from "@/lib/dashboard-filters";

export type FindingType =
  | "inventory_shortage"
  | "inventory_excess"
  | "out_of_stock"
  | "wrong_placement"
  | "planogram_violation"
  | "pricing_issue"
  | "damaged_product"
  | "expired_product"
  | "near_expiry"
  | "missing_product"
  | "receiving_issue"
  | "display_issue"
  | "shelf_execution_issue"
  | "other";

export type FindingSeverity = "low" | "medium" | "high" | "critical";
export type FindingStatus =
  | "open"
  | "assigned"
  | "in_progress"
  | "pending_verification"
  | "resolved"
  | "rejected"
  | "closed";
export type AuditOrigin = "digital" | "ai" | "ai_assisted";
export type ConfirmationState = "ai_suggested" | "human_confirmed";

export type Finding = {
  id: string;
  org_id: string;
  scan_id: string | null;
  assignment_id: string | null;
  store_id: string | null;
  store_name: string;
  source_type: string;
  source_id: string | null;
  audit_origin: AuditOrigin;
  finding_type: FindingType;
  severity: FindingSeverity;
  confirmation_state: ConfirmationState;
  title: string;
  description: string | null;
  sku: string | null;
  product_name: string | null;
  category: string | null;
  shelf_label: string | null;
  expected_value: number | null;
  actual_value: number | null;
  variance_units: number | null;
  variance_percentage: number | null;
  variance_value_inr: number | null;
  rca_code: RcaCode | null;
  rca_notes: string | null;
  status: FindingStatus;
  assigned_to: string | null;
  assigned_name: string;
  due_at: string | null;
  created_at: string;
  resolved_at: string | null;
  verified_at: string | null;
  closed_at: string | null;
};

export type FindingsKpis = {
  total: number;
  open: number;
  critical: number;
  overdue: number;
  resolved: number;
  closed: number;
  pending_verification: number;
  value_at_risk: number;
  reaudit_improvement_pct: number | null;
  repeat_failure_rate: number | null;
};

export const FINDING_TYPES: { value: FindingType; label: string }[] = [
  { value: "inventory_shortage", label: "Inventory shortage" },
  { value: "inventory_excess", label: "Inventory excess" },
  { value: "out_of_stock", label: "Out of stock" },
  { value: "wrong_placement", label: "Wrong placement" },
  { value: "planogram_violation", label: "Planogram violation" },
  { value: "pricing_issue", label: "Pricing issue" },
  { value: "damaged_product", label: "Damaged product" },
  { value: "expired_product", label: "Expired product" },
  { value: "near_expiry", label: "Near expiry" },
  { value: "missing_product", label: "Missing product" },
  { value: "receiving_issue", label: "Receiving issue" },
  { value: "display_issue", label: "Display issue" },
  { value: "shelf_execution_issue", label: "Shelf execution issue" },
  { value: "other", label: "Other" },
];

export const FINDING_SEVERITIES: { value: FindingSeverity; label: string; className: string }[] = [
  { value: "low", label: "Low", className: "bg-[var(--aislix-supermarket-bg)] text-[var(--aislix-primary)]" },
  { value: "medium", label: "Medium", className: "bg-[var(--aislix-custom-bg)] text-[var(--aislix-primary)]" },
  { value: "high", label: "High", className: "bg-[var(--aislix-warehouse-bg)] text-[var(--aislix-primary)]" },
  { value: "critical", label: "Critical", className: "bg-[var(--aislix-darkstore-bg)] text-[var(--aislix-primary)]" },
];

export const FINDING_STATUSES: { value: FindingStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "assigned", label: "Assigned" },
  { value: "in_progress", label: "In progress" },
  { value: "pending_verification", label: "Pending verification" },
  { value: "resolved", label: "Resolved" },
  { value: "rejected", label: "Rejected" },
  { value: "closed", label: "Closed" },
];

export const AUDIT_ORIGIN_LABEL: Record<AuditOrigin, string> = {
  digital: "Digital Audit",
  ai: "AI Audit",
  ai_assisted: "AI-Assisted Audit",
};

export function findingTypeLabel(type: string): string {
  return FINDING_TYPES.find((t) => t.value === type)?.label ?? type;
}

export function findingSeverityMeta(severity: string) {
  return (
    FINDING_SEVERITIES.find((s) => s.value === severity) ?? {
      value: "medium" as FindingSeverity,
      label: severity,
      className: "bg-muted text-muted-foreground",
    }
  );
}

export function rcaLabel(code: string | null | undefined): string {
  if (!code) return "—";
  return RCA_OPTIONS.find((o) => o.code === code)?.label ?? code;
}

export function isOverdue(dueAt: string | null, status: string): boolean {
  if (!dueAt) return false;
  if (["resolved", "closed"].includes(status)) return false;
  return new Date(dueAt).getTime() < Date.now();
}

export async function syncFindingsForScan(scanId: string): Promise<void> {
  const { error } = await supabase.rpc("sync_findings_for_scan", { p_scan_id: scanId });
  if (error && !String(error.message).includes("sync_findings_for_scan")) {
    console.warn("[findings] sync failed", error.message);
  }
}

function applyDashboardFilters<T extends { eq: (c: string, v: string) => T }>(
  query: T,
  filters?: DashboardFilterState,
): T {
  if (!filters) return query;
  if (filters.storeId && filters.storeId !== "all") query = query.eq("store_id", filters.storeId);
  if (filters.category && filters.category !== "all") query = query.eq("category", filters.category);
  return query;
}

export async function fetchFindings(input: {
  storeId?: string;
  sku?: string;
  findingType?: string;
  severity?: string;
  status?: string;
  rca?: string;
  assignedTo?: string;
  overdue?: boolean;
  scanId?: string;
  filters?: DashboardFilterState;
} = {}): Promise<Finding[]> {
  const orgId = await requireOrgId();
  let query = supabase
    .from("findings")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(400);

  query = applyDashboardFilters(query, input.filters);
  if (input.storeId && input.storeId !== "all") query = query.eq("store_id", input.storeId);
  if (input.sku) query = query.ilike("sku", `%${input.sku}%`);
  if (input.findingType && input.findingType !== "all") query = query.eq("finding_type", input.findingType);
  if (input.severity && input.severity !== "all") query = query.eq("severity", input.severity);
  if (input.status && input.status !== "all") query = query.eq("status", input.status);
  if (input.rca && input.rca !== "all") query = query.eq("rca_code", input.rca);
  if (input.assignedTo && input.assignedTo !== "all") query = query.eq("assigned_to", input.assignedTo);
  if (input.scanId) query = query.eq("scan_id", input.scanId);

  const { data, error } = await query;
  if (error) {
    if (error.code === "42P01") return [];
    dbError(error, "Could not load findings.");
  }

  let rows = (data ?? []) as Record<string, unknown>[];
  if (input.overdue) {
    rows = rows.filter((row) => isOverdue(row.due_at as string | null, String(row.status)));
  }

  const storeIds = [...new Set(rows.map((r) => r.store_id).filter(Boolean))] as string[];
  const userIds = [...new Set(rows.map((r) => r.assigned_to).filter(Boolean))] as string[];
  const [{ data: stores }, { data: profiles }] = await Promise.all([
    storeIds.length
      ? supabase.from("stores").select("id, name").in("id", storeIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    userIds.length
      ? supabase.from("profiles").select("id, full_name, email").in("id", userIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null; email: string | null }[] }),
  ]);
  const storeNames = new Map((stores ?? []).map((s) => [s.id, s.name]));
  const names = new Map(
    (profiles ?? []).map((p) => [p.id, p.full_name?.trim() || p.email || "Assigned"]),
  );

  return rows.map((row) => mapFinding(row, storeNames, names));
}

export async function fetchFinding(id: string): Promise<Finding | null> {
  const orgId = await requireOrgId();
  const { data, error } = await supabase
    .from("findings")
    .select("*")
    .eq("org_id", orgId)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    if (error.code === "42P01") return null;
    dbError(error, "Could not load finding.");
  }
  if (!data) return null;
  const storeId = data.store_id as string | null;
  const assigned = data.assigned_to as string | null;
  const [{ data: store }, { data: profile }] = await Promise.all([
    storeId ? supabase.from("stores").select("id, name").eq("id", storeId).maybeSingle() : Promise.resolve({ data: null }),
    assigned
      ? supabase.from("profiles").select("id, full_name, email").eq("id", assigned).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const storeNames = new Map(store ? [[store.id as string, store.name as string]] : []);
  const names = new Map(
    profile
      ? [[profile.id as string, (profile.full_name as string)?.trim() || (profile.email as string) || "Assigned"]]
      : [],
  );
  return mapFinding(data as Record<string, unknown>, storeNames, names);
}

export function findingsKpis(rows: Finding[]): FindingsKpis {
  const now = Date.now();
  const groups = new Map<string, { open: number; closed: number; total: number }>();
  for (const r of rows) {
    const key = `${r.store_id ?? ""}|${r.sku ?? ""}|${r.finding_type}`;
    const g = groups.get(key) ?? { open: 0, closed: 0, total: 0 };
    g.total += 1;
    if (["closed", "resolved"].includes(r.status)) g.closed += 1;
    else g.open += 1;
    groups.set(key, g);
  }
  const recurring = [...groups.values()].filter((g) => g.total > 1);
  const improved = recurring.filter((g) => g.closed > 0 && g.open === 0).length;
  return {
    total: rows.length,
    open: rows.filter((r) => !["resolved", "closed"].includes(r.status)).length,
    critical: rows.filter((r) => r.severity === "critical" && r.status !== "closed").length,
    overdue: rows.filter((r) => r.due_at && new Date(r.due_at).getTime() < now && !["resolved", "closed"].includes(r.status)).length,
    resolved: rows.filter((r) => r.status === "resolved").length,
    closed: rows.filter((r) => r.status === "closed").length,
    pending_verification: rows.filter((r) => r.status === "pending_verification").length,
    value_at_risk: rows
      .filter((r) => !["resolved", "closed"].includes(r.status))
      .reduce((sum, r) => sum + Math.abs(Number(r.variance_value_inr) || 0), 0),
    reaudit_improvement_pct:
      recurring.length > 0 ? Math.round((improved / recurring.length) * 1000) / 10 : null,
    repeat_failure_rate:
      groups.size > 0 ? Math.round((recurring.length / groups.size) * 1000) / 10 : null,
  };
}

export async function confirmFinding(id: string): Promise<void> {
  const { error } = await supabase
    .from("findings")
    .update({ confirmation_state: "human_confirmed", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) dbError(error, "Could not confirm finding.");
}

export async function updateFindingRca(
  id: string,
  rca: RcaCode,
  notes?: string,
): Promise<void> {
  if (rca === "other" && !notes?.trim()) {
    throw new Error("Notes are required when RCA is Other.");
  }
  const { error } = await supabase
    .from("findings")
    .update({
      rca_code: rca,
      rca_notes: notes?.trim() || null,
      confirmation_state: "human_confirmed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) dbError(error, "Could not update RCA.");
}

export async function assignFinding(id: string, userId: string, dueAt?: string | null): Promise<void> {
  const { error } = await supabase
    .from("findings")
    .update({
      assigned_to: userId,
      due_at: dueAt ?? undefined,
      status: "assigned",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) dbError(error, "Could not assign finding.");
}

function mapFinding(
  row: Record<string, unknown>,
  storeNames: Map<string, string>,
  names: Map<string, string>,
): Finding {
  return {
    id: String(row.id),
    org_id: String(row.org_id),
    scan_id: (row.scan_id as string) ?? null,
    assignment_id: (row.assignment_id as string) ?? null,
    store_id: (row.store_id as string) ?? null,
    store_name: storeNames.get(row.store_id as string) ?? "Store",
    source_type: String(row.source_type ?? ""),
    source_id: (row.source_id as string) ?? null,
    audit_origin: (row.audit_origin as AuditOrigin) ?? "digital",
    finding_type: row.finding_type as FindingType,
    severity: row.severity as FindingSeverity,
    confirmation_state: (row.confirmation_state as ConfirmationState) ?? "human_confirmed",
    title: String(row.title),
    description: (row.description as string) ?? null,
    sku: (row.sku as string) ?? null,
    product_name: (row.product_name as string) ?? null,
    category: (row.category as string) ?? null,
    shelf_label: (row.shelf_label as string) ?? null,
    expected_value: row.expected_value == null ? null : Number(row.expected_value),
    actual_value: row.actual_value == null ? null : Number(row.actual_value),
    variance_units: row.variance_units == null ? null : Number(row.variance_units),
    variance_percentage: row.variance_percentage == null ? null : Number(row.variance_percentage),
    variance_value_inr: row.variance_value_inr == null ? null : Number(row.variance_value_inr),
    rca_code: (row.rca_code as RcaCode) ?? null,
    rca_notes: (row.rca_notes as string) ?? null,
    status: row.status as FindingStatus,
    assigned_to: (row.assigned_to as string) ?? null,
    assigned_name: row.assigned_to ? (names.get(row.assigned_to as string) ?? "Assigned") : "Unassigned",
    due_at: (row.due_at as string) ?? null,
    created_at: String(row.created_at),
    resolved_at: (row.resolved_at as string) ?? null,
    verified_at: (row.verified_at as string) ?? null,
    closed_at: (row.closed_at as string) ?? null,
  };
}

export { requireUserId };
