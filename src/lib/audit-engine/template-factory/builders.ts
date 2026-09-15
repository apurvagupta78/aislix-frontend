import type { AuditPurpose, AuditSubjectType, OperatingModel } from "@/lib/audit-builder/types";
import {
  assembleTemplate,
  baseAi,
  baseEvidence,
  baseWorkflow,
  expiryRules,
  field,
  planogramFailRules,
  qcFailRules,
  resetFieldCounter,
  sec,
  varianceRules,
} from "./helpers";

function storeField(section: string, order: number, model: OperatingModel) {
  if (model === "dark_store") return field(section, order, "store", "Dark Store", { required: true, key: "dark_store" });
  if (model === "warehouse") return field(section, order, "warehouse", "Warehouse", { required: true });
  return field(section, order, "store", "Store", { required: true });
}

export function buildStoreVisit(model: OperatingModel = "local_store") {
  resetFieldCounter();
  const s = "visit";
  return assembleTemplate({
    sections: [sec(s, "Store Visit", 0)],
    fields: [
      storeField(s, 0, model),
      field(s, 1, "auditor", "Auditor", { required: true }),
      field(s, 2, "audit_date", "Date", { required: true }),
      field(s, 3, "gps", "GPS", { required: true, standardConcept: "gps" }),
      field(s, 4, "pass_fail", "Store Condition"),
      field(s, 5, "pass_fail", "Store Cleanliness"),
      field(s, 6, "yes_no", "Staff Available"),
      field(s, 7, "dropdown", "Opening/Closing Status", { config: { options: ["Open", "Closed", "Partial"] } }),
      field(s, 8, "number", "OOS Count", { config: { min: 0 } }),
      field(s, 9, "pass_fail", "Pricing Compliance"),
      field(s, 10, "pass_fail", "Shelf Execution"),
      field(s, 11, "pass_fail", "Promotional Execution"),
      field(s, 12, "multiple_images", "Images", { required: true }),
      field(s, 13, "notes", "Notes"),
      field(s, 14, "quality_score", "Score"),
    ],
    workflow: baseWorkflow(false),
    scoring: { enabled: true, passThreshold: 70 },
    evidence: baseEvidence(),
    auditLevel: "one_per_audit",
    operatingModel: model,
    purpose: "outlet_visit",
    subjectType: "store",
  });
}

export function buildInventoryAudit(model: OperatingModel, purpose: AuditPurpose = "inventory", subject: AuditSubjectType = "sku") {
  resetFieldCounter();
  const s = "inventory";
  return assembleTemplate({
    sections: [sec(s, "Inventory Line", 0, { repeatable: true, repeatBy: subject })],
    fields: [
      storeField(s, 0, model),
      field(s, 1, "sku_id", "SKU", { required: true }),
      field(s, 2, "item_code", "Item Code"),
      field(s, 3, "item_name", "Product Name"),
      field(s, 4, "category", "Category"),
      field(s, 5, "expected_qty", "Expected Qty", { required: true, standardConcept: "expected_quantity" }),
      field(s, 6, "actual_qty", "Actual Qty", { required: true, standardConcept: "actual_quantity" }),
      field(s, 7, "qty_variance", "Variance", { calculated: true, standardConcept: "variance_units" }),
      field(s, 8, "qty_variance_pct", "Variance %", { calculated: true, standardConcept: "variance_percent" }),
      field(s, 9, "currency", "MRP", { standardConcept: "mrp" }),
      field(s, 10, "currency", "Potential Inventory Value Variance", { calculated: true, standardConcept: "potential_value_variance" }),
      field(s, 11, "rca", "RCA", { standardConcept: "rca" }),
      field(s, 12, "single_image", "Image"),
      field(s, 13, "notes", "Notes"),
    ],
    rules: varianceRules(),
    auditLevel: model === "warehouse" ? "one_per_location" : "one_per_sku",
    operatingModel: model,
    purpose,
    subjectType: subject,
  });
}

export function buildExpiryAudit(model: OperatingModel, subject: AuditSubjectType = "sku") {
  resetFieldCounter();
  const s = "expiry";
  return assembleTemplate({
    sections: [sec(s, "Expiry Check", 0, { repeatable: true, repeatBy: subject })],
    fields: [
      storeField(s, 0, model),
      field(s, 1, "sku_id", "SKU", { required: true }),
      field(s, 2, "item_name", "Product"),
      field(s, 3, "batch_number", "Batch"),
      field(s, 4, "actual_qty", "Physical Qty", { required: true, key: "physical_qty", standardConcept: "physical_quantity", quantityLinked: true }),
      field(s, 5, "mfg_date", "MFG Date"),
      field(s, 6, "expiry_date", "Expiry Date", { required: true, standardConcept: "expiry_date" }),
      field(s, 7, "expiry_days_remaining", "Days Remaining", { calculated: true, standardConcept: "days_remaining" }),
      field(s, 8, "dropdown", "Expiry Status", { key: "expiry_status", config: { options: ["Expired", "Critical", "Near Expiry", "Safe"] }, standardConcept: "expiry_status" }),
      field(s, 9, "number", "Expiry Coverage", { required: true, key: "expiry_coverage" }),
      field(s, 10, "multiple_images", "Images", { required: true, config: { minImages: 1, cameraRequired: true, duplicateDetection: true } }),
      field(s, 11, "rca", "RCA"),
      field(s, 12, "notes", "Notes"),
    ],
    rules: expiryRules(),
    ai: baseAi({ expiryOcr: true }),
    evidence: baseEvidence(true),
    auditLevel: subject === "unit" ? "repeating_section" : "one_per_sku",
    operatingModel: model,
    purpose: "expiry",
    subjectType: subject,
  });
}

export function buildFnvQcAudit(model: OperatingModel) {
  resetFieldCounter();
  const s = "qc";
  return assembleTemplate({
    sections: [sec(s, "QC Check", 0, { repeatable: true, repeatBy: "sku" })],
    fields: [
      storeField(s, 0, model),
      field(s, 1, "sku_id", "SKU", { required: true }),
      field(s, 2, "batch_number", "Batch"),
      field(s, 3, "item_name", "Product"),
      field(s, 4, "actual_qty", "Physical Qty", { required: true }),
      field(s, 5, "qc_status", "QC Status", { required: true, config: { options: ["Pass", "Fail", "Conditional", "Needs Review"] } }),
      field(s, 6, "pass_fail", "Packaging Condition"),
      field(s, 7, "pass_fail", "Product Condition"),
      field(s, 8, "defect_type", "Defect Type"),
      field(s, 9, "defect_severity", "Severity", { config: { options: ["Low", "Medium", "High", "Critical"] } }),
      field(s, 10, "multiple_images", "Images", { required: true, key: "images" }),
      field(s, 11, "rca", "RCA"),
      field(s, 12, "notes", "Notes"),
      field(s, 13, "quality_score", "Score"),
    ],
    rules: qcFailRules(),
    scoring: { enabled: true, passThreshold: 80 },
    auditLevel: "one_per_sku",
    operatingModel: model,
    purpose: "fnv_qc",
    subjectType: "sku",
  });
}

export function buildPriceAudit(model: OperatingModel) {
  resetFieldCounter();
  const s = "pricing";
  return assembleTemplate({
    sections: [sec(s, "Price Check", 0, { repeatable: true, repeatBy: "sku" })],
    fields: [
      storeField(s, 0, model),
      field(s, 1, "sku_id", "SKU", { required: true }),
      field(s, 2, "item_name", "Product"),
      field(s, 3, "currency", "MRP", { required: true, standardConcept: "mrp" }),
      field(s, 4, "currency", "Expected Selling Price"),
      field(s, 5, "currency", "Displayed Price", { required: true }),
      field(s, 6, "currency", "Promotion Price"),
      field(s, 7, "pass_fail", "Price Compliance", { standardConcept: "price_compliance" }),
      field(s, 8, "single_image", "Evidence", { required: true }),
      field(s, 9, "notes", "Notes"),
    ],
    rules: [
      {
        id: "rule-price",
        label: "Price compliance issue",
        when: { field: "price_compliance", operator: "eq", value: "Fail" },
        then: [{ action: "create_finding", findingType: "Pricing Issue", severity: "medium" }],
      },
    ],
    auditLevel: "one_per_sku",
    operatingModel: model,
    purpose: "pricing",
    subjectType: "sku",
  });
}

export function buildShelfAudit(model: OperatingModel) {
  resetFieldCounter();
  const s = "shelf";
  return assembleTemplate({
    sections: [sec(s, "Shelf Check", 0, { repeatable: true, repeatBy: "shelf" })],
    fields: [
      storeField(s, 0, model),
      field(s, 1, "shelf", "Shelf", { required: true }),
      field(s, 2, "sku_id", "SKU", { required: true }),
      field(s, 3, "yes_no", "Expected Presence"),
      field(s, 4, "yes_no", "Actual Presence"),
      field(s, 5, "number", "Expected Facing", { standardConcept: "expected_facing" }),
      field(s, 6, "number", "Actual Facing", { standardConcept: "actual_facing" }),
      field(s, 7, "yes_no", "OOS", { standardConcept: "oos" }),
      field(s, 8, "dropdown", "Shelf Position"),
      field(s, 9, "pass_fail", "Product Placement"),
      field(s, 10, "single_image", "Image", { required: true }),
      field(s, 11, "finding_type", "Finding"),
    ],
    ai: baseAi({ skuDetect: true }),
    auditLevel: "one_per_shelf",
    operatingModel: model,
    purpose: "shelf",
    subjectType: "shelf",
  });
}

/** Combined planogram + shelf execution (supermarket flagship). */
export function buildSupermarketPlanogramShelf() {
  resetFieldCounter();
  const shelf = "shelf_execution";
  const plano = "planogram";
  return assembleTemplate({
    sections: [
      sec(shelf, "Shelf Execution", 0, { repeatable: true, repeatBy: "shelf" }),
      sec(plano, "Planogram Check", 1, { repeatable: true, repeatBy: "shelf" }),
    ],
    fields: [
      storeField(shelf, 0, "supermarket"),
      field(shelf, 1, "short_text", "Department"),
      field(shelf, 2, "short_text", "Aisle"),
      field(shelf, 3, "shelf", "Shelf", { required: true }),
      field(shelf, 4, "sku_id", "SKU", { required: true }),
      field(shelf, 5, "number", "Expected Facing", { standardConcept: "expected_facing" }),
      field(shelf, 6, "number", "Actual Facing", { standardConcept: "actual_facing" }),
      field(shelf, 7, "yes_no", "OOS", { standardConcept: "oos" }),
      field(shelf, 8, "pass_fail", "Shelf Compliance"),
      field(shelf, 9, "single_image", "Shelf Image", { required: true }),
      field(plano, 0, "short_text", "Planogram Version"),
      field(plano, 1, "sku_id", "SKU", { required: true }),
      field(plano, 2, "short_text", "Expected Shelf"),
      field(plano, 3, "short_text", "Actual Shelf"),
      field(plano, 4, "pass_fail", "Planogram Compliance", {
        key: "compliance",
        standardConcept: "planogram_compliance",
      }),
      field(plano, 5, "yes_no", "Wrong SKU"),
      field(plano, 6, "yes_no", "Missing SKU"),
      field(plano, 7, "single_image", "Planogram Image", { required: true }),
    ],
    rules: planogramFailRules(),
    ai: baseAi({ planogram: true, skuDetect: true }),
    scoring: { enabled: true, passThreshold: 80 },
    auditLevel: "one_per_shelf",
    operatingModel: "supermarket",
    purpose: "planogram",
    subjectType: "shelf",
  });
}

export function buildPlanogramAudit(model: OperatingModel) {
  resetFieldCounter();
  const s = "planogram";
  return assembleTemplate({
    sections: [sec(s, "Planogram Check", 0, { repeatable: true, repeatBy: "shelf" })],
    fields: [
      storeField(s, 0, model),
      field(s, 1, "short_text", "Department"),
      field(s, 2, "short_text", "Aisle"),
      field(s, 3, "shelf", "Shelf", { required: true }),
      field(s, 4, "short_text", "Planogram Version"),
      field(s, 5, "sku_id", "SKU", { required: true }),
      field(s, 6, "short_text", "Expected Shelf"),
      field(s, 7, "short_text", "Actual Shelf"),
      field(s, 8, "number", "Expected Facing", { key: "expected_facing" }),
      field(s, 9, "number", "Actual Facing", { key: "actual_facing" }),
      field(s, 10, "pass_fail", "Compliance", { key: "compliance", standardConcept: "planogram_compliance" }),
      field(s, 11, "yes_no", "Wrong SKU"),
      field(s, 12, "yes_no", "Missing SKU"),
      field(s, 13, "yes_no", "Extra SKU"),
      field(s, 14, "single_image", "Image", { required: true }),
    ],
    rules: planogramFailRules(),
    ai: baseAi({ planogram: true }),
    scoring: { enabled: true, passThreshold: 80 },
    auditLevel: "one_per_shelf",
    operatingModel: model,
    purpose: "planogram",
    subjectType: "shelf",
  });
}

export function buildPromotionAudit(model: OperatingModel) {
  resetFieldCounter();
  const s = "promotion";
  return assembleTemplate({
    sections: [sec(s, "Promotion Check", 0, { repeatable: true, repeatBy: "sku" })],
    fields: [
      storeField(s, 0, model),
      field(s, 1, "sku_id", "SKU", { required: true }),
      field(s, 2, "short_text", "Campaign"),
      field(s, 3, "yes_no", "Expected Promotion"),
      field(s, 4, "yes_no", "Actual Promotion"),
      field(s, 5, "currency", "Price"),
      field(s, 6, "yes_no", "POSM"),
      field(s, 7, "yes_no", "Display"),
      field(s, 8, "date", "Start Date"),
      field(s, 9, "date", "End Date"),
      field(s, 10, "pass_fail", "Compliance"),
      field(s, 11, "multiple_images", "Images"),
    ],
    auditLevel: "one_per_sku",
    operatingModel: model,
    purpose: "promotion",
    subjectType: "sku",
  });
}

export function buildPosmAudit(model: OperatingModel) {
  resetFieldCounter();
  const s = "posm";
  return assembleTemplate({
    sections: [sec(s, "POSM / Visibility", 0, { repeatable: true, repeatBy: "store" })],
    fields: [
      storeField(s, 0, model),
      field(s, 1, "brand", "Brand"),
      field(s, 2, "dropdown", "POSM Type"),
      field(s, 3, "yes_no", "POSM Present"),
      field(s, 4, "pass_fail", "POSM Condition"),
      field(s, 5, "pass_fail", "POSM Correct"),
      field(s, 6, "yes_no", "Brand Visibility"),
      field(s, 7, "yes_no", "Secondary Display"),
      field(s, 8, "single_image", "Image", { required: true }),
    ],
    auditLevel: "one_per_audit",
    operatingModel: model,
    purpose: "posm",
    subjectType: "store",
  });
}

export function buildOpeningClosingAudit(model: OperatingModel, purpose: AuditPurpose) {
  resetFieldCounter();
  const s = "store_ops";
  return assembleTemplate({
    sections: [sec(s, purpose === "custom" ? "Store Operations" : "Store Check", 0)],
    fields: [
      storeField(s, 0, model),
      field(s, 1, "auditor", "Auditor", { required: true }),
      field(s, 2, "audit_date", "Date", { required: true }),
      field(s, 3, "pass_fail", "Store Ready"),
      field(s, 4, "pass_fail", "Cleanliness"),
      field(s, 5, "pass_fail", "Safety Check"),
      field(s, 6, "pass_fail", "Equipment Check"),
      field(s, 7, "multiple_images", "Images"),
      field(s, 8, "notes", "Notes"),
    ],
    workflow: baseWorkflow(false),
    auditLevel: "one_per_audit",
    operatingModel: model,
    purpose,
    subjectType: "store",
  });
}

export function buildCompetitorAudit(model: OperatingModel) {
  resetFieldCounter();
  const s = "competitor";
  return assembleTemplate({
    sections: [sec(s, "Competitor Check", 0, { repeatable: true, repeatBy: "sku" })],
    fields: [
      storeField(s, 0, model),
      field(s, 1, "short_text", "Competitor"),
      field(s, 2, "item_name", "Product"),
      field(s, 3, "brand", "Competitor Brand"),
      field(s, 4, "currency", "Competitor Price"),
      field(s, 5, "short_text", "Pack Size"),
      field(s, 6, "yes_no", "Availability"),
      field(s, 7, "yes_no", "Display"),
      field(s, 8, "yes_no", "Promotion"),
      field(s, 9, "multiple_images", "Images"),
      field(s, 10, "notes", "Notes"),
    ],
    auditLevel: "one_per_sku",
    operatingModel: model,
    purpose: "competitor",
    subjectType: "sku",
  });
}

export function buildDarkStoreLocationAudit() {
  resetFieldCounter();
  const s = "location";
  return assembleTemplate({
    sections: [sec(s, "Location Check", 0, { repeatable: true, repeatBy: "bin" })],
    fields: [
      field(s, 0, "store", "Dark Store", { required: true, key: "dark_store" }),
      field(s, 1, "short_text", "Zone"),
      field(s, 2, "shelf", "Shelf/Pick Face"),
      field(s, 3, "short_text", "Location Code"),
      field(s, 4, "sku_id", "SKU", { required: true }),
      field(s, 5, "expected_qty", "Expected Qty"),
      field(s, 6, "actual_qty", "Actual Qty"),
      field(s, 7, "pass_fail", "Location Compliance"),
      field(s, 8, "single_image", "Image"),
    ],
    auditLevel: "one_per_location",
    operatingModel: "dark_store",
    purpose: "shelf",
    subjectType: "bin",
  });
}

export function buildDarkStoreInventoryExpiry() {
  resetFieldCounter();
  const inv = "inventory";
  const exp = "expiry";
  return assembleTemplate({
    sections: [
      sec(inv, "Inventory Check", 0, { repeatable: true, repeatBy: "sku" }),
      sec(exp, "Expiry Verification", 1, { repeatable: true, repeatBy: "unit" }),
    ],
    fields: [
      field(inv, 0, "store", "Dark Store", { required: true, key: "dark_store" }),
      field(inv, 1, "short_text", "Zone"),
      field(inv, 2, "shelf", "Shelf/Pick Face"),
      field(inv, 3, "sku_id", "SKU", { required: true }),
      field(inv, 4, "expected_qty", "Expected Qty", { required: true }),
      field(inv, 5, "actual_qty", "Actual Qty", { required: true }),
      field(inv, 6, "qty_variance", "Variance", { calculated: true }),
      field(exp, 0, "sku_id", "SKU", { required: true }),
      field(exp, 1, "batch_number", "Batch"),
      field(exp, 2, "actual_qty", "Physical Qty", { required: true, key: "physical_qty", quantityLinked: true }),
      field(exp, 3, "expiry_date", "Expiry Date", { required: true }),
      field(exp, 4, "number", "Expiry Coverage", { required: true, key: "expiry_coverage" }),
      field(exp, 5, "multiple_images", "Unit Images", { required: true, config: { minImages: 1, duplicateDetection: true } }),
      field(exp, 6, "rca", "RCA"),
    ],
    rules: [...varianceRules(), ...expiryRules()],
    ai: baseAi({ expiryOcr: true }),
    evidence: baseEvidence(true),
    auditLevel: "one_per_sku",
    operatingModel: "dark_store",
    purpose: "expiry",
    subjectType: "unit",
  });
}

export function buildWarehouseReceivingQc(model: OperatingModel = "warehouse") {
  resetFieldCounter();
  const s = "receiving";
  const locationField =
    model === "dark_store"
      ? field(s, 0, "store", "Dark Store", { required: true, key: "dark_store" })
      : field(s, 0, "warehouse", "Warehouse", { required: true });
  return assembleTemplate({
    sections: [sec(s, "Receiving Line", 0, { repeatable: true, repeatBy: "shipment" })],
    fields: [
      locationField,
      field(s, 1, "short_text", "Dock"),
      field(s, 2, "short_text", "PO Number"),
      field(s, 3, "short_text", "ASN"),
      field(s, 4, "short_text", "Shipment"),
      field(s, 5, "short_text", "Supplier"),
      field(s, 6, "sku_id", "SKU", { required: true }),
      field(s, 7, "expected_qty", "Expected Qty", { required: true }),
      field(s, 8, "actual_qty", "Received Qty", { required: true }),
      field(s, 9, "actual_qty", "Accepted Qty"),
      field(s, 10, "actual_qty", "Rejected Qty"),
      field(s, 11, "damaged_qty", "Damaged Qty"),
      field(s, 12, "qty_variance", "Variance", { calculated: true }),
      field(s, 13, "batch_number", "Batch"),
      field(s, 14, "expiry_date", "Expiry"),
      field(s, 15, "multiple_images", "Images", { required: true }),
      field(s, 16, "rca", "RCA"),
    ],
    rules: varianceRules(),
    auditLevel: "repeating_section",
    operatingModel: model,
    purpose: "receiving",
    subjectType: "shipment",
  });
}

export function buildWarehouseBinAudit() {
  resetFieldCounter();
  const s = "bin";
  return assembleTemplate({
    sections: [sec(s, "Bin Audit", 0, { repeatable: true, repeatBy: "bin" })],
    fields: [
      field(s, 0, "warehouse", "Warehouse", { required: true }),
      field(s, 1, "short_text", "Zone"),
      field(s, 2, "short_text", "Aisle"),
      field(s, 3, "rack", "Rack"),
      field(s, 4, "bin", "Bin", { required: true }),
      field(s, 5, "sku_id", "SKU", { required: true }),
      field(s, 6, "expected_qty", "Expected Qty", { required: true }),
      field(s, 7, "actual_qty", "Actual Qty", { required: true }),
      field(s, 8, "qty_variance", "Variance", { calculated: true }),
      field(s, 9, "batch_number", "Batch"),
      field(s, 10, "single_image", "Image"),
    ],
    rules: varianceRules(),
    auditLevel: "one_per_location",
    operatingModel: "warehouse",
    purpose: "inventory",
    subjectType: "bin",
  });
}

export function buildWarehouseOpsAudit(
  purpose: AuditPurpose,
  name: string,
  model: OperatingModel = "warehouse",
) {
  resetFieldCounter();
  const s = "warehouse_ops";
  const locationField =
    model === "dark_store"
      ? field(s, 0, "store", "Dark Store", { required: true, key: "dark_store" })
      : field(s, 0, "warehouse", "Warehouse", { required: true });
  return assembleTemplate({
    sections: [sec(s, name, 0, { repeatable: true, repeatBy: "sku" })],
    fields: [
      locationField,
      field(s, 1, "short_text", "Zone"),
      field(s, 2, "sku_id", "SKU", { required: true }),
      field(s, 3, "expected_qty", "Expected Qty", { required: true }),
      field(s, 4, "actual_qty", "Actual Qty", { required: true }),
      field(s, 5, "qty_variance", "Variance", { calculated: true }),
      field(s, 6, "pass_fail", "Accuracy"),
      field(s, 7, "rca", "RCA"),
      field(s, 8, "single_image", "Image"),
    ],
    rules: varianceRules(),
    auditLevel: "one_per_sku",
    operatingModel: model,
    purpose,
    subjectType: "sku",
  });
}

export function buildFmcgOutletRetailExecution() {
  resetFieldCounter();
  const s = "outlet_execution";
  return assembleTemplate({
    sections: [sec(s, "Outlet SKU Execution", 0, { repeatable: true, repeatBy: "outlet" })],
    fields: [
      field(s, 0, "short_text", "Region", { key: "region" }),
      field(s, 1, "short_text", "Territory", { key: "territory" }),
      field(s, 2, "short_text", "Area", { key: "area" }),
      field(s, 3, "short_text", "Distributor", { key: "distributor" }),
      field(s, 4, "short_text", "Sales Representative", { key: "sales_rep" }),
      field(s, 5, "short_text", "Beat", { key: "beat" }),
      field(s, 6, "short_text", "Outlet", { required: true, key: "outlet" }),
      field(s, 7, "dropdown", "Outlet Type", { config: { allowCustomOption: true } }),
      field(s, 8, "dropdown", "Channel", { config: { allowCustomOption: true } }),
      field(s, 9, "sku_id", "SKU", { required: true }),
      field(s, 10, "item_code", "Item Code"),
      field(s, 11, "item_name", "Product Name"),
      field(s, 12, "brand", "Brand"),
      field(s, 13, "category", "Category"),
      field(s, 14, "yes_no", "Available", { standardConcept: "availability" }),
      field(s, 15, "yes_no", "OOS", { standardConcept: "oos" }),
      field(s, 16, "actual_qty", "Stock Qty"),
      field(s, 17, "number", "Expected Facing", { standardConcept: "expected_facing" }),
      field(s, 18, "number", "Actual Facing", { standardConcept: "actual_facing" }),
      field(s, 19, "yes_no", "Visibility"),
      field(s, 20, "currency", "MRP", { standardConcept: "mrp" }),
      field(s, 21, "currency", "Displayed Price"),
      field(s, 22, "currency", "Promotion Price"),
      field(s, 23, "yes_no", "Promotion Present"),
      field(s, 24, "yes_no", "Promotion Compliance"),
      field(s, 25, "yes_no", "POSM"),
      field(s, 26, "single_image", "Product Image", { config: { cameraRequired: true } }),
      field(s, 27, "single_image", "Shelf Image", { config: { cameraRequired: true } }),
      field(s, 28, "gps", "GPS", { standardConcept: "gps" }),
      field(s, 29, "finding_type", "Finding"),
      field(s, 30, "severity", "Severity"),
      field(s, 31, "rca", "RCA"),
      field(s, 32, "notes", "Notes"),
    ],
    ai: baseAi({ planogram: true, skuDetect: true }),
    scoring: { enabled: true, passThreshold: 75 },
    auditLevel: "repeating_section",
    operatingModel: "fmcg_distributor",
    purpose: "retail_execution",
    subjectType: "outlet",
  });
}

export function buildFmcgDistributorAudit() {
  resetFieldCounter();
  const info = "distributor_info";
  const inv = "inventory";
  return assembleTemplate({
    sections: [
      sec(info, "Distributor Information", 0),
      sec(inv, "Inventory", 1, { repeatable: true, repeatBy: "sku" }),
    ],
    fields: [
      field(info, 0, "short_text", "Distributor", { required: true }),
      field(info, 1, "short_text", "Distributor ID"),
      field(info, 2, "short_text", "Region"),
      field(info, 3, "short_text", "Territory"),
      field(info, 4, "short_text", "Manager"),
      field(inv, 0, "sku_id", "SKU", { required: true }),
      field(inv, 1, "expected_qty", "Expected Qty", { required: true }),
      field(inv, 2, "actual_qty", "Actual Qty", { required: true }),
      field(inv, 3, "qty_variance", "Variance", { calculated: true }),
      field(inv, 4, "currency", "Value Variance", { standardConcept: "potential_value_variance" }),
      field(inv, 5, "pass_fail", "Stock Availability"),
      field(inv, 6, "pass_fail", "Service Level"),
      field(inv, 7, "multiple_images", "Images"),
    ],
    rules: varianceRules(),
    auditLevel: "repeating_section",
    operatingModel: "fmcg_distributor",
    purpose: "distributor",
    subjectType: "distributor",
  });
}

export function buildFmcgMerchandisingAudit() {
  resetFieldCounter();
  const s = "merchandising";
  return assembleTemplate({
    sections: [sec(s, "Merchandising", 0, { repeatable: true, repeatBy: "sku" })],
    fields: [
      field(s, 0, "short_text", "Outlet", { required: true }),
      field(s, 1, "brand", "Brand"),
      field(s, 2, "category", "Category"),
      field(s, 3, "sku_id", "SKU", { required: true }),
      field(s, 4, "number", "Expected Facing"),
      field(s, 5, "number", "Actual Facing"),
      field(s, 6, "dropdown", "Shelf Position"),
      field(s, 7, "percentage", "Share of Shelf"),
      field(s, 8, "pass_fail", "Display Status"),
      field(s, 9, "yes_no", "POSM"),
      field(s, 10, "pass_fail", "Planogram"),
      field(s, 11, "multiple_images", "Images"),
    ],
    auditLevel: "one_per_sku",
    operatingModel: "fmcg_distributor",
    purpose: "merchandising",
    subjectType: "sku",
  });
}

export function buildFmcgOosAudit() {
  resetFieldCounter();
  const s = "oos";
  return assembleTemplate({
    sections: [sec(s, "OOS Check", 0, { repeatable: true, repeatBy: "sku" })],
    fields: [
      field(s, 0, "short_text", "Outlet", { required: true, key: "outlet" }),
      field(s, 1, "short_text", "Beat"),
      field(s, 2, "sku_id", "SKU", { required: true }),
      field(s, 3, "item_name", "Product"),
      field(s, 4, "yes_no", "OOS", { required: true, standardConcept: "oos" }),
      field(s, 5, "actual_qty", "Stock Qty"),
      field(s, 6, "short_text", "OOS Reason"),
      field(s, 7, "single_image", "Evidence"),
      field(s, 8, "rca", "RCA"),
    ],
    rules: [
      {
        id: "rule-oos",
        label: "OOS finding",
        when: { field: "oos", operator: "eq", value: true },
        then: [{ action: "create_finding", findingType: "Out of Stock", severity: "high" }],
      },
    ],
    auditLevel: "one_per_sku",
    operatingModel: "fmcg_distributor",
    purpose: "oos",
    subjectType: "sku",
  });
}

export function buildFmcgOutletVisit() {
  resetFieldCounter();
  const s = "visit";
  return assembleTemplate({
    sections: [sec(s, "Outlet Visit", 0)],
    fields: [
      field(s, 0, "short_text", "Outlet", { required: true }),
      field(s, 1, "short_text", "Beat"),
      field(s, 2, "short_text", "Sales Representative"),
      field(s, 3, "auditor", "Auditor", { required: true }),
      field(s, 4, "audit_date", "Date", { required: true }),
      field(s, 5, "gps", "GPS", { standardConcept: "gps" }),
      field(s, 6, "pass_fail", "Store Condition"),
      field(s, 7, "pass_fail", "Execution Score"),
      field(s, 8, "multiple_images", "Images"),
      field(s, 9, "notes", "Notes"),
    ],
    workflow: baseWorkflow(false),
    auditLevel: "one_per_audit",
    operatingModel: "fmcg_distributor",
    purpose: "outlet_visit",
    subjectType: "outlet",
  });
}

export function buildDepartmentAudit(model: OperatingModel) {
  resetFieldCounter();
  const s = "department";
  return assembleTemplate({
    sections: [sec(s, "Department Check", 0, { repeatable: true, repeatBy: "store" })],
    fields: [
      storeField(s, 0, model),
      field(s, 1, "short_text", "Department", { required: true }),
      field(s, 2, "pass_fail", "Cleanliness"),
      field(s, 3, "pass_fail", "Stock Availability"),
      field(s, 4, "pass_fail", "Pricing Compliance"),
      field(s, 5, "pass_fail", "Shelf Execution"),
      field(s, 6, "pass_fail", "Promotion Execution"),
      field(s, 7, "number", "OOS Count"),
      field(s, 8, "multiple_images", "Images"),
      field(s, 9, "notes", "Notes"),
    ],
    scoring: { enabled: true, passThreshold: 70 },
    auditLevel: "one_per_audit",
    operatingModel: model,
    purpose: "custom",
    subjectType: "store",
  });
}

export function buildCycleCountAudit(model: OperatingModel) {
  resetFieldCounter();
  const s = "cycle_count";
  return assembleTemplate({
    sections: [sec(s, "Cycle Count Line", 0, { repeatable: true, repeatBy: "sku" })],
    fields: [
      storeField(s, 0, model),
      field(s, 1, "short_text", "Zone"),
      field(s, 2, "short_text", "Location"),
      field(s, 3, "sku_id", "SKU", { required: true }),
      field(s, 4, "expected_qty", "System Qty", { required: true }),
      field(s, 5, "actual_qty", "Counted Qty", { required: true }),
      field(s, 6, "qty_variance", "Variance", { calculated: true }),
      field(s, 7, "rca", "RCA"),
      field(s, 8, "single_image", "Image"),
    ],
    rules: varianceRules(),
    auditLevel: "one_per_sku",
    operatingModel: model,
    purpose: "inventory",
    subjectType: "sku",
  });
}

export function buildDamageAudit(model: OperatingModel) {
  resetFieldCounter();
  const s = "damage";
  return assembleTemplate({
    sections: [sec(s, "Damage Report", 0, { repeatable: true, repeatBy: "sku" })],
    fields: [
      storeField(s, 0, model),
      field(s, 1, "sku_id", "SKU", { required: true }),
      field(s, 2, "damaged_qty", "Damaged Qty", { required: true }),
      field(s, 3, "defect_type", "Damage Type"),
      field(s, 4, "defect_severity", "Severity"),
      field(s, 5, "batch_number", "Batch"),
      field(s, 6, "multiple_images", "Images", { required: true }),
      field(s, 7, "rca", "RCA"),
    ],
    rules: [
      {
        id: "rule-damage",
        label: "Damage finding",
        when: { field: "damaged_qty", operator: "gt", value: 0 },
        then: [{ action: "create_finding", findingType: "Damaged Inventory", severity: "medium" }],
      },
    ],
    auditLevel: "one_per_sku",
    operatingModel: model,
    purpose: "custom",
    subjectType: "sku",
  });
}

export function buildStockAgeingAudit(model: OperatingModel) {
  resetFieldCounter();
  const s = "ageing";
  return assembleTemplate({
    sections: [sec(s, "Stock Ageing", 0, { repeatable: true, repeatBy: "batch" })],
    fields: [
      storeField(s, 0, model),
      field(s, 1, "sku_id", "SKU", { required: true }),
      field(s, 2, "batch_number", "Batch"),
      field(s, 3, "actual_qty", "Qty"),
      field(s, 4, "mfg_date", "MFG Date"),
      field(s, 5, "expiry_date", "Expiry Date"),
      field(s, 6, "number", "Age (Days)", { calculated: true }),
      field(s, 7, "dropdown", "Age Bucket", { config: { options: ["Fresh", "Aging", "Critical", "Expired"] } }),
      field(s, 8, "notes", "Notes"),
    ],
    rules: expiryRules(),
    auditLevel: "one_per_sku",
    operatingModel: model,
    purpose: "expiry",
    subjectType: "batch",
  });
}

export function buildReconciliationAudit(model: OperatingModel) {
  resetFieldCounter();
  const s = "reconciliation";
  return assembleTemplate({
    sections: [sec(s, "Reconciliation", 0, { repeatable: true, repeatBy: "sku" })],
    fields: [
      storeField(s, 0, model),
      field(s, 1, "sku_id", "SKU", { required: true }),
      field(s, 2, "expected_qty", "System Qty", { required: true }),
      field(s, 3, "actual_qty", "Physical Qty", { required: true }),
      field(s, 4, "qty_variance", "Variance", { calculated: true }),
      field(s, 5, "currency", "Value Variance", { standardConcept: "potential_value_variance" }),
      field(s, 6, "rca", "RCA", { required: true }),
      field(s, 7, "notes", "Resolution Notes"),
    ],
    rules: varianceRules(),
    auditLevel: "one_per_sku",
    operatingModel: model,
    purpose: "inventory",
    subjectType: "sku",
  });
}

export function buildFmcgGenericAudit(
  purpose: AuditPurpose,
  sectionTitle: string,
  extraFields: ReturnType<typeof field>[] = [],
) {
  resetFieldCounter();
  const s = "fmcg";
  return assembleTemplate({
    sections: [sec(s, sectionTitle, 0, { repeatable: true, repeatBy: "sku" })],
    fields: [
      field(s, 0, "short_text", "Outlet", { required: true }),
      field(s, 1, "short_text", "Distributor"),
      field(s, 2, "sku_id", "SKU", { required: true }),
      field(s, 3, "item_name", "Product"),
      field(s, 4, "brand", "Brand"),
      ...extraFields,
      field(s, 98, "single_image", "Evidence"),
      field(s, 99, "notes", "Notes"),
    ],
    auditLevel: "one_per_sku",
    operatingModel: "fmcg_distributor",
    purpose,
    subjectType: "sku",
  });
}
