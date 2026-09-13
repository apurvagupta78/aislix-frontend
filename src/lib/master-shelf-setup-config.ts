/**
 * Role-specific Master Shelf Setup CSV schema — templates, columns, filenames.
 * Each role template includes only fields relevant to that role's KPIs and setup steps.
 */

import type { AuditKpiId } from "@/lib/role-kpi-config";
import { primaryKpiIds, type AuditRoleTab } from "@/lib/role-audit-ui";

export type MasterFieldDef = {
  key: string;
  label: string;
  required?: boolean;
  example?: string;
  accepted?: string;
  group: "common" | "product" | "layout" | "price" | "promotion" | "targets" | "role";
};

const FIELD_REGISTRY: Record<string, MasterFieldDef> = {
  row_type: {
    key: "row_type",
    label: "Row type",
    required: true,
    example: "data",
    accepted: "data (your rows) | example (template only — remove before upload)",
    group: "common",
  },
  audit_role: {
    key: "audit_role",
    label: "Audit role",
    required: true,
    example: "supermarket",
    group: "common",
  },
  planogram_name: {
    key: "planogram_name",
    label: "Planogram name",
    required: true,
    example: "Oral Care Main Gondola",
    group: "common",
  },
  store_id: { key: "store_id", label: "Store ID", example: "STR-001", group: "common" },
  store_name: {
    key: "store_name",
    label: "Store / outlet name",
    required: true,
    example: "Downtown Supermarket",
    group: "common",
  },
  outlet_scope: { key: "outlet_scope", label: "Outlet scope", example: "all", group: "common" },
  fixture_id: { key: "fixture_id", label: "Fixture ID", example: "GON-A1", group: "common" },
  fixture_name: { key: "fixture_name", label: "Fixture name", example: "Main Gondola", group: "common" },
  fixture_type: { key: "fixture_type", label: "Fixture type", example: "gondola", group: "common" },
  category: {
    key: "category",
    label: "Category",
    required: true,
    example: "Personal Care",
    group: "common",
  },
  sub_category: { key: "sub_category", label: "Sub-category", example: "Oral Care", group: "common" },
  valid_from: { key: "valid_from", label: "Valid from", example: "2026-01-01", group: "common" },
  valid_until: { key: "valid_until", label: "Valid until", example: "2026-12-31", group: "common" },
  timezone: { key: "timezone", label: "Timezone", example: "Asia/Kolkata", group: "common" },
  measurement_unit: {
    key: "measurement_unit",
    label: "Measurement unit",
    example: "cm",
    accepted: "cm | inch | mm",
    group: "common",
  },
  fixture_width: { key: "fixture_width", label: "Fixture width", example: "120", group: "common" },
  fixture_height: { key: "fixture_height", label: "Fixture height", example: "180", group: "common" },
  shelf_id: { key: "shelf_id", label: "Shelf ID", example: "SH-1", group: "common" },
  shelf_name: { key: "shelf_name", label: "Shelf name", example: "Eye Level", group: "common" },
  shelf_number: { key: "shelf_number", label: "Shelf number", example: "3", group: "common" },
  shelf_width: { key: "shelf_width", label: "Shelf width", example: "120", group: "common" },
  shelf_height: { key: "shelf_height", label: "Shelf height", example: "30", group: "common" },
  shelf_depth: { key: "shelf_depth", label: "Shelf depth", example: "40", group: "common" },
  sku: { key: "sku", label: "SKU", required: true, example: "COLG-TP-100", group: "product" },
  brand: { key: "brand", label: "Brand", required: true, example: "Colgate", group: "product" },
  product_name: {
    key: "product_name",
    label: "Product name",
    required: true,
    example: "Total Toothpaste",
    group: "product",
  },
  variant: { key: "variant", label: "Variant", example: "100g", group: "product" },
  barcode: { key: "barcode", label: "Barcode", example: "8901030865585", group: "product" },
  product_width: { key: "product_width", label: "Product width", example: "4.5", group: "product" },
  product_height: { key: "product_height", label: "Product height", example: "18", group: "product" },
  product_depth: { key: "product_depth", label: "Product depth", example: "3.2", group: "product" },
  required_product: {
    key: "required_product",
    label: "Required product",
    example: "yes",
    accepted: "yes | no",
    group: "product",
  },
  requirement_type: {
    key: "requirement_type",
    label: "Requirement type",
    example: "mandatory_assortment",
    accepted: "mandatory_assortment | msl | optional",
    group: "product",
  },
  approved_substitute: {
    key: "approved_substitute",
    label: "Approved substitute SKU",
    example: "",
    group: "product",
  },
  position_id: {
    key: "position_id",
    label: "Position ID",
    required: true,
    example: "POS-A1-03",
    group: "layout",
  },
  expected_sku: {
    key: "expected_sku",
    label: "Expected SKU at position",
    example: "COLG-TP-100",
    group: "layout",
  },
  expected_horizontal_facings: {
    key: "expected_horizontal_facings",
    label: "Horizontal facings",
    example: "2",
    group: "layout",
  },
  expected_vertical_facings: {
    key: "expected_vertical_facings",
    label: "Vertical facings",
    example: "1",
    group: "layout",
  },
  expected_total_facings: {
    key: "expected_total_facings",
    label: "Total facings",
    required: true,
    example: "4",
    group: "layout",
  },
  min_facings: { key: "min_facings", label: "Min facings", example: "2", group: "layout" },
  max_facings: { key: "max_facings", label: "Max facings", example: "6", group: "layout" },
  expected_orientation: { key: "expected_orientation", label: "Orientation", example: "front", group: "layout" },
  position_tolerance: { key: "position_tolerance", label: "Position tolerance", example: "1", group: "layout" },
  facing_tolerance: { key: "facing_tolerance", label: "Facing tolerance", example: "1", group: "layout" },
  shelf_position: { key: "shelf_position", label: "Shelf position label", example: "3", group: "layout" },
  location: { key: "location", label: "Location / bay code", example: "A-1-Z", group: "layout" },
  price_required: {
    key: "price_required",
    label: "Price required",
    example: "yes",
    accepted: "yes | no",
    group: "price",
  },
  expected_price: { key: "expected_price", label: "Expected price", example: "99", group: "price" },
  currency: {
    key: "currency",
    label: "Currency",
    example: "INR",
    accepted: "INR | USD | EUR | GBP",
    group: "price",
  },
  price_basis: { key: "price_basis", label: "Price basis", example: "item", group: "price" },
  price_label_location: {
    key: "price_label_location",
    label: "Price label location",
    example: "shelf_tag",
    group: "price",
  },
  price_valid_from: { key: "price_valid_from", label: "Price valid from", example: "2026-01-01", group: "price" },
  price_valid_until: { key: "price_valid_until", label: "Price valid until", example: "2026-12-31", group: "price" },
  promotion_id: { key: "promotion_id", label: "Promotion ID", example: "PROMO-JAN", group: "promotion" },
  promotion_name: { key: "promotion_name", label: "Promotion name", example: "Buy 2 Save 10%", group: "promotion" },
  participating_skus: {
    key: "participating_skus",
    label: "Participating SKUs",
    example: "COLG-TP-100",
    group: "promotion",
  },
  promotion_start: { key: "promotion_start", label: "Promotion start", example: "2026-01-01", group: "promotion" },
  promotion_end: { key: "promotion_end", label: "Promotion end", example: "2026-01-31", group: "promotion" },
  required_location: {
    key: "required_location",
    label: "Required promo location",
    example: "end_cap",
    group: "promotion",
  },
  offer_text: { key: "offer_text", label: "Offer text", example: "Save 10%", group: "promotion" },
  promotional_price: { key: "promotional_price", label: "Promotional price", example: "89", group: "promotion" },
  required_facings: { key: "required_facings", label: "Required promo facings", example: "2", group: "promotion" },
  required_signage: {
    key: "required_signage",
    label: "Required signage",
    example: "yes",
    accepted: "yes | no",
    group: "promotion",
  },
  osa_target: { key: "osa_target", label: "OSA target %", required: true, example: "95", group: "targets" },
  location_accuracy_target: {
    key: "location_accuracy_target",
    label: "Location accuracy target %",
    required: true,
    example: "90",
    group: "targets",
  },
  planogram_target: {
    key: "planogram_target",
    label: "Planogram compliance target %",
    required: true,
    example: "85",
    group: "targets",
  },
  assortment_target: {
    key: "assortment_target",
    label: "Assortment compliance target %",
    required: true,
    example: "90",
    group: "targets",
  },
  price_target: {
    key: "price_target",
    label: "Price compliance target %",
    required: true,
    example: "95",
    group: "targets",
  },
  promotion_target: {
    key: "promotion_target",
    label: "Promotion compliance target %",
    required: true,
    example: "80",
    group: "targets",
  },
  facing_target: {
    key: "facing_target",
    label: "Facing count target %",
    required: true,
    example: "90",
    group: "targets",
  },
  share_of_shelf_target: {
    key: "share_of_shelf_target",
    label: "Share of shelf target %",
    required: true,
    example: "40",
    group: "targets",
  },
  msl_target: {
    key: "msl_target",
    label: "MSL compliance target %",
    required: true,
    example: "95",
    group: "targets",
  },
  store_format: { key: "store_format", label: "Store format", example: "kirana", group: "role" },
  local_category_focus: {
    key: "local_category_focus",
    label: "Local category focus",
    example: "FMCG",
    group: "role",
  },
  aisle: { key: "aisle", label: "Aisle", example: "A12", group: "role" },
  rack: { key: "rack", label: "Rack", example: "R3", group: "role" },
  bay: { key: "bay", label: "Bay", example: "B2", group: "role" },
  bin: { key: "bin", label: "Bin", example: "BIN-44", group: "role" },
  pick_location: { key: "pick_location", label: "Pick location", example: "A12-R3-B2", group: "role" },
  location_barcode: { key: "location_barcode", label: "Location barcode", example: "LOC123456", group: "role" },
  target_brand: {
    key: "target_brand",
    label: "Target brand",
    required: true,
    example: "Colgate",
    group: "role",
  },
  competitor_brand: { key: "competitor_brand", label: "Competitor brand", example: "Pepsodent", group: "role" },
  target_share_of_shelf: {
    key: "target_share_of_shelf",
    label: "Target share of shelf %",
    example: "35",
    group: "role",
  },
  category_scope: { key: "category_scope", label: "Category scope", example: "Oral Care", group: "role" },
  linear_shelf_measurement_enabled: {
    key: "linear_shelf_measurement_enabled",
    label: "Linear shelf measurement",
    example: "yes",
    accepted: "yes | no",
    group: "role",
  },
  distributor_name: {
    key: "distributor_name",
    label: "Distributor name",
    required: true,
    example: "ABC Distribution",
    group: "role",
  },
  distributor_portfolio: {
    key: "distributor_portfolio",
    label: "Portfolio",
    example: "FMCG Oral Care",
    group: "role",
  },
  outlet_id: { key: "outlet_id", label: "Outlet ID", example: "OUT-102", group: "role" },
  outlet_name: { key: "outlet_name", label: "Outlet name", example: "City Mart", group: "role" },
  territory: { key: "territory", label: "Territory", example: "North Zone", group: "role" },
  sales_rep: { key: "sales_rep", label: "Sales rep", example: "Ravi Kumar", group: "role" },
  msl_required: {
    key: "msl_required",
    label: "MSL required",
    example: "yes",
    accepted: "yes | no",
    group: "role",
  },
};

/** Maps each KPI to its audit-target column in the master CSV. */
export const KPI_TARGET_COLUMN: Record<AuditKpiId, string> = {
  osa: "osa_target",
  planogram_compliance: "planogram_target",
  assortment_compliance: "assortment_target",
  price_compliance: "price_target",
  promotional_compliance: "promotion_target",
  location_accuracy: "location_accuracy_target",
  facing_count: "facing_target",
  share_of_shelf: "share_of_shelf_target",
  msl_compliance: "msl_target",
};

const CORE_SETUP_KEYS = [
  "row_type",
  "audit_role",
  "planogram_name",
  "store_id",
  "store_name",
  "outlet_scope",
  "fixture_id",
  "fixture_name",
  "fixture_type",
  "category",
  "sub_category",
  "valid_from",
  "valid_until",
  "timezone",
  "measurement_unit",
  "fixture_width",
  "fixture_height",
  "shelf_id",
  "shelf_name",
  "shelf_number",
  "shelf_width",
  "shelf_height",
  "shelf_depth",
] as const;

const PRODUCT_KEYS = [
  "sku",
  "brand",
  "product_name",
  "variant",
  "barcode",
  "product_width",
  "product_height",
  "product_depth",
  "required_product",
  "requirement_type",
  "approved_substitute",
] as const;

const LAYOUT_KEYS = [
  "position_id",
  "expected_sku",
  "expected_horizontal_facings",
  "expected_vertical_facings",
  "expected_total_facings",
  "min_facings",
  "max_facings",
  "expected_orientation",
  "position_tolerance",
  "facing_tolerance",
  "shelf_position",
  "location",
] as const;

const PRICE_KEYS = [
  "price_required",
  "expected_price",
  "currency",
  "price_basis",
  "price_label_location",
  "price_valid_from",
  "price_valid_until",
] as const;

const PROMO_KEYS = [
  "promotion_id",
  "promotion_name",
  "participating_skus",
  "promotion_start",
  "promotion_end",
  "required_location",
  "offer_text",
  "promotional_price",
  "required_facings",
  "required_signage",
] as const;

export function masterTargetColumnKeys(role: AuditRoleTab): string[] {
  return primaryKpiIds(role).map((kpi) => KPI_TARGET_COLUMN[kpi]);
}

function keysForRole(role: AuditRoleTab): string[] {
  const keys: string[] = [
    ...CORE_SETUP_KEYS,
    ...PRODUCT_KEYS,
    ...LAYOUT_KEYS,
  ];

  switch (role) {
    case "supermarket":
      keys.push(...PRICE_KEYS, ...PROMO_KEYS, ...masterTargetColumnKeys(role));
      break;
    case "local":
      keys.push(
        ...PRICE_KEYS,
        ...PROMO_KEYS,
        "store_format",
        "local_category_focus",
        ...masterTargetColumnKeys(role),
      );
      break;
    case "darkstore":
      keys.push(
        "aisle",
        "rack",
        "bay",
        "bin",
        "pick_location",
        "location_barcode",
        ...masterTargetColumnKeys(role),
      );
      break;
    case "fmcg":
      keys.push(
        "target_brand",
        "competitor_brand",
        "target_share_of_shelf",
        "category_scope",
        "linear_shelf_measurement_enabled",
        ...PROMO_KEYS,
        ...masterTargetColumnKeys(role),
      );
      break;
    case "distributor":
      keys.push(
        "distributor_name",
        "distributor_portfolio",
        "outlet_id",
        "outlet_name",
        "territory",
        "sales_rep",
        "msl_required",
        ...PRICE_KEYS,
        ...PROMO_KEYS,
        ...masterTargetColumnKeys(role),
      );
      break;
    default:
      break;
  }

  return keys;
}

export const MASTER_TEMPLATE_FILENAMES: Record<AuditRoleTab, string> = {
  supermarket: "Aislix_Supermarket_Master_Setup.csv",
  darkstore: "Aislix_Dark_Store_Master_Setup.csv",
  fmcg: "Aislix_FMCG_Brand_Master_Setup.csv",
  distributor: "Aislix_Distributor_Master_Setup.csv",
  local: "Aislix_Local_Store_Master_Setup.csv",
};

export const MASTER_FIELD_GUIDE_FILENAMES: Record<AuditRoleTab, string> = {
  supermarket: "Aislix_Supermarket_Master_Setup_FieldGuide.csv",
  darkstore: "Aislix_Dark_Store_Master_Setup_FieldGuide.csv",
  fmcg: "Aislix_FMCG_Brand_Master_Setup_FieldGuide.csv",
  distributor: "Aislix_Distributor_Master_Setup_FieldGuide.csv",
  local: "Aislix_Local_Store_Master_Setup_FieldGuide.csv",
};

export function masterFieldsForRole(role: AuditRoleTab): MasterFieldDef[] {
  return keysForRole(role).map((key) => {
    const field = FIELD_REGISTRY[key];
    if (!field) throw new Error(`Missing master field definition: ${key}`);
    return { ...field, example: field.example ?? "" };
  });
}

export function masterRequiredColumns(role: AuditRoleTab): string[] {
  return masterFieldsForRole(role)
    .filter((field) => field.required)
    .map((field) => field.key);
}

export function masterColumnKeys(role: AuditRoleTab): string[] {
  return keysForRole(role);
}
