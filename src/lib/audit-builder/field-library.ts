/**
 * Field library catalog for the Custom Audit Builder.
 */

import type { FieldType } from "./types";

export type FieldLibraryItem = {
  type: FieldType;
  label: string;
  description: string;
  defaultConfig?: Record<string, unknown>;
  system?: boolean;
  calculated?: boolean;
};

export type FieldLibraryCategory = {
  id: string;
  title: string;
  items: FieldLibraryItem[];
};

export const FIELD_LIBRARY: FieldLibraryCategory[] = [
  {
    id: "product",
    title: "Product / SKU",
    items: [
      { type: "sku_id", label: "SKU ID", description: "Product SKU identifier" },
      { type: "item_code", label: "Item Code", description: "Internal item code" },
      { type: "item_name", label: "Item Name", description: "Product display name" },
      { type: "brand", label: "Brand", description: "Product brand" },
      { type: "category", label: "Category", description: "Product category" },
      { type: "subcategory", label: "Subcategory", description: "Product subcategory" },
      { type: "variant", label: "Variant", description: "Pack variant / size" },
      { type: "batch_number", label: "Batch Number", description: "Manufacturing batch" },
      { type: "lot_number", label: "Lot Number", description: "Lot identifier" },
    ],
  },
  {
    id: "quantity",
    title: "Quantity",
    items: [
      { type: "expected_qty", label: "Expected Quantity", description: "Planogram or system qty", defaultConfig: { min: 0 } },
      { type: "actual_qty", label: "Actual Quantity", description: "Physically counted qty", defaultConfig: { min: 0 } },
      { type: "qty_variance", label: "Quantity Variance", description: "Actual − Expected", calculated: true },
      { type: "qty_variance_pct", label: "Quantity Variance %", description: "Variance as percentage", calculated: true },
      { type: "damaged_qty", label: "Damaged Quantity", description: "Damaged units", defaultConfig: { min: 0 } },
      { type: "expired_qty", label: "Expired Quantity", description: "Expired units", defaultConfig: { min: 0 } },
    ],
  },
  {
    id: "dates",
    title: "Dates",
    items: [
      { type: "audit_date", label: "Audit Date", description: "Date of audit" },
      { type: "mfg_date", label: "Manufacturing Date", description: "MFG date on pack" },
      { type: "expiry_date", label: "Expiry Date", description: "Expiry date on pack" },
      { type: "best_before_date", label: "Best Before Date", description: "Best before date" },
      { type: "expiry_days_remaining", label: "Expiry Days Remaining", description: "Days until expiry", calculated: true },
    ],
  },
  {
    id: "quality",
    title: "Quality",
    items: [
      { type: "qc_status", label: "QC Status", description: "Pass / Fail quality check", defaultConfig: { options: ["Pass", "Fail"] } },
      { type: "pass_fail", label: "Pass / Fail", description: "Binary pass/fail" },
      { type: "quality_score", label: "Quality Score", description: "Numeric quality score" },
      { type: "defect_type", label: "Defect Type", description: "Type of defect observed" },
      { type: "defect_severity", label: "Defect Severity", description: "Defect severity level" },
      { type: "severity", label: "Severity", description: "Finding severity", defaultConfig: { options: ["Low", "Medium", "High", "Critical"] } },
      { type: "temperature", label: "Temperature", description: "Temperature reading", defaultConfig: { unit: "°C" } },
      { type: "weight", label: "Weight", description: "Weight measurement", defaultConfig: { unit: "g" } },
      { type: "measurement", label: "Measurement", description: "Generic measurement" },
      { type: "custom_numeric", label: "Custom Numeric Measurement", description: "Custom numeric field" },
    ],
  },
  {
    id: "evidence",
    title: "Evidence",
    items: [
      { type: "single_image", label: "Single Image", description: "One photo", defaultConfig: { cameraRequired: true, galleryAllowed: true } },
      { type: "multiple_images", label: "Multiple Images", description: "Multiple photos with min/max", defaultConfig: { minImages: 1, maxImages: 5, cameraRequired: true, galleryAllowed: true } },
      { type: "video", label: "Video", description: "Video evidence" },
      { type: "document", label: "Document", description: "PDF or document upload" },
      { type: "before_after_images", label: "Before/After Images", description: "Before and after photos" },
    ],
  },
  {
    id: "identification",
    title: "Identification",
    items: [
      { type: "barcode_scanner", label: "Barcode Scanner", description: "Scan product barcode" },
      { type: "qr_scanner", label: "QR Scanner", description: "Scan QR code" },
      { type: "sku_selector", label: "SKU Selector", description: "Select from SKU catalog" },
      { type: "batch_selector", label: "Batch Selector", description: "Select batch/lot" },
    ],
  },
  {
    id: "location",
    title: "Location",
    items: [
      { type: "gps", label: "GPS Location", description: "Capture GPS coordinates" },
      { type: "store", label: "Store", description: "Store selector", system: true },
      { type: "warehouse", label: "Warehouse", description: "Warehouse location" },
      { type: "shelf", label: "Shelf", description: "Shelf identifier" },
      { type: "rack", label: "Rack", description: "Rack identifier" },
      { type: "bin", label: "Bin", description: "Bin identifier" },
    ],
  },
  {
    id: "input",
    title: "Input",
    items: [
      { type: "short_text", label: "Short Text", description: "Single-line text" },
      { type: "long_text", label: "Long Text", description: "Multi-line notes" },
      { type: "number", label: "Number", description: "Numeric input" },
      { type: "currency", label: "Currency", description: "Currency amount", defaultConfig: { unit: "₹" } },
      { type: "percentage", label: "Percentage", description: "Percentage value", defaultConfig: { min: 0, max: 100 } },
      { type: "date", label: "Date", description: "Date picker" },
      { type: "datetime", label: "Date + Time", description: "Date and time picker" },
    ],
  },
  {
    id: "selection",
    title: "Selection",
    items: [
      { type: "dropdown", label: "Dropdown", description: "Single select dropdown", defaultConfig: { options: [] } },
      { type: "multi_select", label: "Multi-select", description: "Multiple selection", defaultConfig: { options: [] } },
      { type: "radio", label: "Radio", description: "Radio button group", defaultConfig: { options: [] } },
      { type: "checkbox", label: "Checkbox", description: "Checkbox field" },
      { type: "yes_no", label: "Yes / No", description: "Yes/No toggle" },
      { type: "pass_fail", label: "Pass / Fail", description: "Pass or Fail selection" },
    ],
  },
  {
    id: "investigation",
    title: "Investigation",
    items: [
      { type: "rca", label: "RCA", description: "Root cause analysis" },
      { type: "finding_type", label: "Finding Type", description: "Finding classification" },
      { type: "severity", label: "Severity", description: "Issue severity" },
      { type: "notes", label: "Notes", description: "Free-form notes" },
      { type: "corrective_action", label: "Corrective Action", description: "Corrective action field" },
    ],
  },
  {
    id: "system",
    title: "System",
    items: [
      { type: "auditor", label: "Auditor", description: "Auto-filled auditor", system: true },
      { type: "manager", label: "Manager", description: "Auto-filled manager", system: true },
      { type: "audit_id", label: "Audit ID", description: "Auto-generated audit ID", system: true },
      { type: "timestamp", label: "Timestamp", description: "Auto-captured timestamp", system: true },
      { type: "audit_source", label: "Audit Source", description: "Digital / AI / Custom", system: true },
    ],
  },
];

export const AUDIT_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "shelf_audit", label: "Shelf Audit" },
  { value: "inventory_audit", label: "Inventory Audit" },
  { value: "fnv_qc_audit", label: "FNV QC Audit" },
  { value: "expiry_audit", label: "Expiry Audit" },
  { value: "store_visit_audit", label: "Store Visit Audit" },
  { value: "warehouse_audit", label: "Warehouse Audit" },
  { value: "distributor_audit", label: "Distributor Audit" },
  { value: "planogram_audit", label: "Planogram Audit" },
  { value: "promotion_audit", label: "Promotion Audit" },
  { value: "custom", label: "Custom Audit" },
];

export const AUDIT_LEVEL_OPTIONS: { value: string; label: string; description: string }[] = [
  { value: "one_per_audit", label: "One record per audit", description: "Single form for the entire audit" },
  { value: "one_per_sku", label: "One record per SKU", description: "Repeat for every SKU — essential for retail" },
  { value: "one_per_shelf", label: "One record per shelf", description: "Repeat for each shelf section" },
  { value: "one_per_location", label: "One record per location", description: "Repeat for each store location" },
  { value: "repeating_section", label: "Repeating section", description: "Configurable repeating block" },
];

export function createFieldFromLibrary(
  item: FieldLibraryItem,
  sectionKey: string,
  order: number,
): import("./types").TemplateField {
  const id = crypto.randomUUID();
  const key = `${item.type}_${id.slice(0, 8)}`;
  return {
    id,
    key,
    type: item.type,
    label: item.label,
    section: sectionKey,
    order,
    required: false,
    config: { ...(item.defaultConfig ?? {}) },
    system: item.system,
    calculated: item.calculated,
    formula: item.calculated ? defaultFormula(item.type) : undefined,
  };
}

function defaultFormula(type: FieldType): string | undefined {
  if (type === "qty_variance") return "actual_qty - expected_qty";
  if (type === "qty_variance_pct") return "((actual_qty - expected_qty) / expected_qty) * 100";
  if (type === "expiry_days_remaining") return "expiry_date - audit_date";
  return undefined;
}

export function isImageField(type: FieldType): boolean {
  return ["single_image", "multiple_images", "before_after_images"].includes(type);
}

export function isNumericField(type: FieldType): boolean {
  return [
    "expected_qty", "actual_qty", "qty_variance", "qty_variance_pct",
    "damaged_qty", "expired_qty", "number", "currency", "percentage",
    "temperature", "weight", "measurement", "custom_numeric", "quality_score",
  ].includes(type);
}
