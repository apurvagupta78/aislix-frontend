/**
 * Locked Aislix Magic Pattern palette — whole site.
 * Source of truth for KPI accents, chart series, and adjacency cycling.
 * See .cursor/rules/aislix-visual-design-system.mdc
 */

export const AISLIX_PALETTE = {
  green: "#79E2A8",
  blue: "#7DB7D6",
  purple: "#9B86D9",
  cyan: "#8EC9E8",
  pink: "#FFEAF1",
  grey: "#EEF1F4",
  navy: "#04203F",
  secondary: "#667085",
  border: "#D9E2E8",
  card: "#FFFFFF",
  page: "#F4F7F9",
} as const;

export type AislixAccent = "purple" | "blue" | "pink" | "green" | "cyan" | "grey";

/** Deterministic adjacency sequence — never place the same accent on adjacent cards. */
export const ACCENT_SEQUENCE: AislixAccent[] = [
  "purple",
  "blue",
  "pink",
  "green",
  "cyan",
  "purple",
  "blue",
  "green",
  "pink",
  "cyan",
];

export function accentAt(index: number): AislixAccent {
  return ACCENT_SEQUENCE[index % ACCENT_SEQUENCE.length]!;
}

export function accentHex(accent: AislixAccent): string {
  return AISLIX_PALETTE[accent];
}

/** Very light tints for small status pills only — never card or panel surfaces. */
export const ACCENT_TINT: Record<AislixAccent, string> = {
  purple: "#F3EFFB",
  blue: "#EEF6FA",
  pink: "#FFF5F8",
  green: "#EFFAF4",
  cyan: "#EEF7FB",
  grey: "#F5F7F9",
};

export const KPI_ACCENT = {
  auditCompletion: "purple" as const,
  evidenceCoverage: "blue" as const,
  auditPass: "green" as const,
  openFindings: "cyan" as const,
  criticalFindings: "pink" as const,
  overdueActions: "grey" as const,
  slaCompliance: "blue" as const,
  inventoryValueVariance: "cyan" as const,
  financialDaily: "cyan" as const,
  financialWeekly: "purple" as const,
  financialOos: "pink" as const,
  financialStatus: "grey" as const,
  detectedProducts: "purple" as const,
  pricesRead: "blue" as const,
  aiConfidence: "blue" as const,
  priceStatus: "grey" as const,
};

export const CHART_ACCENT = {
  brandFacingShare: AISLIX_PALETTE.green,
  brandUnitShare: AISLIX_PALETTE.cyan,
  categoryFacingShare: AISLIX_PALETTE.blue,
  categoryUnitShare: AISLIX_PALETTE.purple,
  rankByFacings: AISLIX_PALETTE.purple,
  rankByUnits: AISLIX_PALETTE.cyan,
  actualFacings: AISLIX_PALETTE.purple,
  actualUnits: AISLIX_PALETTE.cyan,
  aiConfidence: AISLIX_PALETTE.blue,
  visiblePrice: AISLIX_PALETTE.blue,
  mrp: AISLIX_PALETTE.blue,
  sellingPrice: AISLIX_PALETTE.purple,
  financialDaily: AISLIX_PALETTE.cyan,
  financialWeekly: AISLIX_PALETTE.purple,
  financialOos: AISLIX_PALETTE.pink,
  completionTrend: AISLIX_PALETTE.purple,
  findingsTrend: AISLIX_PALETTE.cyan,
  planogramCompliance: AISLIX_PALETTE.purple,
  coverageDays: AISLIX_PALETTE.blue,
  valueGap: AISLIX_PALETTE.cyan,
  expectedReference: AISLIX_PALETTE.grey,
} as const;

/** Multi-series chart order (categorical breakdowns, legends). */
export const CHART_SERIES = [
  AISLIX_PALETTE.purple,
  AISLIX_PALETTE.blue,
  AISLIX_PALETTE.green,
  AISLIX_PALETTE.cyan,
  AISLIX_PALETTE.pink,
  AISLIX_PALETTE.grey,
] as const;

export function chartSeriesAt(index: number): string {
  return CHART_SERIES[index % CHART_SERIES.length]!;
}

/** @deprecated KPI cards are white; the accent lives in the status dot (see KPI_ACCENT). */
export const KPI_CARD = {
  auditCompletion: AISLIX_PALETTE.card,
  evidenceCoverage: AISLIX_PALETTE.card,
  auditPass: AISLIX_PALETTE.card,
  openFindings: AISLIX_PALETTE.card,
  criticalFindings: AISLIX_PALETTE.card,
  overdueActions: AISLIX_PALETTE.card,
  slaCompliance: AISLIX_PALETTE.card,
  inventoryValueVariance: AISLIX_PALETTE.card,
  pricesRead: AISLIX_PALETTE.card,
  detectedProducts: AISLIX_PALETTE.card,
  aiConfidence: AISLIX_PALETTE.card,
  priceStatus: AISLIX_PALETTE.card,
  financialDaily: AISLIX_PALETTE.card,
  financialWeekly: AISLIX_PALETTE.card,
  financialOos: AISLIX_PALETTE.card,
  financialStatus: AISLIX_PALETTE.card,
} as const;

/** Summary tiles are white; colour is reserved for status dots and charts. */
export const SUMMARY_KPI_FILLS = [AISLIX_PALETTE.card] as const;
export function summaryFillAt(index: number): string {
  return SUMMARY_KPI_FILLS[index % SUMMARY_KPI_FILLS.length]!;
}

export function ensureAdjacentAccentsDiffer(
  left: AislixAccent,
  right: AislixAccent,
): [AislixAccent, AislixAccent] {
  if (left !== right) return [left, right];
  const next = ACCENT_SEQUENCE[(ACCENT_SEQUENCE.indexOf(left) + 1) % ACCENT_SEQUENCE.length]!;
  return [left, next];
}
