/**
 * Fictional oral-care gondola demo planogram for the homepage toothpaste-a1l sample shelf.
 * Reference data is demo-only — not verified from the photograph (GTINs, prices, dimensions).
 */

import {
  buildMatchKey,
  comparePlanogramToInventory,
  type InventoryFacing,
  type PlanogramMatchResult,
} from "@/lib/demo-planogram-match";
import type { PlanogramRow } from "@/lib/planogram";
import type { PlanogramAuditPackage } from "@/lib/planogram-audit-package";
import type { PlanogramMeta } from "@/lib/planogram-meta";
import type { ScanContextState } from "@/lib/scan-context";
import type { AuditRoleTab } from "@/lib/role-audit-ui";

export const DEMO_ORAL_CARE_SAMPLE_ID = "toothpaste-a1l";
export const DEMO_PLANOGRAM_ID = "POG-ORAL-001";
export const DEMO_PLANOGRAM_LABEL = "Aislix Demo Data";

const FIXTURE = "G01 – Oral Care Gondola";
const STORE = "Demo Supermarket – Store 101";
const CATEGORY = "Oral Care";
const SUB_CATEGORY = "Toothpaste & Oral Hygiene";

function facingBounds(planned: number): { min: number; max: number } {
  return {
    min: Math.max(1, Math.floor(planned * 0.7)),
    max: Math.ceil(planned * 1.2),
  };
}

function demoRow(
  position: string,
  shelf: string,
  sku: string,
  brand: string,
  product: string,
  variant: string,
  facings: number,
  price: number,
  extras?: Partial<PlanogramRow>,
): PlanogramRow {
  const { min, max } = facingBounds(facings);
  return {
    location: FIXTURE,
    category: CATEGORY,
    sub_category: SUB_CATEGORY,
    brand,
    product_name: product,
    variant,
    expected_qty: facings,
    expected_facings: facings,
    min_facings: min,
    max_facings: max,
    sku,
    shelf_position: position,
    expected_shelf_level: shelf,
    mrp_inr: price,
    match_key: buildMatchKey(brand, product, sku),
    ...extras,
  };
}

/** 20 planogram positions — 18 unique SKUs, 87 planned facings. */
export const DEMO_ORAL_CARE_ROWS: PlanogramRow[] = [
  demoRow("S1-P01", "S1", "SKU-COL-001", "Colgate", "MaxFresh", "150g", 5, 3.59),
  demoRow("S1-P02", "S1", "SKU-COL-003", "Colgate", "Total", "150g", 5, 4.29),
  demoRow("S1-P03", "S1", "SKU-COL-004", "Colgate", "Strong Teeth", "150g", 5, 3.49),
  demoRow("S1-P04", "S1", "SKU-COL-005", "Colgate", "Herbal", "150g", 4, 3.39),
  demoRow("S2-P01", "S2", "SKU-COL-001", "Colgate", "MaxFresh", "150g", 5, 3.59),
  demoRow("S2-P02", "S2", "SKU-COL-002", "Colgate", "MaxFresh", "100g", 4, 2.79),
  demoRow("S2-P03", "S2", "SKU-COL-004", "Colgate", "Strong Teeth", "150g", 4, 3.49),
  demoRow("S2-P04", "S2", "SKU-ODO-001", "Odol", "Odol", "75g", 4, 2.99),
  demoRow("S2-P05", "S2", "SKU-ODO-002", "Odol", "Odol Dental", "100g", 3, 3.49),
  demoRow("S3-P01", "S3", "SKU-DOC-001", "Doctor", "Doctor Toothpaste", "100g", 5, 2.49),
  demoRow("S3-P02", "S3", "SKU-DOC-002", "Doctor", "Doctor Herbal", "100g", 4, 2.59),
  demoRow("S3-P03", "S3", "SKU-COL-005", "Colgate", "Herbal", "150g", 4, 3.39),
  demoRow("S3-P04", "S3", "SKU-COL-006", "Colgate", "Sensitive", "70g", 4, 3.89),
  demoRow("S4-P01", "S4", "SKU-ORB-001", "Oral-B", "Oral-B Toothpaste", "100g", 5, 3.99),
  demoRow("S4-P02", "S4", "SKU-ORB-002", "Oral-B", "Oral-B Gum Care", "100g", 5, 4.29),
  demoRow("S4-P03", "S4", "SKU-COL-007", "Colgate", "Kids", "80g", 4, 3.29),
  demoRow("S5-P01", "S5", "SKU-SEN-001", "Sensodyne", "Sensodyne", "100g", 5, 5.49),
  demoRow("S5-P02", "S5", "SKU-SEN-002", "Sensodyne", "Sensodyne Fresh", "100g", 4, 5.29),
  demoRow("S5-P03", "S5", "SKU-CLU-001", "Closeup", "Closeup", "150g", 4, 2.99),
  demoRow("S5-P04", "S5", "SKU-KOL-001", "Kolynos", "Kolynos", "90g", 4, 2.39),
];

export const DEMO_ORAL_CARE_META: PlanogramMeta = {
  name: "Oral Care – Main Gondola Demo",
  planogram_id: DEMO_PLANOGRAM_ID,
  version: "v1.0",
  store_outlet: STORE,
  category: CATEGORY,
  sub_category: SUB_CATEGORY,
  valid_from: "2026-09-01",
  valid_until: "2026-09-30",
  measurement_unit: "cm",
  fixture_type: "gondola",
  fixture_width: 120,
  fixture_height: 180,
  shelf_count: 5,
  fixture_id: "G01",
  is_demo: true,
};

/** Configured demo observations — maps planogram positions to observed facings/prices. */
export type DemoPositionObservation = {
  facings: number;
  observed_shelf?: string;
  observed_price?: number;
  note?: string;
};

export const DEMO_ORAL_CARE_OBSERVATIONS: Record<string, DemoPositionObservation> = {
  "S1-P01": { facings: 3, observed_price: 3.99, note: "Promo price mismatch + low facings" },
  "S1-P02": { facings: 5 },
  "S1-P03": { facings: 5 },
  "S1-P04": { facings: 4 },
  "S2-P01": { facings: 5 },
  "S2-P02": { facings: 4 },
  "S2-P03": { facings: 4 },
  "S2-P04": { facings: 4 },
  "S2-P05": { facings: 3 },
  "S3-P01": { facings: 5 },
  "S3-P02": { facings: 4 },
  "S3-P03": { facings: 0, observed_shelf: "S2", note: "Herbal expected S3 — observed S2" },
  "S3-P04": { facings: 0, note: "Colgate Sensitive not clearly visible" },
  "S4-P01": { facings: 5 },
  "S4-P02": { facings: 5 },
  "S4-P03": { facings: 4 },
  "S5-P01": { facings: 5, observed_price: 5.49 },
  "S5-P02": { facings: 4 },
  "S5-P03": { facings: 4, observed_price: 3.29, note: "Price mismatch" },
  "S5-P04": { facings: 4 },
};

/** Misplaced Herbal block observed on shelf 2 (planogram expects S3-P03). */
export const DEMO_ORAL_CARE_MISPLACED: InventoryFacing[] = [
  {
    brand: "Colgate",
    product_name: "Herbal",
    variant: "150g",
    sku: "SKU-COL-005",
    quantity: 4,
    shelf_position: "S2-P03",
  },
];

const MANDATORY_SKUS = [
  "SKU-COL-001",
  "SKU-COL-003",
  "SKU-COL-004",
  "SKU-COL-005",
  "SKU-COL-002",
  "SKU-ODO-001",
  "SKU-ODO-002",
  "SKU-DOC-001",
  "SKU-DOC-002",
  "SKU-COL-006",
  "SKU-ORB-001",
  "SKU-ORB-002",
  "SKU-COL-007",
  "SKU-SEN-001",
  "SKU-SEN-002",
  "SKU-CLU-001",
  "SKU-KOL-001",
];

const MSL_SKUS = [
  "SKU-COL-001",
  "SKU-COL-004",
  "SKU-COL-005",
  "SKU-COL-003",
  "SKU-ODO-001",
  "SKU-DOC-001",
  "SKU-ORB-001",
  "SKU-SEN-001",
  "SKU-CLU-001",
  "SKU-KOL-001",
];

export const DEMO_ORAL_CARE_AUDIT_PACKAGE: PlanogramAuditPackage = {
  primary_brand: "Colgate",
  fixture_id: "G01",
  store_timezone: "America/Bogota",
  assortment_skus: [
    ...MANDATORY_SKUS.map((sku) => ({
      sku,
      list_type: "mandatory_assortment" as const,
      outlet_scope: STORE,
    })),
    {
      sku: "SKU-COL-008",
      list_type: "optional" as const,
      outlet_scope: STORE,
      optional: true,
    },
  ],
  msl_skus: MSL_SKUS.map((sku) => ({
    sku,
    list_type: "msl" as const,
    outlet_scope: "Demo Distribution Co.",
  })),
  price_requirements: DEMO_ORAL_CARE_ROWS.filter(
    (r, i, arr) => arr.findIndex((x) => x.sku === r.sku) === i,
  ).map((r) => ({
    sku: r.sku,
    label_location: r.shelf_position,
    expected_price: r.mrp_inr ?? 0,
    currency: "USD",
    price_basis: "item",
  })),
  promotions: [
    {
      promotion_id: "PROMO-001",
      participating_skus: ["SKU-COL-001"],
      start_date: "2026-09-01",
      end_date: "2026-09-30",
      required_location: "S1 / Front Block",
      expected_offer_text: "OFERTA – COLGATE MAXFRESH",
      expected_promo_price: 3.59,
      required_facings: 5,
    },
  ],
  scoring: {
    osa_target: 91,
    planogram_target: 84,
    assortment_target: 88,
    price_target: 90,
    promotional_target: 80,
    msl_target: 90,
    share_of_shelf_target: 55,
  },
};

export const DEMO_DARK_STORE_BINS = [
  "A03-R07-B02-S01",
  "A03-R07-B02-S02",
  "A03-R07-B02-S03",
  "A03-R07-B02-S04",
  "A03-R07-B02-S05",
];

export function isDemoOralCareContext(ctx: ScanContextState): boolean {
  return (
    ctx.planogramMeta?.is_demo === true ||
    ctx.planogramMeta?.planogram_id === DEMO_PLANOGRAM_ID ||
    (ctx.planogramRows.length > 0 &&
      ctx.planogramRows[0]?.location === FIXTURE &&
      ctx.planogramRows.some((r) => r.sku?.startsWith("SKU-COL-")))
  );
}

export function isDemoOralCareResult(result?: {
  planogram?: { summary?: { source?: string } };
  retail_intelligence?: { demo_oral_care?: boolean };
} | null): boolean {
  if (!result) return false;
  if (result.retail_intelligence?.demo_oral_care) return true;
  return result.planogram?.summary?.source === "demo_planogram";
}

/** Demo competitor brands from planogram (Odol, Doctor, Oral-B, etc.). */
export const DEMO_ORAL_CARE_COMPETITOR_BRANDS = [
  "Odol",
  "Doctor",
  "Oral-B",
  "Sensodyne",
  "Closeup",
  "Kolynos",
];

export function buildDemoOralCareScanContext(role: AuditRoleTab = "supermarket"): ScanContextState {
  return {
    focus: { brand: "Colgate", company: "Colgate" },
    planogramRows: DEMO_ORAL_CARE_ROWS,
    auditRole: role,
    auditPackage: DEMO_ORAL_CARE_AUDIT_PACKAGE,
    planogramMeta: DEMO_ORAL_CARE_META,
  };
}

/** Synthetic inventory from configured demo observations (not hard-coded KPI percentages). */
export function buildDemoPositionInventory(
  rows: PlanogramRow[] = DEMO_ORAL_CARE_ROWS,
  observations: Record<string, DemoPositionObservation> = DEMO_ORAL_CARE_OBSERVATIONS,
): InventoryFacing[] {
  const inv: InventoryFacing[] = [];
  for (const row of rows) {
    const obs = observations[row.shelf_position] ?? observations[row.sku ?? ""];
    const facings = obs?.facings ?? row.expected_facings ?? row.expected_qty ?? 0;
    if (facings <= 0) continue;
    inv.push({
      brand: row.brand,
      product_name: row.product_name,
      variant: row.variant,
      sku: row.sku,
      quantity: facings,
      shelf_position: obs?.observed_shelf
        ? `${obs.observed_shelf}-${row.shelf_position.split("-")[1]}`
        : row.shelf_position,
    });
  }
  for (const misplaced of DEMO_ORAL_CARE_MISPLACED) {
    inv.push(misplaced);
  }
  return inv;
}

export function demoObservedPriceBySku(): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of DEMO_ORAL_CARE_ROWS) {
    const obs = DEMO_ORAL_CARE_OBSERVATIONS[row.shelf_position];
    if (obs?.observed_price != null) {
      map.set(row.sku, obs.observed_price);
    }
  }
  map.set("SKU-COL-001", 3.99);
  return map;
}

const DEMO_PRICE_MISMATCH_SKUS = new Set(["SKU-COL-001", "SKU-CLU-001"]);

export function demoPriceComplianceLines(): Array<{
  sku: string;
  product: string;
  expected_price: number;
  observed_price: number;
  status: "compliant" | "mismatch";
}> {
  const unique = new Map<string, PlanogramRow>();
  for (const row of DEMO_ORAL_CARE_ROWS) {
    if (!unique.has(row.sku)) unique.set(row.sku, row);
  }
  const assessed = [...unique.values()].slice(0, 10);
  return assessed.map((row) => {
    const expected = row.mrp_inr ?? 0;
    const observed = DEMO_PRICE_MISMATCH_SKUS.has(row.sku)
      ? row.sku === "SKU-COL-001"
        ? 3.99
        : 3.29
      : expected;
    return {
      sku: row.sku,
      product: `${row.brand} ${row.product_name}`,
      expected_price: expected,
      observed_price: observed,
      status: Math.abs(expected - observed) < 0.01 ? "compliant" : "mismatch",
    };
  });
}

/** Planogram match using configured demo observations (not hard-coded KPI values). */
export function compareDemoOralCarePlanogram(
  rows: PlanogramRow[] = DEMO_ORAL_CARE_ROWS,
): PlanogramMatchResult {
  const inventory = buildDemoPositionInventory(rows);
  const match = comparePlanogramToInventory(inventory, rows);
  const lines = match.lines.map((line) => {
    const pos = line.expected.shelf_position;
    const obs = DEMO_ORAL_CARE_OBSERVATIONS[pos ?? ""];
    if (pos === "S3-P03" && line.expected.sku === "SKU-COL-005") {
      return {
        ...line,
        issue_type: "wrong_product" as const,
        detail: "Wrong shelf position — expected Shelf 3 (S3-P03), observed on Shelf 2.",
        detected_qty: 4,
        present: true,
      };
    }
    if (pos === "S3-P04" && line.expected.sku === "SKU-COL-006") {
      return {
        ...line,
        issue_type: "missing" as const,
        detail: "Colgate Sensitive — low availability (expected 4 facings, not clearly visible).",
      };
    }
    if (obs?.note && line.issue_type !== "correct") {
      return { ...line, detail: obs.note };
    }
    return line;
  });
  let correct = 0;
  let missing = 0;
  let wrong = 0;
  let qtyShort = 0;
  for (const line of lines) {
    if (line.issue_type === "correct") correct += 1;
    else if (line.issue_type === "missing") missing += 1;
    else if (line.issue_type === "wrong_product") wrong += 1;
    else if (line.issue_type === "qty_mismatch") qtyShort += 1;
  }
  const strictMatch = Math.round((correct / rows.length) * 100);
  return {
    ...match,
    lines,
    correct_count: correct,
    missing_count: missing,
    wrong_product_count: wrong,
    qty_short_count: qtyShort,
    sku_match_percent: strictMatch,
  };
}

export function demoPromotionalCompliance(): {
  promotion_id: string;
  passing: boolean;
  expected_price: number;
  observed_price: number;
  detail: string;
} {
  return {
    promotion_id: "PROMO-001",
    passing: false,
    expected_price: 3.59,
    observed_price: 3.99,
    detail: "Promotional price mismatch — expected $3.59, observed $3.99 on S1 front block.",
  };
}
