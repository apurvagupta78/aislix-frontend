/**
 * Homepage demo shelf preview — stats derived from configured oral-care demo data.
 */

import {
  DEMO_ORAL_CARE_ROWS,
  buildDemoOralCareScanContext,
  buildDemoPositionInventory,
  compareDemoOralCarePlanogram,
  demoPriceComplianceLines,
} from "@/lib/demo-oral-care-planogram";
import { buildDemoCompetitorIntel } from "@/lib/scan-context";

export type HomepageDemoPreviewStats = {
  productsDetected: number;
  brandsDetected: number;
  osaPercent: number;
  shelfExecutionPercent: number;
  primaryBrand: string;
  primaryBrandShelfSharePercent: number;
  priceIssueCount: number;
  actionIssueCount: number;
};

/** Derive preview metrics from demo planogram + observations (not arbitrary numbers). */
export function getHomepageDemoPreviewStats(): HomepageDemoPreviewStats {
  const match = compareDemoOralCarePlanogram();
  const inventory = buildDemoPositionInventory();
  const ctx = buildDemoOralCareScanContext();
  const intel = buildDemoCompetitorIntel(
    inventory.map((item, index) => ({
      ...item,
      id: `demo-${index}`,
      brand: item.brand ?? "Unknown",
      name: item.product_name ?? item.product ?? "Product",
      quantity: item.quantity ?? 0,
      confidence: 1,
    })),
    ctx,
  );

  const invSkus = new Set(inventory.map((i) => i.sku).filter(Boolean));
  const expectedSkus = [...new Set(DEMO_ORAL_CARE_ROWS.map((r) => r.sku))];
  const available = expectedSkus.filter((sku) => invSkus.has(sku)).length;
  const osaPercent = Math.round((available / Math.max(expectedSkus.length, 1)) * 100);
  const shelfExecutionPercent =
    match.sku_match_percent ??
    Math.round((match.correct_count / Math.max(DEMO_ORAL_CARE_ROWS.length, 1)) * 100);
  const priceIssueCount = demoPriceComplianceLines().filter((l) => l.status === "mismatch").length;
  const actionIssueCount = match.lines.filter((l) => l.issue_type !== "correct").length;

  const productsDetected = invSkus.size;
  const brandsDetected = new Set(inventory.map((i) => i.brand).filter(Boolean)).size;
  const primaryBrand = intel?.primary_brand ?? ctx.focus.brand ?? "Colgate";
  const primaryBrandShelfSharePercent = Math.round(intel?.own_brand_share_percent ?? 0);

  return {
    productsDetected,
    brandsDetected,
    osaPercent,
    shelfExecutionPercent,
    primaryBrand,
    primaryBrandShelfSharePercent,
    priceIssueCount,
    actionIssueCount,
  };
}

export type DemoShelfOverlay = {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
  label: string;
  kind: "product" | "brand" | "issue" | "availability";
};

/** Subtle annotation positions for the toothpaste-a1l demo shelf (percent of image box). */
export const HOMEPAGE_DEMO_SHELF_OVERLAYS: DemoShelfOverlay[] = [
  { id: "r1", left: 16, top: 9, width: 68, height: 10, label: "Colgate MaxFresh", kind: "product" },
  { id: "r2", left: 14, top: 22, width: 72, height: 9, label: "Colgate", kind: "brand" },
  { id: "r3", left: 14, top: 34, width: 70, height: 9, label: "Doctor · Odol", kind: "product" },
  { id: "r4", left: 16, top: 46, width: 66, height: 9, label: "Oral-B", kind: "brand" },
  { id: "r5", left: 14, top: 58, width: 72, height: 10, label: "Sensodyne · Closeup", kind: "product" },
  { id: "issue1", left: 10, top: 8, width: 24, height: 7, label: "Price", kind: "issue" },
  { id: "issue2", left: 52, top: 33, width: 22, height: 8, label: "Placement", kind: "issue" },
  { id: "avail1", left: 58, top: 57, width: 26, height: 8, label: "Low facings", kind: "availability" },
];
