/**
 * Magic Pattern KPI / chart colors for AI audit results.
 * Soft card fills and stronger chart accents — no adjacent repeats in grids.
 */

export const KPI_CARD = {
  auditCompletion: "#F0E9FF",
  evidenceCoverage: "#ECF7FD",
  auditPass: "#ECF2E2",
  openFindings: "#CFEFFF",
  criticalFindings: "#FFEAF1",
  overdueActions: "#EEF1F4",
  slaCompliance: "#F1F5F8",
  inventoryValueVariance: "#EAF6FD",
  pricesRead: "#ECF7FD",
  detectedProducts: "#F0E9FF",
  aiConfidence: "#ECF7FD",
  priceStatus: "#EEF1F4",
  financialDaily: "#EAF6FD",
  financialWeekly: "#F0E9FF",
  financialOos: "#FFEAF1",
  financialStatus: "#EEF1F4",
} as const;

export const CHART_ACCENT = {
  brandFacingShare: "#79E2A8",
  brandUnitShare: "#8EC9E8",
  categoryFacingShare: "#7DB7D6",
  rankByFacings: "#9B86D9",
  rankByUnits: "#8EC9E8",
  actualFacings: "#9B86D9",
  actualUnits: "#8EC9E8",
  aiConfidence: "#7DB7D6",
  visiblePrice: "#7DB7D6",
  financialDaily: "#8EC9E8",
  financialWeekly: "#9B86D9",
  financialOos: "#F9A8C9",
} as const;

/** Soft unique fills for summary KPI grids — cycle without adjacent duplicates. */
export const SUMMARY_KPI_FILLS = [
  KPI_CARD.auditCompletion,
  KPI_CARD.evidenceCoverage,
  KPI_CARD.auditPass,
  KPI_CARD.openFindings,
  KPI_CARD.criticalFindings,
  KPI_CARD.overdueActions,
  KPI_CARD.slaCompliance,
  KPI_CARD.inventoryValueVariance,
  "#FFF4E5",
  "#E8F8F0",
  "#F5E8FF",
  "#E6F0FF",
] as const;

export function summaryFillAt(index: number): string {
  return SUMMARY_KPI_FILLS[index % SUMMARY_KPI_FILLS.length]!;
}
