import type {
  AuditPurpose,
  AuditSubjectType,
  OperatingModel,
  TemplateDefinition,
} from "@/lib/audit-builder/types";
import {
  buildCompetitorAudit,
  buildCycleCountAudit,
  buildDamageAudit,
  buildDarkStoreInventoryExpiry,
  buildDarkStoreLocationAudit,
  buildDepartmentAudit,
  buildExpiryAudit,
  buildFnvQcAudit,
  buildFmcgDistributorAudit,
  buildFmcgGenericAudit,
  buildFmcgMerchandisingAudit,
  buildFmcgOosAudit,
  buildFmcgOutletRetailExecution,
  buildFmcgOutletVisit,
  buildInventoryAudit,
  buildOpeningClosingAudit,
  buildPlanogramAudit,
  buildPosmAudit,
  buildPriceAudit,
  buildPromotionAudit,
  buildReconciliationAudit,
  buildShelfAudit,
  buildShelfStackingAudit,
  buildStockAgeingAudit,
  buildStoreVisit,
  buildSupermarketPlanogramShelf,
  buildWarehouseBinAudit,
  buildWarehouseOpsAudit,
  buildWarehouseReceivingQc,
} from "./builders";
import { field } from "./helpers";

export type SystemTemplateSpec = {
  key: string;
  name: string;
  shortDescription: string;
  operatingModel: OperatingModel;
  purpose: AuditPurpose;
  subjectType: AuditSubjectType;
  templateType: string;
  category: string;
  recommended?: boolean;
  flagship?: boolean;
  build: () => TemplateDefinition;
};

function spec(
  key: string,
  name: string,
  shortDescription: string,
  operatingModel: OperatingModel,
  purpose: AuditPurpose,
  subjectType: AuditSubjectType,
  templateType: string,
  category: string,
  build: () => TemplateDefinition,
  opts?: { recommended?: boolean; flagship?: boolean },
): SystemTemplateSpec {
  return {
    key,
    name,
    shortDescription,
    operatingModel,
    purpose,
    subjectType,
    templateType,
    category,
    recommended: opts?.recommended,
    flagship: opts?.flagship,
    build,
  };
}

/** Flagship acceptance templates validated end-to-end. */
export const ACCEPTANCE_TEMPLATES: SystemTemplateSpec[] = [
  spec(
    "local_store_expiry",
    "Local Store Expiry Audit",
    "Expiry verification with quantity-linked unit coverage for local stores.",
    "local_store",
    "expiry",
    "sku",
    "expiry_audit",
    "Expiry",
    () => buildExpiryAudit("local_store", "sku"),
    { recommended: true, flagship: true },
  ),
  spec(
    "supermarket_planogram_shelf",
    "Supermarket Planogram + Shelf Execution Audit",
    "Planogram compliance and shelf execution for supermarkets.",
    "supermarket",
    "planogram",
    "shelf",
    "planogram_audit",
    "Planogram",
    buildSupermarketPlanogramShelf,
    { recommended: true, flagship: true },
  ),
  spec(
    "dark_store_inventory_expiry",
    "Dark Store Inventory + Expiry Audit",
    "Inventory accuracy and expiry unit coverage for dark stores.",
    "dark_store",
    "expiry",
    "unit",
    "expiry_audit",
    "Expiry",
    buildDarkStoreInventoryExpiry,
    { recommended: true, flagship: true },
  ),
  spec(
    "warehouse_receiving_qc",
    "Warehouse Receiving + Inventory QC Audit",
    "Receiving QC with variance, batch and expiry checks.",
    "warehouse",
    "receiving",
    "shipment",
    "warehouse_audit",
    "Receiving",
    buildWarehouseReceivingQc,
    { recommended: true, flagship: true },
  ),
  spec(
    "fmcg_outlet_retail_execution",
    "FMCG Outlet Retail Execution Audit",
    "Flagship FMCG outlet audit covering availability, shelf, pricing and promotion.",
    "fmcg_distributor",
    "retail_execution",
    "outlet",
    "distributor_audit",
    "Retail Execution",
    buildFmcgOutletRetailExecution,
    { recommended: true, flagship: true },
  ),
];

const LOCAL_STORE: SystemTemplateSpec[] = [
  spec("local_store_visit", "Store Visit Audit", "General store visit and execution check.", "local_store", "outlet_visit", "store", "store_visit_audit", "Visit", () => buildStoreVisit("local_store")),
  spec("local_store_inventory", "Local Store Inventory Audit", "SKU-level inventory variance audit.", "local_store", "inventory", "sku", "inventory_audit", "Inventory", () => buildInventoryAudit("local_store"), { recommended: true }),
  spec("local_store_expiry", "Local Store Expiry Audit", "Expiry verification with unit coverage.", "local_store", "expiry", "sku", "expiry_audit", "Expiry", () => buildExpiryAudit("local_store", "sku"), { recommended: true, flagship: true }),
  spec("local_store_fnv_qc", "Local Store FNV / QC Audit", "Fresh/near-expiry quality control.", "local_store", "fnv_qc", "sku", "fnv_qc_audit", "QC", () => buildFnvQcAudit("local_store")),
  spec("local_store_price", "Local Store Price Audit", "Price compliance check.", "local_store", "pricing", "sku", "custom", "Pricing", () => buildPriceAudit("local_store")),
  spec("local_store_shelf", "Local Store Shelf Audit", "Shelf presence and facing audit.", "local_store", "shelf", "shelf", "shelf_audit", "Shelf", () => buildShelfAudit("local_store")),
  spec("local_store_shelf_stacking", "Local Store Shelf Stacking Audit", "Verify product stacking and arrangement on shelves.", "local_store", "shelf", "shelf", "shelf_stacking_audit", "Shelf Stacking", () => buildShelfStackingAudit("local_store"), { recommended: true, flagship: true }),
];

const SUPERMARKET: SystemTemplateSpec[] = [
  spec("supermarket_planogram_shelf", "Supermarket Planogram + Shelf Execution Audit", "Combined planogram and shelf execution.", "supermarket", "planogram", "shelf", "planogram_audit", "Planogram", buildSupermarketPlanogramShelf, { recommended: true, flagship: true }),
  spec("supermarket_shelf_execution", "Supermarket Shelf Execution Audit", "Shelf presence, facing and OOS checks.", "supermarket", "shelf", "shelf", "shelf_audit", "Shelf", () => buildShelfAudit("supermarket")),
  spec("supermarket_shelf_stacking", "Supermarket Shelf Stacking Audit", "Verify how products are stacked and arranged on shelves.", "supermarket", "shelf", "shelf", "shelf_stacking_audit", "Shelf Stacking", () => buildShelfStackingAudit("supermarket"), { recommended: true, flagship: true }),
  spec("supermarket_planogram", "Supermarket Planogram Audit", "Planogram compliance audit.", "supermarket", "planogram", "shelf", "planogram_audit", "Planogram", () => buildPlanogramAudit("supermarket")),
  spec("supermarket_inventory", "Supermarket Inventory Audit", "SKU inventory variance.", "supermarket", "inventory", "sku", "inventory_audit", "Inventory", () => buildInventoryAudit("supermarket")),
  spec("supermarket_expiry", "Supermarket Expiry Audit", "Expiry verification with evidence.", "supermarket", "expiry", "sku", "expiry_audit", "Expiry", () => buildExpiryAudit("supermarket", "sku")),
  spec("supermarket_pricing", "Supermarket Pricing Audit", "Price compliance.", "supermarket", "pricing", "sku", "custom", "Pricing", () => buildPriceAudit("supermarket"), { recommended: true }),
  spec("supermarket_promotion", "Supermarket Promotion Audit", "Promotion execution compliance.", "supermarket", "promotion", "sku", "custom", "Promotion", () => buildPromotionAudit("supermarket")),
  spec("supermarket_posm", "Supermarket POSM / Visibility Audit", "POSM and brand visibility.", "supermarket", "posm", "store", "custom", "POSM", () => buildPosmAudit("supermarket")),
  spec("supermarket_department", "Supermarket Department Audit", "Department-level execution check.", "supermarket", "custom", "store", "store_visit_audit", "Department", () => buildDepartmentAudit("supermarket")),
  spec("supermarket_opening", "Supermarket Opening Audit", "Opening readiness checklist.", "supermarket", "custom", "store", "store_visit_audit", "Operations", () => buildOpeningClosingAudit("supermarket", "custom")),
  spec("supermarket_closing", "Supermarket Closing Audit", "Closing checklist.", "supermarket", "custom", "store", "store_visit_audit", "Operations", () => buildOpeningClosingAudit("supermarket", "custom")),
  spec("supermarket_fnv_qc", "Supermarket FNV / QC Audit", "Fresh produce quality control.", "supermarket", "fnv_qc", "sku", "fnv_qc_audit", "QC", () => buildFnvQcAudit("supermarket")),
  spec("supermarket_competitor", "Supermarket Competitor Audit", "Competitor pricing and visibility.", "supermarket", "competitor", "sku", "custom", "Competitor", () => buildCompetitorAudit("supermarket")),
];

const DARK_STORE: SystemTemplateSpec[] = [
  spec("dark_store_inventory", "Dark Store Inventory Accuracy Audit", "Location-level inventory accuracy.", "dark_store", "inventory", "sku", "inventory_audit", "Inventory", () => buildInventoryAudit("dark_store"), { recommended: true }),
  spec("dark_store_cycle_count", "Dark Store Cycle Count Audit", "Cycle count with variance.", "dark_store", "inventory", "sku", "inventory_audit", "Cycle Count", () => buildCycleCountAudit("dark_store")),
  spec("dark_store_expiry", "Dark Store Expiry Control Audit", "Expiry control with unit coverage.", "dark_store", "expiry", "unit", "expiry_audit", "Expiry", () => buildExpiryAudit("dark_store", "unit"), { recommended: true }),
  spec("dark_store_inventory_expiry", "Dark Store Inventory + Expiry Audit", "Combined inventory and expiry unit coverage.", "dark_store", "expiry", "unit", "expiry_audit", "Inventory + Expiry", buildDarkStoreInventoryExpiry, { recommended: true, flagship: true }),
  spec("dark_store_fnv_qc", "Dark Store FNV / QC Audit", "Quality control for perishables.", "dark_store", "fnv_qc", "sku", "fnv_qc_audit", "QC", () => buildFnvQcAudit("dark_store")),
  spec("dark_store_receiving", "Dark Store Receiving Audit", "Inbound receiving check.", "dark_store", "receiving", "shipment", "warehouse_audit", "Receiving", () => buildWarehouseReceivingQc("dark_store"), { recommended: true }),
  spec("dark_store_putaway", "Dark Store Putaway Audit", "Putaway accuracy.", "dark_store", "putaway", "sku", "warehouse_audit", "Putaway", () => buildWarehouseOpsAudit("putaway", "Putaway", "dark_store")),
  spec("dark_store_picking", "Dark Store Picking Accuracy Audit", "Pick accuracy verification.", "dark_store", "picking", "sku", "warehouse_audit", "Picking", () => buildWarehouseOpsAudit("picking", "Picking", "dark_store"), { recommended: true }),
  spec("dark_store_damage", "Dark Store Damaged Inventory Audit", "Damage reporting.", "dark_store", "custom", "sku", "custom", "Damage", () => buildDamageAudit("dark_store")),
  spec("dark_store_shelf_location", "Dark Store Shelf / Location Audit", "Shelf and pick-face compliance.", "dark_store", "shelf", "bin", "shelf_audit", "Location", buildDarkStoreLocationAudit),
  spec("dark_store_shelf_stacking", "Dark Store Shelf Stacking Audit", "Verify stacking arrangement on pick-face shelves.", "dark_store", "shelf", "shelf", "shelf_stacking_audit", "Shelf Stacking", () => buildShelfStackingAudit("dark_store"), { recommended: true }),
  spec("dark_store_opening", "Dark Store Opening Audit", "Opening readiness.", "dark_store", "custom", "store", "store_visit_audit", "Operations", () => buildOpeningClosingAudit("dark_store", "custom")),
  spec("dark_store_closing", "Dark Store Closing Audit", "Closing checklist.", "dark_store", "custom", "store", "store_visit_audit", "Operations", () => buildOpeningClosingAudit("dark_store", "custom")),
  spec("dark_store_bin_location", "Dark Store Bin / Location Accuracy Audit", "Bin-level location accuracy.", "dark_store", "inventory", "bin", "warehouse_audit", "Location", buildDarkStoreLocationAudit),
  spec("dark_store_stock_ageing", "Dark Store Stock Ageing Audit", "Stock ageing and expiry risk.", "dark_store", "expiry", "batch", "expiry_audit", "Ageing", () => buildStockAgeingAudit("dark_store")),
  spec("dark_store_reconciliation", "Dark Store Reconciliation Audit", "System vs physical reconciliation.", "dark_store", "inventory", "sku", "inventory_audit", "Reconciliation", () => buildReconciliationAudit("dark_store")),
];

const WAREHOUSE: SystemTemplateSpec[] = [
  spec("warehouse_receiving_qc", "Warehouse Receiving QC Audit", "Receiving QC with variance checks.", "warehouse", "receiving", "shipment", "warehouse_audit", "Receiving", buildWarehouseReceivingQc, { recommended: true, flagship: true }),
  spec("warehouse_inventory_count", "Warehouse Inventory Count Audit", "Full inventory count.", "warehouse", "inventory", "bin", "warehouse_audit", "Inventory", buildWarehouseBinAudit, { recommended: true }),
  spec("warehouse_bin_audit", "Warehouse Bin Audit", "Bin-level stock verification.", "warehouse", "inventory", "bin", "warehouse_audit", "Bin", buildWarehouseBinAudit),
  spec("warehouse_putaway", "Warehouse Putaway Audit", "Putaway accuracy.", "warehouse", "putaway", "sku", "warehouse_audit", "Putaway", () => buildWarehouseOpsAudit("putaway", "Putaway"), { recommended: true }),
  spec("warehouse_picking", "Warehouse Picking Accuracy Audit", "Pick accuracy.", "warehouse", "picking", "sku", "warehouse_audit", "Picking", () => buildWarehouseOpsAudit("picking", "Picking")),
  spec("warehouse_dispatch", "Warehouse Dispatch Audit", "Dispatch accuracy.", "warehouse", "dispatch", "shipment", "warehouse_audit", "Dispatch", () => buildWarehouseOpsAudit("dispatch", "Dispatch"), { recommended: true }),
  spec("warehouse_loading", "Warehouse Loading Audit", "Loading verification.", "warehouse", "dispatch", "shipment", "warehouse_audit", "Loading", () => buildWarehouseOpsAudit("dispatch", "Loading")),
  spec("warehouse_damage", "Warehouse Damage Audit", "Damage reporting.", "warehouse", "custom", "sku", "custom", "Damage", () => buildDamageAudit("warehouse")),
  spec("warehouse_expiry", "Warehouse Expiry Audit", "Expiry verification.", "warehouse", "expiry", "batch", "expiry_audit", "Expiry", () => buildExpiryAudit("warehouse", "batch")),
  spec("warehouse_batch", "Warehouse Batch Audit", "Batch traceability.", "warehouse", "inventory", "batch", "warehouse_audit", "Batch", () => buildStockAgeingAudit("warehouse")),
  spec("warehouse_storage_compliance", "Warehouse Storage Compliance Audit", "Storage condition compliance.", "warehouse", "custom", "bin", "warehouse_audit", "Compliance", () => buildWarehouseBinAudit()),
  spec("warehouse_location_accuracy", "Warehouse Location Accuracy Audit", "Location accuracy.", "warehouse", "inventory", "bin", "warehouse_audit", "Location", buildWarehouseBinAudit),
  spec("warehouse_cycle_count", "Warehouse Cycle Count Audit", "Cycle count.", "warehouse", "inventory", "sku", "warehouse_audit", "Cycle Count", () => buildCycleCountAudit("warehouse")),
];

const FMCG: SystemTemplateSpec[] = [
  spec("fmcg_outlet_retail_execution", "FMCG Outlet Retail Execution Audit", "Full outlet execution audit.", "fmcg_distributor", "retail_execution", "outlet", "distributor_audit", "Retail Execution", buildFmcgOutletRetailExecution, { recommended: true, flagship: true }),
  spec("fmcg_outlet_visit", "FMCG Outlet Visit Audit", "Outlet visit checklist.", "fmcg_distributor", "outlet_visit", "outlet", "distributor_audit", "Outlet", buildFmcgOutletVisit),
  spec("fmcg_stock_availability", "FMCG Stock Availability Audit", "SKU availability at outlet.", "fmcg_distributor", "availability", "sku", "inventory_audit", "Availability", () => buildInventoryAudit("fmcg_distributor", "availability", "sku"), { recommended: true }),
  spec("fmcg_oos", "FMCG OOS Audit", "Out-of-stock detection.", "fmcg_distributor", "oos", "sku", "inventory_audit", "OOS", buildFmcgOosAudit),
  spec("fmcg_distributor_audit", "FMCG Distributor Audit", "Distributor performance audit.", "fmcg_distributor", "distributor", "distributor", "distributor_audit", "Distributor", buildFmcgDistributorAudit, { recommended: true }),
  spec("fmcg_distributor_stock", "FMCG Distributor Stock Audit", "Distributor stock levels.", "fmcg_distributor", "stock", "sku", "inventory_audit", "Stock", () => buildInventoryAudit("fmcg_distributor", "stock", "sku")),
  spec("fmcg_expiry", "FMCG Expiry Audit", "Outlet expiry verification.", "fmcg_distributor", "expiry", "batch", "expiry_audit", "Expiry", () => buildExpiryAudit("fmcg_distributor", "batch"), { recommended: true }),
  spec("fmcg_fnv_qc", "FMCG FNV / QC Audit", "Perishable quality control.", "fmcg_distributor", "fnv_qc", "sku", "fnv_qc_audit", "QC", () => buildFnvQcAudit("fmcg_distributor")),
  spec("fmcg_merchandising", "FMCG Merchandising Audit", "Merchandising execution.", "fmcg_distributor", "merchandising", "sku", "custom", "Merchandising", buildFmcgMerchandisingAudit, { recommended: true }),
  spec("fmcg_shelf_visibility", "FMCG Shelf Visibility Audit", "Shelf visibility and facing.", "fmcg_distributor", "visibility", "shelf", "shelf_audit", "Visibility", () => buildShelfAudit("fmcg_distributor")),
  spec("fmcg_planogram", "FMCG Planogram Audit", "Outlet planogram compliance.", "fmcg_distributor", "planogram", "shelf", "planogram_audit", "Planogram", () => buildPlanogramAudit("fmcg_distributor")),
  spec("fmcg_pricing", "FMCG Pricing Audit", "Outlet price compliance.", "fmcg_distributor", "pricing", "sku", "custom", "Pricing", () => buildPriceAudit("fmcg_distributor"), { recommended: true }),
  spec("fmcg_promotion", "FMCG Promotion Compliance Audit", "Promotion execution.", "fmcg_distributor", "promotion", "sku", "custom", "Promotion", () => buildPromotionAudit("fmcg_distributor"), { recommended: true }),
  spec("fmcg_posm", "FMCG POSM Audit", "POSM compliance.", "fmcg_distributor", "posm", "store", "custom", "POSM", () => buildPosmAudit("fmcg_distributor")),
  spec("fmcg_competitor", "FMCG Competitor Audit", "Competitor tracking.", "fmcg_distributor", "competitor", "sku", "custom", "Competitor", () => buildCompetitorAudit("fmcg_distributor")),
  spec("fmcg_new_product_launch", "FMCG New Product Launch Audit", "New product launch execution.", "fmcg_distributor", "new_product_launch", "sku", "custom", "Launch", () =>
    buildFmcgGenericAudit("new_product_launch", "New Product Launch", [
      field("fmcg", 5, "yes_no", "Product Present"),
      field("fmcg", 6, "yes_no", "Display Present"),
      field("fmcg", 7, "pass_fail", "Launch Compliance"),
    ])),
  spec("fmcg_outlet_compliance", "FMCG Outlet Compliance Audit", "Outlet compliance checklist.", "fmcg_distributor", "outlet_compliance", "outlet", "distributor_audit", "Compliance", () =>
    buildFmcgGenericAudit("outlet_compliance", "Outlet Compliance", [
      field("fmcg", 5, "pass_fail", "Compliance Status"),
      field("fmcg", 6, "quality_score", "Score"),
    ])),
  spec("fmcg_scheme_compliance", "FMCG Scheme Compliance Audit", "Trade scheme compliance.", "fmcg_distributor", "scheme_compliance", "sku", "custom", "Scheme", () =>
    buildFmcgGenericAudit("scheme_compliance", "Scheme Compliance", [
      field("fmcg", 5, "short_text", "Scheme Name"),
      field("fmcg", 6, "pass_fail", "Scheme Compliance"),
    ])),
  spec("fmcg_order_distribution", "FMCG Order / Distribution Audit", "Order and distribution check.", "fmcg_distributor", "order_distribution", "outlet", "distributor_audit", "Distribution", () =>
    buildFmcgGenericAudit("order_distribution", "Order / Distribution", [
      field("fmcg", 5, "expected_qty", "Ordered Qty"),
      field("fmcg", 6, "actual_qty", "Delivered Qty"),
      field("fmcg", 7, "qty_variance", "Variance", { calculated: true }),
    ])),
  spec("fmcg_retailer_execution", "FMCG Retailer Execution Audit", "Retailer-level execution.", "fmcg_distributor", "retail_execution", "outlet", "distributor_audit", "Retailer", buildFmcgOutletRetailExecution),
];

/** Full starter library — executable system templates across 5 operating models. */
export const STARTER_TEMPLATE_LIBRARY: SystemTemplateSpec[] = [
  ...LOCAL_STORE,
  ...SUPERMARKET,
  ...DARK_STORE,
  ...WAREHOUSE,
  ...FMCG,
];

export function getSystemTemplateSpec(key: string): SystemTemplateSpec | undefined {
  return STARTER_TEMPLATE_LIBRARY.find((t) => t.key === key);
}

export function getTemplatesByOperatingModel(model: OperatingModel): SystemTemplateSpec[] {
  return STARTER_TEMPLATE_LIBRARY.filter((t) => t.operatingModel === model);
}

export function buildSystemTemplateDefinition(key: string): TemplateDefinition | null {
  const s = getSystemTemplateSpec(key);
  if (!s) return null;
  return s.build();
}

export function groupTemplatesByPurpose(model: OperatingModel): Record<string, SystemTemplateSpec[]> {
  return getTemplatesByOperatingModel(model).reduce<Record<string, SystemTemplateSpec[]>>((acc, t) => {
    const group = t.category || "Other";
    acc[group] = acc[group] ?? [];
    acc[group].push(t);
    return acc;
  }, {});
}
