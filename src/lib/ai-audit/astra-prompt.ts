import type { ExpectedProduct } from "@/lib/ai-audit/expected-products";
import { ASTRA_EXPECTED_PRODUCTS_PROMPT_BODY } from "@/lib/ai-audit/prompts/expected-products.prompt";
import { ASTRA_PLANOGRAM_COMPARISON_PROMPT_BODY } from "@/lib/ai-audit/prompts/planogram-comparison.prompt";
import { ASTRA_SHELF_ONLY_PROMPT_BODY } from "@/lib/ai-audit/prompts/shelf-only.prompt";
import { getRoleProfile } from "@/lib/role-kpi-config";
import type { AuditRoleTab } from "@/lib/role-audit-ui";
import type { NewAuditPlanogramChoice } from "@/lib/new-audit/planogram-setup";
import type { ScanContextState } from "@/lib/scan-context";

export type AstraPromptInput = {
  auditName?: string;
  auditDescription?: string;
  instructions?: string;
  aiPlanogramChoice?: NewAuditPlanogramChoice | null;
  scanContext: ScanContextState;
  category?: string;
  subCategory?: string;
  subCategoryLabel?: string;
};

function categoryContext(category?: string | null, subCategory?: string | null): string {
  const parts = [category?.trim(), subCategory?.trim()].filter(Boolean);
  return parts.length ? parts.join(" · ") : "General";
}

export function buildAstraPlanogramPrompt(input: {
  operatingModel: string;
  operatingModelSlug: string;
  planogramItems: Record<string, unknown>[];
  location?: string | null;
  category?: string | null;
  subCategory?: string | null;
  auditName?: string;
  notes?: string | null;
}): string {
  return ASTRA_PLANOGRAM_COMPARISON_PROMPT_BODY.replace("{{OPERATING_MODEL}}", input.operatingModel)
    .replace("{{PLANOGRAM_ITEMS_JSON}}", JSON.stringify(input.planogramItems, null, 2))
    .replace("{{TRUSTED_LOCATION}}", input.location?.trim() || "Not supplied")
    .replace("{{CATEGORY_CONTEXT}}", categoryContext(input.category, input.subCategory))
    .replace("{{AUDITOR_NOTES}}", [input.auditName?.trim(), input.notes?.trim()].filter(Boolean).join(" · ") || "None");
}

export function buildAstraExpectedProductsPrompt(input: {
  operatingModel: string;
  operatingModelSlug: string;
  expectedProducts: ExpectedProduct[];
  location?: string | null;
  notes?: string | null;
}): string {
  return ASTRA_EXPECTED_PRODUCTS_PROMPT_BODY.replace(/\{\{operating_model\}\}/g, input.operatingModelSlug)
    .replace("{{EXPECTED_PRODUCTS_JSON}}", JSON.stringify(input.expectedProducts, null, 2))
    .replace(
      /\{\{shelf_image\}\}/g,
      "Attached shelf/store image supplied by Aislix via image_urls with this request.",
    );
}

export function buildAstraShelfOnlyPrompt(input: {
  operatingModel: string;
  category?: string | null;
  subCategory?: string | null;
  notes?: string | null;
}): string {
  return ASTRA_SHELF_ONLY_PROMPT_BODY.replace("{{OPERATING_MODEL}}", input.operatingModel)
    .replace("{{CATEGORY_CONTEXT}}", categoryContext(input.category, input.subCategory))
    .replace("{{AUDITOR_NOTES}}", input.notes?.trim() || "None");
}

/** Preview prompt shown in the UI before scan submission. */
export function buildAstraVisionPrompt(input: AstraPromptInput): string {
  const role = (input.scanContext.auditRole ?? "supermarket") as AuditRoleTab;
  const category =
    input.category ??
    input.scanContext.planogramMeta?.category?.trim() ??
    undefined;
  const subCategory =
    input.subCategory ??
    input.scanContext.planogramMeta?.sub_category?.trim() ??
    undefined;
  const notes = [input.auditDescription?.trim(), input.instructions?.trim()]
    .filter(Boolean)
    .join("\n");
  const withPlanogram = input.aiPlanogramChoice !== "without";
  const planogramRows = withPlanogram ? input.scanContext.planogramRows : [];
  const expectedProducts = withPlanogram ? [] : (input.scanContext.expectedProducts ?? []);

  const analysisMode =
    planogramRows.length > 0
      ? "planogram_comparison"
      : expectedProducts.length > 0
        ? "expected_products"
        : "shelf_only";
  const operatingModel = getRoleProfile(role).label;
  const location =
    input.scanContext.planogramMeta?.fixture_id ?? input.scanContext.planogramMeta?.store_outlet;

  let visionPrompt: string;
  if (analysisMode === "planogram_comparison") {
    visionPrompt = buildAstraPlanogramPrompt({
      operatingModel,
      operatingModelSlug: role,
      planogramItems: planogramRows.map((row) => ({
        location: row.location?.trim() ?? "",
        category: row.category?.trim() ?? "",
        sub_category: row.sub_category?.trim() ?? "",
        brand: row.brand?.trim() ?? "",
        product_name: row.product_name?.trim() ?? "",
        variant: row.variant?.trim() ?? "",
        expected_facings: row.expected_facings ?? row.expected_qty ?? 0,
        min_facings: row.min_facings,
        max_facings: row.max_facings,
        expected_shelf_units: row.expected_shelf_units,
        mrp_inr: row.mrp_inr,
        avg_daily_sales: row.avg_daily_sales,
        sku: row.sku?.trim() ?? "",
        shelf_position: row.shelf_position?.trim() ?? "",
        expected_qty: row.expected_qty ?? row.expected_facings ?? 0,
      })),
      location,
      category,
      subCategory,
      auditName: input.auditName,
      notes,
    });
  } else if (analysisMode === "expected_products") {
    visionPrompt = buildAstraExpectedProductsPrompt({
      operatingModel,
      operatingModelSlug: role,
      expectedProducts,
      location,
      notes,
    });
  } else {
    visionPrompt = buildAstraShelfOnlyPrompt({
      operatingModel,
      category,
      subCategory,
      notes,
    });
  }

  const roleLabel = getRoleProfile(role).label;
  return `${visionPrompt}

---
Aislix payload preview
- Customer role: ${roleLabel}
- Analysis mode: ${analysisMode}
- Operating model: ${operatingModel}`;
}
