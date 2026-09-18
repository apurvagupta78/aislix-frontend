/** Tools that return live data in the current Ask Aislix implementation. */
export const ASK_AISLIX_WIRED_TOOLS = new Set([
  "get_kpi",
  "get_audit_summary",
  "get_overdue_audits",
  "get_inventory_variance",
  "get_findings",
  "get_corrective_actions",
  "get_audit_trends",
  "get_store_performance",
  "get_expiry_risk",
  "get_audit_evidence_images",
  "get_recurring_issues",
]);

/** Tools / capabilities intentionally excluded from suggestions (not wired). */
export const ASK_AISLIX_UNWIRED_CAPABILITIES = [
  "shelf_share",
  "facing_compliance",
  "planogram_compliance",
  "pricing_compliance",
  "promotion_compliance",
  "posm_compliance",
  "picking_accuracy",
  "putaway_accuracy",
  "receiving_variance",
  "bin_accuracy",
  "inventory_accuracy_kpi",
  "evidence_coverage_kpi",
  "audit_pass_kpi",
  "sla_compliance_kpi",
  "distributor_scorecard",
  "sales_rep_performance",
  "supplier_performance",
  "sku_history",
  "sales_data",
] as const;

export function isSuggestionToolAvailable(requiredTools: string[]): boolean {
  return requiredTools.every((tool) => ASK_AISLIX_WIRED_TOOLS.has(tool));
}
