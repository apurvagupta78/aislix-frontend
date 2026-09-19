/**
 * Builds expected-products comparison rows when Railway returns inventory-only
 * payloads but the audit was submitted with expected products.
 */

import type { ExpectedProduct } from "@/lib/ai-audit/expected-products";
import type {
  AstraExpectedProductRow,
  AstraExpectedProductsSummary,
  NormalizedAstraAnalysis,
} from "@/lib/ai-audit/astra-response";
import type { InventoryItem } from "@/lib/scan-results";

export type ExtraDetection = {
  brand: string;
  product_name: string;
  variant: string;
  facings: number;
  confidence: number;
  shelf_position?: string;
};

function norm(value: string): string {
  return value
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokens(value: string): string[] {
  return norm(value).split(/\s+/).filter(Boolean);
}

export function variantsMatch(expected: string, detected: string): boolean {
  const a = norm(expected);
  const b = norm(detected);
  if (!a || !b) return !a && !b;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  const ta = tokens(expected);
  const tb = tokens(detected);
  if (!ta.length || !tb.length) return false;
  const overlap = ta.filter((t) => tb.includes(t)).length;
  return overlap >= Math.min(ta.length, tb.length);
}

export function brandsMatch(expected: string, detected: string): boolean {
  return norm(expected) === norm(detected);
}

export function inventoryMatchesExpected(
  item: InventoryItem,
  expected: ExpectedProduct,
): boolean {
  const product = item.product || item.name || "";
  if (!brandsMatch(expected.brand, item.brand)) return false;
  if (norm(expected.product_name) !== norm(product)) return false;
  return variantsMatch(expected.variant, item.variant ?? "");
}

function facingStatus(expected: number, actual: number): string {
  if (actual <= 0) return "NOT_FOUND";
  if (actual === expected) return "MATCHED";
  if (actual < expected) return "BELOW_EXPECTED";
  return "ABOVE_EXPECTED";
}

function unitStatus(expected: number, actual: number): string {
  if (actual <= 0) return "NOT_FOUND";
  if (actual === expected) return "MATCHED";
  if (actual < expected) return "BELOW_EXPECTED";
  return "ABOVE_EXPECTED";
}

function overallStatus(facing: string, units: string): string {
  if (facing === "NOT_FOUND" || units === "NOT_FOUND") return "NOT_FOUND";
  if (facing === "MATCHED" && units === "MATCHED") return "COMPLIANT";
  return "PARTIALLY_COMPLIANT";
}

function buildSummary(rows: AstraExpectedProductRow[]): AstraExpectedProductsSummary {
  let matched = 0;
  let notFound = 0;
  let belowFacings = 0;
  let belowUnits = 0;
  let aboveFacings = 0;
  let aboveUnits = 0;

  for (const row of rows) {
    const fs = row.facing_status.toUpperCase();
    const us = row.shelf_unit_status.toUpperCase();
    if (fs.includes("NOT_FOUND")) notFound++;
    else if (fs.includes("MATCHED") && us.includes("MATCHED")) matched++;
    if (fs.includes("BELOW")) belowFacings++;
    if (us.includes("BELOW")) belowUnits++;
    if (fs.includes("ABOVE")) aboveFacings++;
    if (us.includes("ABOVE")) aboveUnits++;
  }

  return {
    total_products: rows.length,
    matched_products: matched,
    not_found_products: notFound,
    not_verifiable_products: 0,
    products_below_expected_facings: belowFacings,
    products_below_expected_units: belowUnits,
    products_above_expected_facings: aboveFacings,
    products_above_expected_units: aboveUnits,
  };
}

export function findExtraDetections(
  expected: ExpectedProduct[],
  inventory: InventoryItem[],
): ExtraDetection[] {
  return inventory
    .filter((item) => !expected.some((row) => inventoryMatchesExpected(item, row)))
    .map((item) => ({
      brand: item.brand,
      product_name: item.product || item.name || "—",
      variant: item.variant ?? "",
      facings: item.facings ?? item.quantity ?? 0,
      confidence: item.confidence,
      shelf_position: item.shelf_position,
    }));
}

export function synthesizeExpectedProductsAnalysis(input: {
  expectedProducts: ExpectedProduct[];
  inventory: InventoryItem[];
  operatingModel?: string;
}): Extract<NormalizedAstraAnalysis, { mode: "expected_products" }> | null {
  if (!input.expectedProducts.length) return null;

  const usedInventory = new Set<string>();

  const products: AstraExpectedProductRow[] = input.expectedProducts.map((expected) => {
    const match = input.inventory.find((item) => {
      if (usedInventory.has(item.id)) return false;
      if (!inventoryMatchesExpected(item, expected)) return false;
      usedInventory.add(item.id);
      return true;
    });

    const actualFacings = match ? (match.facings ?? match.quantity ?? 0) : 0;
    const actualUnits = actualFacings;
    const expectedFacings = expected.expected_facings;
    const expectedUnits = expected.expected_shelf_units;
    const fs = facingStatus(expectedFacings, actualFacings);
    const us = unitStatus(expectedUnits, actualUnits);

    return {
      location: expected.location,
      category: expected.category,
      category_status: match ? "MATCHED" : actualFacings > 0 ? "MATCHED" : "UNVERIFIABLE",
      sub_category: expected.sub_category,
      subcategory_status: match ? "MATCHED" : actualFacings > 0 ? "MATCHED" : "UNVERIFIABLE",
      brand: expected.brand,
      brand_status: match ? "MATCHED" : actualFacings > 0 ? "MATCHED" : "UNVERIFIABLE",
      product_name: expected.product_name,
      product_status: match ? "MATCHED" : actualFacings > 0 ? "MATCHED" : "NOT_FOUND",
      variant: match?.variant ?? expected.variant,
      variant_status: match ? "MATCHED" : actualFacings > 0 ? "MATCHED" : "UNVERIFIABLE",
      expected_facings: expectedFacings,
      actual_facings: actualFacings,
      facing_variance: actualFacings - expectedFacings,
      facing_status: fs,
      expected_shelf_units: expectedUnits,
      actual_visible_units: actualUnits,
      shelf_unit_variance: actualUnits - expectedUnits,
      shelf_unit_status: us,
      overall_status: overallStatus(fs, us),
      confidence: match?.confidence ?? 0,
      evidence_note: match
        ? `Matched shelf detection${match.shelf_position ? ` at ${match.shelf_position}` : ""}. Synthesized — Astra did not return structured comparison JSON.`
        : "No matching product detected on shelf. Synthesized — Astra did not return structured comparison JSON.",
    };
  });

  return {
    mode: "expected_products",
    operating_model: input.operatingModel,
    products,
    summary: buildSummary(products),
  };
}

export type AiAuditViewKind = "expected_products" | "planogram" | "shelf_only";

export function resolveAiAuditViewKind(input: {
  astra: NormalizedAstraAnalysis;
  submittedAnalysisMode?: string;
  expectedProductCount: number;
  planogramRequested?: boolean;
}): AiAuditViewKind {
  if (input.astra.mode === "planogram") return "planogram";
  if (input.astra.mode === "expected_products") return "expected_products";
  if (
    input.submittedAnalysisMode === "planogram_comparison" ||
    (input.planogramRequested && input.submittedAnalysisMode !== "expected_products")
  ) {
    return "planogram";
  }
  return "shelf_only";
}
