/** Build planogram comparison UI model from scan result (dashboard + demo). */

import { comparePlanogramToInventory, type InventoryFacing } from "@/lib/demo-planogram-match";
import { buildDemoPlanogramComparison } from "@/lib/scan-context";
import type { PlanogramComparison } from "@/lib/planogram-compliance";
import type { ScanResult } from "@/lib/scan-results";
import type { PlanogramRow } from "@/lib/planogram";

export function planogramComparisonFromResult(
  data?: ScanResult | null,
  apiComparison?: PlanogramComparison | null,
): PlanogramComparison | null {
  if (apiComparison) return apiComparison;
  if (!data?.planogram?.requested) return null;

  const summary = data.planogram.summary ?? {};
  const configuredRows = (summary as { configured_rows?: PlanogramRow[] }).configured_rows;
  const inventory = (data.inventory ?? []) as InventoryFacing[];

  if (configuredRows?.length && inventory.length) {
    const match = comparePlanogramToInventory(inventory, configuredRows);
    return buildDemoPlanogramComparison(match, data.scan_id ?? "scan");
  }

  const planogramPercent =
    data.planogram.sku_match_percent ?? data.planogram.percent ?? data.planogram.qty_compliance_percent;
  const hasSummary = Object.keys(summary).length > 0;
  if (planogramPercent != null || hasSummary) {
    return {
      id: `${data.scan_id ?? "scan"}-planogram`,
      compliance_percent: planogramPercent,
      summary: summary as PlanogramComparison["summary"],
      created_at: data.created_at ?? new Date().toISOString(),
      lines: [],
      actions: [],
    };
  }

  return null;
}
