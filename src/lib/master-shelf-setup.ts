/**
 * Master Shelf Setup — parse, validate, and map role-specific CSV into ScanContextState.
 * Single source of truth: upload and manual wizard both produce the same configuration shape.
 */

import {
  masterColumnKeys,
  masterFieldsForRole,
  masterTargetColumnKeys,
  MASTER_FIELD_GUIDE_FILENAMES,
  MASTER_TEMPLATE_FILENAMES,
} from "@/lib/master-shelf-setup-config";
import {
  autoPopulateAuditPackage,
  EMPTY_AUDIT_PACKAGE,
  type AssortmentEntry,
  type PlanogramAuditPackage,
  type PriceRequirement,
  type PromotionEntry,
  type ScoringTargets,
} from "@/lib/planogram-audit-package";
import { EMPTY_PLANOGRAM_META, type PlanogramMeta } from "@/lib/planogram-meta";
import type { PlanogramRow } from "@/lib/planogram";
import { defaultAuditRoleTab, type AuditRoleTab } from "@/lib/role-audit-ui";
import type { ScanContextState } from "@/lib/scan-context";

export type MasterValidationSeverity = "critical" | "warning";

export type MasterValidationIssue = {
  severity: MasterValidationSeverity;
  message: string;
  row?: number;
  field?: string;
};

export type MasterImportCounts = {
  products: number;
  shelves: number;
  positions: number;
  requiredProducts: number;
  prices: number;
  promotions: number;
  targetsReady: number;
  targetsTotal: number;
};

export type MasterImportPreview = {
  role: AuditRoleTab;
  store: string;
  planogram: string;
  products: number;
  shelves: number;
  positions: number;
  requiredProducts: number;
  prices: number;
  promotions: number;
  targets: string;
};

export type MasterValidationResult = {
  status: "critical" | "warning" | "ready";
  issues: MasterValidationIssue[];
  counts: MasterImportCounts;
  preview: MasterImportPreview;
  dataRows: Record<string, string>[];
};

export type MasterImportResult = {
  validation: MasterValidationResult;
  context: ScanContextState | null;
};

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  out.push(current.trim());
  return out;
}

function parseCsv(content: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = content
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  if (lines.length < 1) return { headers: [], rows: [] };
  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const values = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] ?? "";
    });
    rows.push(row);
  }
  return { headers, rows };
}

function isSkippedRow(row: Record<string, string>): boolean {
  const rowType = (row.row_type ?? "").toLowerCase();
  if (rowType === "example" || rowType === "field_guide") return true;
  const sku = (row.sku ?? "").toUpperCase();
  return sku.startsWith("EXAMPLE-") || sku === "EXAMPLE-SKU";
}

function val(row: Record<string, string>, key: string): string {
  return String(row[key] ?? "").trim();
}

function num(value: string): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function pct(value: string): number | null {
  const n = num(value.replace(/%/g, ""));
  if (n == null) return null;
  return n > 1 ? n : n * 100;
}

function isYes(value: string): boolean {
  return ["yes", "y", "true", "1"].includes(value.toLowerCase());
}

function parseDate(value: string): boolean {
  if (!value) return true;
  return !Number.isNaN(Date.parse(value));
}

const VALID_CURRENCIES = new Set(["INR", "USD", "EUR", "GBP"]);

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function csvLine(headers: string[], row: Record<string, string>): string {
  return headers.map((key) => csvEscape(row[key] ?? "")).join(",");
}

/** Clean data template: header row + one example row (row_type=example, ignored on upload). */
export function buildMasterTemplateCsv(role: AuditRoleTab): string {
  const fields = masterFieldsForRole(role);
  const headers = fields.map((f) => f.key);
  const example: Record<string, string> = { row_type: "example", audit_role: role };
  for (const field of fields) {
    if (field.example) example[field.key] = field.example;
  }
  return [headers.join(","), csvLine(headers, example)].join("\n");
}

/** Field guide CSV: column reference with required/optional and accepted values. */
export function buildMasterFieldGuideCsv(role: AuditRoleTab): string {
  const fields = masterFieldsForRole(role);
  const headers = ["field", "label", "required", "example", "accepted_values", "group"];
  const lines = [headers.join(",")];
  for (const field of fields) {
    lines.push(
      csvLine(headers, {
        field: field.key,
        label: field.label,
        required: field.required ? "yes" : "no",
        example: field.example ?? "",
        accepted_values: field.accepted ?? "",
        group: field.group,
      }),
    );
  }
  return lines.join("\n");
}

function downloadCsv(filename: string, content: string): void {
  const blob = new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadMasterTemplate(role: AuditRoleTab): void {
  downloadCsv(MASTER_TEMPLATE_FILENAMES[role], buildMasterTemplateCsv(role));
}

export function downloadMasterFieldGuide(role: AuditRoleTab): void {
  downloadCsv(MASTER_FIELD_GUIDE_FILENAMES[role], buildMasterFieldGuideCsv(role));
}

export function downloadMasterErrorReport(issues: MasterValidationIssue[], role: AuditRoleTab): void {
  const lines = [
    "severity,row,field,message",
    ...issues.map((issue) =>
      [issue.severity, issue.row ?? "", issue.field ?? "", `"${issue.message.replace(/"/g, '""')}"`].join(","),
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `Aislix_Master_Setup_Errors_${role}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function validateRows(
  role: AuditRoleTab,
  headers: string[],
  rows: Record<string, string>[],
): MasterValidationResult {
  const issues: MasterValidationIssue[] = [];
  const required = masterFieldsForRole(role).filter((f) => f.required).map((f) => f.key);
  const dataRows = rows.filter((row) => !isSkippedRow(row));

  for (const col of required) {
    if (!headers.includes(col)) {
      issues.push({
        severity: "critical",
        field: col,
        message: `Required column "${col}" is missing from the CSV header.`,
      });
    }
  }

  if (!dataRows.length) {
    issues.push({
      severity: "critical",
      message: "No data rows found. Add at least one row with row_type=data (not example).",
    });
  }

  const skuSet = new Set<string>();
  const shelfSet = new Set<string>();
  const positionSet = new Set<string>();
  const positionKeys = new Set<string>();
  let requiredProducts = 0;
  let priceCount = 0;
  const promoIds = new Set<string>();

  dataRows.forEach((row, index) => {
    const rowNum = index + 2;
    const sku = val(row, "sku");
    const positionId = val(row, "position_id");
    const expectedSku = val(row, "expected_sku") || sku;
    const shelfId = val(row, "shelf_id") || val(row, "shelf_number") || val(row, "shelf_name");

    if (!sku) {
      issues.push({ severity: "critical", row: rowNum, field: "sku", message: "SKU is required." });
    } else {
      skuSet.add(sku);
    }
    if (!val(row, "brand") || !val(row, "product_name")) {
      issues.push({
        severity: "critical",
        row: rowNum,
        message: "Brand and product_name are required for each product row.",
      });
    }
    if (!positionId) {
      issues.push({ severity: "critical", row: rowNum, field: "position_id", message: "Position ID is required." });
    } else {
      if (positionSet.has(positionId)) {
        issues.push({
          severity: "critical",
          row: rowNum,
          field: "position_id",
          message: `Duplicate position ID "${positionId}".`,
        });
      }
      positionSet.add(positionId);
    }

    const posKey = `${positionId}::${expectedSku}`;
    if (positionKeys.has(posKey)) {
      issues.push({
        severity: "critical",
        row: rowNum,
        message: `Duplicate SKU/position combination for ${expectedSku} at ${positionId}.`,
      });
    }
    positionKeys.add(posKey);

    if (shelfId) shelfSet.add(shelfId);

    const facings = num(val(row, "expected_total_facings"));
    if (facings == null || facings < 0) {
      issues.push({
        severity: "critical",
        row: rowNum,
        field: "expected_total_facings",
        message: "Expected total facings must be a valid number ≥ 0.",
      });
    }

    if (isYes(val(row, "required_product"))) requiredProducts += 1;

    const price = num(val(row, "expected_price"));
    if (isYes(val(row, "price_required")) && price == null) {
      issues.push({
        severity: "critical",
        row: rowNum,
        field: "expected_price",
        message: "Expected price is required when price_required=yes.",
      });
    }
    if (price != null) {
      if (price < 0) {
        issues.push({ severity: "critical", row: rowNum, message: "Price cannot be negative." });
      } else {
        priceCount += 1;
      }
    }

    const currency = val(row, "currency").toUpperCase();
    if (currency && !VALID_CURRENCIES.has(currency)) {
      issues.push({
        severity: "warning",
        row: rowNum,
        field: "currency",
        message: `Unrecognised currency "${currency}".`,
      });
    }

    if (!val(row, "barcode")) {
      issues.push({
        severity: "warning",
        row: rowNum,
        field: "barcode",
        message: "Optional barcode not provided.",
      });
    }

    for (const dateField of ["valid_from", "valid_until", "price_valid_from", "price_valid_until", "promotion_start", "promotion_end"]) {
      if (val(row, dateField) && !parseDate(val(row, dateField))) {
        issues.push({
          severity: "critical",
          row: rowNum,
          field: dateField,
          message: `Invalid date in ${dateField}.`,
        });
      }
    }

    const promoId = val(row, "promotion_id");
    if (promoId) promoIds.add(promoId);
    const participating = val(row, "participating_skus");
    if (participating) {
      for (const partSku of participating.split(/[|;]/).map((s) => s.trim()).filter(Boolean)) {
        if (!skuSet.has(partSku) && !dataRows.some((r) => val(r, "sku") === partSku)) {
          issues.push({
            severity: "critical",
            row: rowNum,
            message: `Promotion references unknown SKU "${partSku}".`,
          });
        }
      }
    }

    if (role === "fmcg" && !val(row, "target_brand") && index === 0) {
      issues.push({ severity: "critical", field: "target_brand", message: "Target brand is required for FMCG audits." });
    }
    if (role === "distributor" && !val(row, "distributor_name") && index === 0) {
      issues.push({
        severity: "critical",
        field: "distributor_name",
        message: "Distributor name is required for distributor audits.",
      });
    }
  });

  // Second pass: expected_sku references after all SKUs collected
  const reportedSkuRefs = new Set<string>();
  dataRows.forEach((row, index) => {
    const expectedSku = val(row, "expected_sku") || val(row, "sku");
    if (!expectedSku || skuSet.has(expectedSku) || reportedSkuRefs.has(expectedSku)) return;
    reportedSkuRefs.add(expectedSku);
    const refCount = dataRows.filter(
      (r) => val(r, "position_id") && (val(r, "expected_sku") || val(r, "sku")) === expectedSku,
    ).length;
    issues.push({
      severity: "critical",
      row: index + 2,
      message: `${refCount} shelf position(s) reference SKU "${expectedSku}" that is not present in the product list.`,
    });
  });

  const targetFields = masterTargetColumnKeys(role);
  const first = dataRows[0] ?? {};
  let targetsReady = 0;
  for (const key of targetFields) {
    const raw = val(first, key);
    if (!raw) {
      issues.push({
        severity: "warning",
        field: key,
        message: `Audit target "${key}" is empty — add a value on the first data row or set it in Step 7.`,
      });
      continue;
    }
    const p = pct(raw);
    if (p == null || p < 0 || p > 100) {
      issues.push({ severity: "warning", field: key, message: `Target ${key} should be a percentage 0–100.` });
    } else {
      targetsReady += 1;
    }
  }

  const criticalCount = issues.filter((i) => i.severity === "critical").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  const status: MasterValidationResult["status"] =
    criticalCount > 0 ? "critical" : warningCount > 0 ? "warning" : "ready";

  const counts: MasterImportCounts = {
    products: skuSet.size,
    shelves: shelfSet.size,
    positions: positionSet.size,
    requiredProducts,
    prices: priceCount,
    promotions: promoIds.size,
    targetsReady,
    targetsTotal: targetFields.length,
  };

  const preview: MasterImportPreview = {
    role,
    store: val(first, "store_name") || val(first, "outlet_name") || "—",
    planogram: val(first, "planogram_name") || "—",
    products: counts.products,
    shelves: counts.shelves,
    positions: counts.positions,
    requiredProducts: counts.requiredProducts,
    prices: counts.prices,
    promotions: counts.promotions,
    targets: `${counts.targetsReady}/${counts.targetsTotal}`,
  };

  return { status, issues, counts, preview, dataRows };
}

function mapRowToPlanogram(row: Record<string, string>, role: AuditRoleTab): PlanogramRow {
  const sku = val(row, "sku");
  const facings = num(val(row, "expected_total_facings")) ?? num(val(row, "expected_horizontal_facings")) ?? 0;
  const location =
    val(row, "location") ||
    val(row, "pick_location") ||
    [val(row, "aisle"), val(row, "rack"), val(row, "bay")].filter(Boolean).join("-") ||
    val(row, "fixture_id") ||
    "A-1";
  return {
    location,
    category: val(row, "category") || "General",
    sub_category: val(row, "sub_category") || "",
    brand: val(row, "brand"),
    product_name: val(row, "product_name"),
    variant: val(row, "variant"),
    expected_qty: facings,
    expected_facings: facings,
    min_facings: num(val(row, "min_facings")) ?? undefined,
    max_facings: num(val(row, "max_facings")) ?? undefined,
    mrp_inr: num(val(row, "expected_price")) ?? undefined,
    sku,
    shelf_position: val(row, "shelf_position") || val(row, "position_id") || val(row, "shelf_number"),
    match_key: sku,
  };
}

function buildMeta(first: Record<string, string>, role: AuditRoleTab): PlanogramMeta {
  const unit = val(first, "measurement_unit").toLowerCase();
  return {
    ...EMPTY_PLANOGRAM_META,
    name: val(first, "planogram_name"),
    store_outlet: val(first, "store_name") || val(first, "outlet_name"),
    category: val(first, "category") || EMPTY_PLANOGRAM_META.category,
    sub_category: val(first, "sub_category"),
    valid_from: val(first, "valid_from") || EMPTY_PLANOGRAM_META.valid_from,
    valid_until: val(first, "valid_until") || undefined,
    measurement_unit: unit === "inch" || unit === "mm" ? unit : "cm",
    fixture_type: val(first, "fixture_type") || "gondola",
    fixture_width: num(val(first, "fixture_width")) ?? undefined,
    fixture_height: num(val(first, "fixture_height")) ?? undefined,
    shelf_count: num(val(first, "shelf_number")) ?? undefined,
    fixture_id: val(first, "fixture_id"),
    territory: val(first, "territory") || undefined,
    sales_representative: val(first, "sales_rep") || undefined,
    is_demo: false,
  };
}

function buildPackage(dataRows: Record<string, string>[], role: AuditRoleTab): PlanogramAuditPackage {
  const first = dataRows[0] ?? {};
  const assortment: AssortmentEntry[] = [];
  const msl: AssortmentEntry[] = [];
  const prices: PriceRequirement[] = [];
  const promotions: PromotionEntry[] = [];
  const promoMap = new Map<string, PromotionEntry>();

  for (const row of dataRows) {
    const sku = val(row, "sku");
    if (!sku) continue;
    const reqType = val(row, "requirement_type").toLowerCase();
    if (isYes(val(row, "required_product")) || reqType === "mandatory_assortment") {
      assortment.push({ sku, list_type: "mandatory_assortment", outlet_scope: val(row, "outlet_scope") || "all" });
    } else if (reqType === "msl" || isYes(val(row, "msl_required"))) {
      msl.push({ sku, list_type: "msl", outlet_scope: val(row, "outlet_scope") || "all" });
    }

    const price = num(val(row, "expected_price"));
    if (price != null && isYes(val(row, "price_required"))) {
      prices.push({
        sku,
        label_location: val(row, "price_label_location") || "shelf_tag",
        expected_price: price,
        currency: val(row, "currency").toUpperCase() || "INR",
        price_basis: val(row, "price_basis") || "item",
        valid_from: val(row, "price_valid_from") || undefined,
        valid_to: val(row, "price_valid_until") || undefined,
      });
    }

    const promoId = val(row, "promotion_id");
    if (promoId) {
      const existing = promoMap.get(promoId) ?? {
        promotion_id: promoId,
        participating_skus: [],
        start_date: val(row, "promotion_start") || undefined,
        end_date: val(row, "promotion_end") || undefined,
        required_location: val(row, "required_location") || undefined,
        expected_offer_text: val(row, "offer_text") || val(row, "promotion_name") || undefined,
        expected_promo_price: num(val(row, "promotional_price")),
        required_facings: num(val(row, "required_facings")),
      };
      const parts = val(row, "participating_skus")
        .split(/[|;]/)
        .map((s) => s.trim())
        .filter(Boolean);
      existing.participating_skus = [...new Set([...existing.participating_skus, sku, ...parts])];
      promoMap.set(promoId, existing);
    }
  }

  promotions.push(...promoMap.values());

  const scoring: ScoringTargets = {
    osa_target: pct(val(first, "osa_target")) ?? undefined,
    planogram_target: pct(val(first, "planogram_target")) ?? undefined,
    assortment_target: pct(val(first, "assortment_target")) ?? undefined,
    price_target: pct(val(first, "price_target")) ?? undefined,
    promotional_target: pct(val(first, "promotion_target")) ?? undefined,
    msl_target: pct(val(first, "msl_target")) ?? undefined,
    share_of_shelf_target: pct(val(first, "share_of_shelf_target")) ?? pct(val(first, "target_share_of_shelf")) ?? undefined,
    location_accuracy_target: pct(val(first, "location_accuracy_target")) ?? undefined,
    facing_target: pct(val(first, "facing_target")) ?? undefined,
  };

  const pkg: PlanogramAuditPackage = {
    assortment_skus: assortment,
    msl_skus: msl,
    price_requirements: prices,
    promotions,
    scoring,
    primary_brand: val(first, "target_brand") || val(first, "brand") || undefined,
    fixture_id: val(first, "fixture_id") || undefined,
    store_timezone: val(first, "timezone") || "Asia/Kolkata",
  };

  return autoPopulateAuditPackage(
    dataRows.map((row) => mapRowToPlanogram(row, role)),
    pkg,
    { skipAssortment: assortment.length > 0, skipMsl: msl.length > 0, skipPrices: prices.length > 0 },
  );
}

export function mapMasterToScanContext(
  role: AuditRoleTab,
  dataRows: Record<string, string>[],
): ScanContextState {
  const first = dataRows[0] ?? {};
  const planogramRows = dataRows.map((row) => mapRowToPlanogram(row, role));
  const auditPackage = buildPackage(dataRows, role);
  const focus: ScanContextState["focus"] = {};
  if (role === "distributor") {
    focus.company = val(first, "distributor_name") || val(first, "distributor_portfolio");
  }
  if (role === "fmcg") {
    focus.brand = val(first, "target_brand");
    focus.product = val(first, "competitor_brand");
  }

  return {
    focus,
    planogramRows,
    auditRole: defaultAuditRoleTab(val(first, "audit_role") as AuditRoleTab) || role,
    auditPackage,
    planogramMeta: buildMeta(first, role),
  };
}

export async function parseAndValidateMasterSetup(
  role: AuditRoleTab,
  file: File,
): Promise<MasterImportResult> {
  const text = await file.text();
  const { headers, rows } = parseCsv(text);
  const allowed = new Set(masterColumnKeys(role));
  const normalizedHeaders = headers.filter((h) => allowed.has(h) || h === "row_type");
  const validation = validateRows(role, normalizedHeaders.length ? normalizedHeaders : headers, rows);

  if (validation.status === "critical") {
    return { validation, context: null };
  }

  return {
    validation,
    context: mapMasterToScanContext(role, validation.dataRows),
  };
}
