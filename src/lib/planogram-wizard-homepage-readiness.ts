import type { PlanogramAuditPackage } from "@/lib/planogram-audit-package";
import type { PlanogramRow } from "@/lib/planogram";
import { HOMEPAGE_READINESS_CHECKS } from "@/lib/planogram-wizard-homepage-copy";

export type HomepageShelfCheckStatus =
  | "ready"
  | "not_set"
  | "optional"
  | "not_required"
  | "not_applicable"
  | "ready_to_analyse";

export type HomepageShelfCheck = {
  id: (typeof HOMEPAGE_READINESS_CHECKS)[number]["id"];
  title: string;
  description: string;
  status: HomepageShelfCheckStatus;
};

export type HomepageReadinessSummary = {
  readyCount: number;
  totalCount: number;
  summaryText: string;
};

function hasShelfLayout(rows: PlanogramRow[]): boolean {
  return rows.some(
    (row) => String(row.shelf_position ?? "").trim() || row.expected_facings != null,
  );
}

function hasPrices(rows: PlanogramRow[], pkg: PlanogramAuditPackage): boolean {
  return (
    pkg.price_requirements.length > 0 ||
    rows.some((row) => row.mrp_inr != null && Number.isFinite(Number(row.mrp_inr)))
  );
}

export function computeHomepageShelfChecks(
  planogramMode: "demo" | "custom" | "none",
  rows: PlanogramRow[],
  pkg: PlanogramAuditPackage,
): HomepageShelfCheck[] {
  const templates = HOMEPAGE_READINESS_CHECKS;

  if (planogramMode === "demo") {
    return templates.map((item) => ({ ...item, status: "ready" as const }));
  }

  if (planogramMode === "none") {
    return templates.map((item) => {
      if (item.id === "products") {
        return { ...item, status: "ready_to_analyse" as const };
      }
      return { ...item, status: "not_applicable" as const };
    });
  }

  const hasProducts = rows.length > 0;
  const hasLayout = hasShelfLayout(rows);
  const hasRequiredProducts = pkg.assortment_skus.length > 0 || pkg.msl_skus.length > 0;
  const hasPriceData = hasPrices(rows, pkg);
  const hasPromotions = pkg.promotions.length > 0;

  return templates.map((item) => {
    switch (item.id) {
      case "products":
        return { ...item, status: hasProducts ? "ready" : "not_set" };
      case "shelf_layout":
        return { ...item, status: hasLayout ? "ready" : "not_set" };
      case "required_products":
        return { ...item, status: hasRequiredProducts ? "ready" : "not_set" };
      case "prices":
        return { ...item, status: hasPriceData ? "ready" : "optional" };
      case "promotions":
        return { ...item, status: hasPromotions ? "ready" : "optional" };
      default:
        return { ...item, status: "not_set" };
    }
  });
}

export function summarizeHomepageReadiness(
  planogramMode: "demo" | "custom" | "none",
  checks: HomepageShelfCheck[],
): HomepageReadinessSummary {
  if (planogramMode === "none") {
    return {
      readyCount: 1,
      totalCount: 1,
      summaryText: "Ready to analyse your shelf photo",
    };
  }

  const applicable = checks.filter(
    (check) => check.status !== "not_applicable" && check.status !== "not_required",
  );
  const readyCount = applicable.filter((check) => check.status === "ready").length;
  const totalCount = applicable.length;

  return {
    readyCount,
    totalCount,
    summaryText: `${readyCount} of ${totalCount} shelf checks ready`,
  };
}

export function homepageCustomAuditBlockReason(
  planogramMode: "demo" | "custom" | "none",
  rows: PlanogramRow[],
  needsPhoto: boolean,
  hasPhoto: boolean,
): string | null {
  if (needsPhoto && !hasPhoto) {
    return "Add a shelf photo before starting the audit.";
  }
  if (planogramMode === "custom" && rows.length === 0) {
    return "Add at least one product in Step 3 before starting your audit.";
  }
  return null;
}
