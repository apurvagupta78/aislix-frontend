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
  navy: "#102A43",
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

/** Very light tint for card surfaces (white + subtle wash). Not full-color fills. */
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

/** @deprecated Prefer ACCENT_TINT + KPI_ACCENT — kept for existing card bg props */
export const KPI_CARD = {
  auditCompletion: ACCENT_TINT.purple,
  evidenceCoverage: ACCENT_TINT.blue,
  auditPass: ACCENT_TINT.green,
  openFindings: ACCENT_TINT.cyan,
  criticalFindings: ACCENT_TINT.pink,
  overdueActions: ACCENT_TINT.grey,
  slaCompliance: ACCENT_TINT.blue,
  inventoryValueVariance: ACCENT_TINT.cyan,
  pricesRead: ACCENT_TINT.blue,
  detectedProducts: ACCENT_TINT.purple,
  aiConfidence: ACCENT_TINT.blue,
  priceStatus: ACCENT_TINT.grey,
  financialDaily: ACCENT_TINT.cyan,
  financialWeekly: ACCENT_TINT.purple,
  financialOos: ACCENT_TINT.pink,
  financialStatus: ACCENT_TINT.grey,
} as const;

/** Soft fills cycled so adjacent summary tiles never share the same tint. */
export const SUMMARY_KPI_FILLS = [
  ACCENT_TINT.purple,
  ACCENT_TINT.blue,
  ACCENT_TINT.pink,
  ACCENT_TINT.green,
  ACCENT_TINT.cyan,
  ACCENT_TINT.purple,
  ACCENT_TINT.blue,
  ACCENT_TINT.green,
  ACCENT_TINT.pink,
  ACCENT_TINT.cyan,
] as const;

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
