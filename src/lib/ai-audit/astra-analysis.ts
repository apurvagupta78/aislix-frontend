import type { ExpectedProduct } from "@/lib/ai-audit/expected-products";
import {
  buildAstraPlanogramPrompt,
  buildAstraWithoutPlanogramPrompt,
} from "@/lib/ai-audit/astra-prompt";
import type { PlanogramRow } from "@/lib/planogram";
import type { AuditRoleTab } from "@/lib/role-audit-ui";

export type AstraAnalysisMode = "planogram_comparison" | "expected_products" | "shelf_only";

export function auditRoleToOperatingModel(role: AuditRoleTab | string | undefined): string {
  switch (role) {
    case "local":
      return "local_store";
    case "darkstore":
      return "dark_store";
    case "fmcg":
      return "fmcg_distributor";
    case "distributor":
      return "fmcg_distributor";
    case "supermarket":
    default:
      return "supermarket";
  }
}

export function operatingModelLabel(slug: string): string {
  switch (slug) {
    case "local_store":
      return "Local Store";
    case "dark_store":
      return "Dark Store";
    case "warehouse":
      return "Warehouse";
    case "fmcg_distributor":
      return "FMCG / Distributor";
    case "supermarket":
    default:
      return "Supermarket";
  }
}

export function pickAstraAnalysisMode(input: {
  planogramRowCount: number;
  expectedProductCount: number;
  assignmentHasPlanogram?: boolean;
}): AstraAnalysisMode {
  if (input.assignmentHasPlanogram || input.planogramRowCount > 0) {
    return "planogram_comparison";
  }
  if (input.expectedProductCount > 0) return "expected_products";
  return "shelf_only";
}

export type BuildAstraVisionExtrasInput = {
  auditRole?: AuditRoleTab | string;
  planogramRows?: PlanogramRow[];
  expectedProducts?: ExpectedProduct[];
  assignmentHasPlanogram?: boolean;
  location?: string | null;
  category?: string | null;
  subCategory?: string | null;
  auditName?: string;
  notes?: string | null;
  focusBrand?: string | null;
};

export function buildAstraVisionExtras(input: BuildAstraVisionExtrasInput): {
  analysis_mode: AstraAnalysisMode;
  operating_model: string;
  vision_prompt: string;
  planogram_items?: ReturnType<typeof shapePlanogramItemForApi>[];
  expected_products?: ExpectedProduct[];
} {
  const planogramRows = input.planogramRows ?? [];
  const defaultCategory = input.category?.trim() ?? "";
  const defaultSubCategory = input.subCategory?.trim() ?? "";
  const expectedProducts = (input.expectedProducts ?? []).map((row) => ({
    location: row.location,
    category: row.category || defaultCategory,
    sub_category: row.sub_category || defaultSubCategory,
    brand: row.brand,
    product_name: row.product_name,
    variant: row.variant,
    expected_facings: row.expected_facings,
    expected_shelf_units: row.expected_shelf_units,
  }));

  const analysis_mode = pickAstraAnalysisMode({
    planogramRowCount: planogramRows.length,
    expectedProductCount: expectedProducts.length,
    assignmentHasPlanogram: input.assignmentHasPlanogram,
  });

  const operating_model = auditRoleToOperatingModel(input.auditRole);
  const operatingLabel = operatingModelLabel(operating_model);

  if (analysis_mode === "planogram_comparison") {
    const planogram_items = planogramRows.map(shapePlanogramItemForApi);
    return {
      analysis_mode,
      operating_model,
      planogram_items,
      vision_prompt: buildAstraPlanogramPrompt({
        operatingModel: operatingLabel,
        operatingModelSlug: operating_model,
        planogramItems: planogram_items,
        location: input.location,
        category: input.category,
        subCategory: input.subCategory,
        auditName: input.auditName,
        notes: input.notes,
      }),
    };
  }

  const withoutPlanogramPrompt = buildAstraWithoutPlanogramPrompt({
    operatingModelSlug: operating_model,
    category: input.category,
    subCategory: input.subCategory,
    expectedProducts: analysis_mode === "expected_products" ? expectedProducts : [],
    location: input.location,
    focusBrand: input.focusBrand,
    notes: input.notes,
  });

  if (analysis_mode === "expected_products") {
    return {
      analysis_mode,
      operating_model,
      expected_products: expectedProducts,
      vision_prompt: withoutPlanogramPrompt,
    };
  }

  return {
    analysis_mode,
    operating_model,
    vision_prompt: withoutPlanogramPrompt,
  };
}

export function shapePlanogramItemForApi(row: PlanogramRow | Record<string, unknown>) {
  const r = row as Record<string, unknown>;
  const num = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  return {
    location: String(r.location ?? "").trim(),
    category: String(r.category ?? "").trim(),
    sub_category: String(r.sub_category ?? "").trim(),
    brand: String(r.brand ?? "").trim(),
    product_name: String(r.product_name ?? "").trim(),
    variant: String(r.variant ?? "").trim(),
    expected_facings: num(r.expected_facings),
    min_facings: num(r.min_facings),
    max_facings: num(r.max_facings),
    expected_shelf_units: num(r.expected_shelf_units),
    mrp_inr: num(r.mrp_inr),
    avg_daily_sales: num(r.avg_daily_sales),
    sku: String(r.sku ?? "").trim(),
    shelf_position: String(r.shelf_position ?? "").trim(),
    expected_qty: num(r.expected_qty) ?? num(r.expected_facings) ?? 0,
  };
}
