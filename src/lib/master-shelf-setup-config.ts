/**
 * Role-specific Master Shelf Setup CSV schema — templates, columns, filenames.
 */

import type { AuditRoleTab } from "@/lib/role-audit-ui";

export type MasterFieldDef = {
  key: string;
  label: string;
  required?: boolean;
  example?: string;
  accepted?: string;
  group: "common" | "product" | "layout" | "price" | "promotion" | "targets" | "role";
};

const COMMON_SETUP: MasterFieldDef[] = [
  { key: "row_type", label: "Row type", example: "data", accepted: "data, example (example rows are ignored)", group: "common" },
  { key: "audit_role", label: "Audit role", required: true, example: "supermarket", group: "common" },
  { key: "planogram_name", label: "Planogram name", required: true, example: "Oral Care Main Gondola", group: "common" },
  { key: "store_id", label: "Store ID", example: "STR-001", group: "common" },
  { key: "store_name", label: "Store / outlet name", required: true, example: "Downtown Supermarket", group: "common" },
  { key: "outlet_scope", label: "Outlet scope", example: "all", group: "common" },
  { key: "fixture_id", label: "Fixture ID", example: "GON-A1", group: "common" },
  { key: "fixture_name", label: "Fixture name", example: "Main Gondola", group: "common" },
  { key: "fixture_type", label: "Fixture type", example: "gondola", group: "common" },
  { key: "category", label: "Category", required: true, example: "Personal Care", group: "common" },
  { key: "sub_category", label: "Sub-category", example: "Oral Care", group: "common" },
  { key: "valid_from", label: "Valid from", example: "2026-01-01", group: "common" },
  { key: "valid_until", label: "Valid until", example: "2026-12-31", group: "common" },
  { key: "timezone", label: "Timezone", example: "Asia/Kolkata", group: "common" },
  { key: "measurement_unit", label: "Measurement unit", example: "cm", accepted: "cm, inch, mm", group: "common" },
  { key: "fixture_width", label: "Fixture width", example: "120", group: "common" },
  { key: "fixture_height", label: "Fixture height", example: "180", group: "common" },
  { key: "shelf_id", label: "Shelf ID", example: "SH-1", group: "common" },
  { key: "shelf_name", label: "Shelf name", example: "Eye Level", group: "common" },
  { key: "shelf_number", label: "Shelf number", example: "3", group: "common" },
  { key: "shelf_width", label: "Shelf width", example: "120", group: "common" },
  { key: "shelf_height", label: "Shelf height", example: "30", group: "common" },
  { key: "shelf_depth", label: "Shelf depth", example: "40", group: "common" },
];

const PRODUCT_FIELDS: MasterFieldDef[] = [
  { key: "sku", label: "SKU", required: true, example: "COLG-TP-100", group: "product" },
  { key: "brand", label: "Brand", required: true, example: "Colgate", group: "product" },
  { key: "product_name", label: "Product name", required: true, example: "Total Toothpaste", group: "product" },
  { key: "variant", label: "Variant", example: "100g", group: "product" },
  { key: "barcode", label: "Barcode", example: "8901030865585", group: "product" },
  { key: "product_width", label: "Product width", example: "4.5", group: "product" },
  { key: "product_height", label: "Product height", example: "18", group: "product" },
  { key: "product_depth", label: "Product depth", example: "3.2", group: "product" },
  { key: "required_product", label: "Required product", example: "yes", accepted: "yes, no", group: "product" },
  { key: "requirement_type", label: "Requirement type", example: "mandatory_assortment", accepted: "mandatory_assortment, msl, optional", group: "product" },
  { key: "approved_substitute", label: "Approved substitute SKU", example: "", group: "product" },
];

const LAYOUT_FIELDS: MasterFieldDef[] = [
  { key: "position_id", label: "Position ID", required: true, example: "POS-A1-03", group: "layout" },
  { key: "expected_sku", label: "Expected SKU at position", example: "COLG-TP-100", group: "layout" },
  { key: "expected_horizontal_facings", label: "Horizontal facings", example: "2", group: "layout" },
  { key: "expected_vertical_facings", label: "Vertical facings", example: "1", group: "layout" },
  { key: "expected_total_facings", label: "Total facings", required: true, example: "4", group: "layout" },
  { key: "min_facings", label: "Min facings", example: "2", group: "layout" },
  { key: "max_facings", label: "Max facings", example: "6", group: "layout" },
  { key: "expected_orientation", label: "Orientation", example: "front", group: "layout" },
  { key: "position_tolerance", label: "Position tolerance", example: "1", group: "layout" },
  { key: "facing_tolerance", label: "Facing tolerance", example: "1", group: "layout" },
  { key: "shelf_position", label: "Shelf position label", example: "3", group: "layout" },
  { key: "location", label: "Location / bay code", example: "A-1-Z", group: "layout" },
];

const PRICE_FIELDS: MasterFieldDef[] = [
  { key: "price_required", label: "Price required", example: "yes", accepted: "yes, no", group: "price" },
  { key: "expected_price", label: "Expected price", example: "99", group: "price" },
  { key: "currency", label: "Currency", example: "INR", accepted: "INR, USD, EUR, GBP", group: "price" },
  { key: "price_basis", label: "Price basis", example: "item", group: "price" },
  { key: "price_label_location", label: "Price label location", example: "shelf_tag", group: "price" },
  { key: "price_valid_from", label: "Price valid from", example: "2026-01-01", group: "price" },
  { key: "price_valid_until", label: "Price valid until", example: "2026-12-31", group: "price" },
];

const PROMO_FIELDS: MasterFieldDef[] = [
  { key: "promotion_id", label: "Promotion ID", example: "PROMO-JAN", group: "promotion" },
  { key: "promotion_name", label: "Promotion name", example: "Buy 2 Save 10%", group: "promotion" },
  { key: "participating_skus", label: "Participating SKUs", example: "COLG-TP-100", group: "promotion" },
  { key: "promotion_start", label: "Promotion start", example: "2026-01-01", group: "promotion" },
  { key: "promotion_end", label: "Promotion end", example: "2026-01-31", group: "promotion" },
  { key: "required_location", label: "Required promo location", example: "end_cap", group: "promotion" },
  { key: "offer_text", label: "Offer text", example: "Save 10%", group: "promotion" },
  { key: "promotional_price", label: "Promotional price", example: "89", group: "promotion" },
  { key: "required_facings", label: "Required promo facings", example: "2", group: "promotion" },
  { key: "required_signage", label: "Required signage", example: "yes", group: "promotion" },
];

const TARGET_FIELDS: MasterFieldDef[] = [
  { key: "osa_target", label: "OSA target %", example: "95", group: "targets" },
  { key: "location_accuracy_target", label: "Location accuracy target %", example: "90", group: "targets" },
  { key: "planogram_target", label: "Planogram target %", example: "85", group: "targets" },
  { key: "assortment_target", label: "Assortment target %", example: "90", group: "targets" },
  { key: "price_target", label: "Price target %", example: "95", group: "targets" },
  { key: "promotion_target", label: "Promotion target %", example: "80", group: "targets" },
  { key: "facing_target", label: "Facing target %", example: "90", group: "targets" },
  { key: "share_of_shelf_target", label: "Share of shelf target %", example: "40", group: "targets" },
  { key: "msl_target", label: "MSL target %", example: "95", group: "targets" },
];

const ROLE_FIELDS: Record<AuditRoleTab, MasterFieldDef[]> = {
  supermarket: [],
  local: [
    { key: "store_format", label: "Store format", example: "kirana", group: "role" },
    { key: "local_category_focus", label: "Local category focus", example: "FMCG", group: "role" },
  ],
  darkstore: [
    { key: "aisle", label: "Aisle", example: "A12", group: "role" },
    { key: "rack", label: "Rack", example: "R3", group: "role" },
    { key: "bay", label: "Bay", example: "B2", group: "role" },
    { key: "bin", label: "Bin", example: "BIN-44", group: "role" },
    { key: "pick_location", label: "Pick location", example: "A12-R3-B2", group: "role" },
    { key: "location_barcode", label: "Location barcode", example: "LOC123456", group: "role" },
  ],
  fmcg: [
    { key: "target_brand", label: "Target brand", required: true, example: "Colgate", group: "role" },
    { key: "competitor_brand", label: "Competitor brand", example: "Pepsodent", group: "role" },
    { key: "target_share_of_shelf", label: "Target share of shelf %", example: "35", group: "role" },
    { key: "category_scope", label: "Category scope", example: "Oral Care", group: "role" },
    { key: "linear_shelf_measurement_enabled", label: "Linear shelf measurement", example: "yes", accepted: "yes, no", group: "role" },
  ],
  distributor: [
    { key: "distributor_name", label: "Distributor name", required: true, example: "ABC Distribution", group: "role" },
    { key: "distributor_portfolio", label: "Portfolio", example: "FMCG Oral Care", group: "role" },
    { key: "outlet_id", label: "Outlet ID", example: "OUT-102", group: "role" },
    { key: "outlet_name", label: "Outlet name", example: "City Mart", group: "role" },
    { key: "territory", label: "Territory", example: "North Zone", group: "role" },
    { key: "sales_rep", label: "Sales rep", example: "Ravi Kumar", group: "role" },
    { key: "msl_required", label: "MSL required", example: "yes", accepted: "yes, no", group: "role" },
  ],
};

export const MASTER_TEMPLATE_FILENAMES: Record<AuditRoleTab, string> = {
  supermarket: "Aislix_Supermarket_Master_Setup.csv",
  darkstore: "Aislix_Dark_Store_Master_Setup.csv",
  fmcg: "Aislix_FMCG_Brand_Master_Setup.csv",
  distributor: "Aislix_Distributor_Master_Setup.csv",
  local: "Aislix_Local_Store_Master_Setup.csv",
};

export function masterFieldsForRole(role: AuditRoleTab): MasterFieldDef[] {
  return [
    ...COMMON_SETUP,
    ...PRODUCT_FIELDS,
    ...LAYOUT_FIELDS,
    ...PRICE_FIELDS,
    ...PROMO_FIELDS,
    ...TARGET_FIELDS,
    ...ROLE_FIELDS[role],
  ];
}

export function masterRequiredColumns(role: AuditRoleTab): string[] {
  return masterFieldsForRole(role)
    .filter((field) => field.required)
    .map((field) => field.key);
}

export function masterColumnKeys(role: AuditRoleTab): string[] {
  return masterFieldsForRole(role).map((field) => field.key);
}
