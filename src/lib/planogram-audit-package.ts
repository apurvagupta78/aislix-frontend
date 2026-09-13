/** Planogram audit package — assortment, MSL, prices, promotions, scoring targets. */

import { ASSORTMENT_CSV_TEMPLATE } from "@/lib/planogram-assortment-template";
import { PRICE_CSV_TEMPLATE } from "@/lib/planogram-price-template";
import { PROMOTION_CSV_TEMPLATE } from "@/lib/planogram-promotion-template";
import type { DraftRow, PlanogramRow } from "@/lib/planogram";
import { downloadBlob } from "@/lib/scan-results";

export type AssortmentEntry = {
  sku: string;
  list_type: "mandatory_assortment" | "msl" | "optional";
  outlet_scope: string;
  valid_from?: string;
  valid_to?: string;
  substitution_allowed?: boolean;
  optional?: boolean;
};

export type PriceRequirement = {
  sku: string;
  label_location: string;
  expected_price: number;
  currency: string;
  price_basis: string;
  valid_from?: string;
  valid_to?: string;
};

export type PromotionEntry = {
  promotion_id: string;
  participating_skus: string[];
  start_date?: string;
  end_date?: string;
  required_location?: string;
  expected_offer_text?: string;
  expected_promo_price?: number | null;
  required_facings?: number | null;
};

export type ScoringTargets = {
  osa_target?: number;
  planogram_target?: number;
  assortment_target?: number;
  price_target?: number;
  promotional_target?: number;
  msl_target?: number;
  share_of_shelf_target?: number;
  location_accuracy_target?: number;
  facing_target?: number;
};

export type PlanogramAuditPackage = {
  assortment_skus: AssortmentEntry[];
  msl_skus: AssortmentEntry[];
  price_requirements: PriceRequirement[];
  promotions: PromotionEntry[];
  scoring?: ScoringTargets;
  primary_brand?: string;
  fixture_id?: string;
  store_timezone?: string;
};

export type KpiReadiness = { kpi_id: string; ready: boolean; label: string };

export const EMPTY_AUDIT_PACKAGE: PlanogramAuditPackage = {
  assortment_skus: [],
  msl_skus: [],
  price_requirements: [],
  promotions: [],
  scoring: {},
};

export type AutoPopulateAuditPackageOptions = {
  /** Homepage custom setup — user defines required products explicitly in the wizard. */
  skipAssortment?: boolean;
  skipMsl?: boolean;
  skipPrices?: boolean;
};

/** Derive assortment, MSL, prices, SOS scope from product rows when lists are empty. */
export function autoPopulateAuditPackage(
  rows: {
    sku?: string;
    brand?: string;
    product_name?: string;
    location?: string;
    category?: string;
    mrp_inr?: number;
    shelf_position?: string;
    match_key?: string;
  }[],
  existing: PlanogramAuditPackage = EMPTY_AUDIT_PACKAGE,
  options?: AutoPopulateAuditPackageOptions,
): PlanogramAuditPackage {
  const pkg: PlanogramAuditPackage = {
    assortment_skus: [...existing.assortment_skus],
    msl_skus: [...existing.msl_skus],
    price_requirements: [...existing.price_requirements],
    promotions: [...existing.promotions],
    scoring: { ...existing.scoring },
    primary_brand: existing.primary_brand,
    fixture_id: existing.fixture_id,
    store_timezone: existing.store_timezone || "Asia/Kolkata",
  };

  const skuFor = (row: (typeof rows)[0]) =>
    String(row.sku || row.match_key || `${row.brand}::${row.product_name}`).trim();

  if (!options?.skipAssortment && !pkg.assortment_skus.length && rows.length) {
    pkg.assortment_skus = rows
      .filter((r) => skuFor(r))
      .map((r) => ({
        sku: skuFor(r),
        list_type: "mandatory_assortment" as const,
        outlet_scope: String(r.location || "all"),
      }));
  }

  if (!options?.skipMsl && !pkg.msl_skus.length && rows.length) {
    pkg.msl_skus = rows
      .filter((r) => skuFor(r))
      .slice(0, Math.max(1, Math.ceil(rows.length * 0.6)))
      .map((r) => ({
        sku: skuFor(r),
        list_type: "msl" as const,
        outlet_scope: String(r.location || "all"),
      }));
  }

  if (!options?.skipPrices && !pkg.price_requirements.length) {
    pkg.price_requirements = rows
      .filter((r) => r.mrp_inr != null && Number.isFinite(Number(r.mrp_inr)) && skuFor(r))
      .map((r) => ({
        sku: skuFor(r),
        label_location: String(r.shelf_position || "shelf_tag"),
        expected_price: Number(r.mrp_inr),
        currency: "INR",
        price_basis: "item",
      }));
  }

  if (!pkg.primary_brand?.trim() && rows.length) {
    const counts = new Map<string, number>();
    for (const r of rows) {
      const b = String(r.brand ?? "").trim();
      if (b) counts.set(b, (counts.get(b) ?? 0) + 1);
    }
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top) pkg.primary_brand = top[0];
  }

  if (!pkg.fixture_id?.trim() && rows[0]?.location) {
    pkg.fixture_id = String(rows[0].location);
  }

  return pkg;
}

export function computeReadiness(
  rows: { sku?: string; expected_facings?: number; mrp_inr?: number; shelf_position?: string; brand?: string }[],
  pkg: PlanogramAuditPackage,
): KpiReadiness[] {
  const effective = autoPopulateAuditPackage(rows, pkg);
  const hasProducts = rows.length > 0;
  const hasFacings = rows.some((r) => r.expected_facings != null);
  const hasPrices =
    rows.some((r) => r.mrp_inr != null) || effective.price_requirements.length > 0;
  return [
    { kpi_id: "osa", ready: hasProducts, label: "Listed SKUs" },
    { kpi_id: "planogram_compliance", ready: hasProducts, label: "Shelf layout" },
    {
      kpi_id: "assortment_compliance",
      ready: effective.assortment_skus.length > 0,
      label: "Assortment list",
    },
    { kpi_id: "msl_compliance", ready: effective.msl_skus.length > 0, label: "Must-stock list" },
    { kpi_id: "price_compliance", ready: hasPrices, label: "Price requirements" },
    { kpi_id: "promotional_compliance", ready: effective.promotions.length > 0, label: "Promotions" },
    { kpi_id: "location_accuracy", ready: rows.some((r) => String(r.shelf_position ?? "").trim()), label: "Slot IDs" },
    { kpi_id: "facing_count", ready: hasFacings, label: "Expected facings" },
    {
      kpi_id: "share_of_shelf",
      ready: Boolean(effective.primary_brand?.trim()),
      label: "Brand scope",
    },
  ];
}

export function splitAssortmentRows(rows: AssortmentEntry[]): {
  assortment_skus: AssortmentEntry[];
  msl_skus: AssortmentEntry[];
} {
  const assortment_skus = rows.filter((r) => r.list_type === "mandatory_assortment" || r.list_type === "optional");
  const msl_skus = rows.filter((r) => r.list_type === "msl");
  return { assortment_skus, msl_skus };
}

export function mergeAssortmentLists(assortment: AssortmentEntry[], msl: AssortmentEntry[]): AssortmentEntry[] {
  return [...assortment, ...msl];
}

const API_BASE = () =>
  (import.meta.env.VITE_AISLIX_API_URL as string | undefined)?.replace(/\/+$/, "") ?? "";

export async function fetchPackageCsvTemplate(kind: "assortment" | "prices" | "promotions"): Promise<string> {
  const local: Record<string, string> = {
    assortment: `${ASSORTMENT_CSV_TEMPLATE}\n`,
    prices: `${PRICE_CSV_TEMPLATE}\n`,
    promotions: `${PROMOTION_CSV_TEMPLATE}\n`,
  };
  const base = API_BASE();
  if (base) {
    try {
      const res = await fetch(`${base}/planogram/csv-template/${kind}`, { headers: { Accept: "application/json" } });
      if (res.ok) {
        const json = (await res.json()) as { csv_text?: string };
        if (json.csv_text) return json.csv_text;
      }
    } catch {
      // fallback
    }
  }
  return local[kind];
}

export async function parsePackageCsv(
  kind: "assortment" | "prices" | "promotions",
  content: string,
): Promise<{ rows: Array<{ valid: boolean; data?: unknown; errors?: string[] }>; errors: string[] }> {
  const base = API_BASE();
  if (base) {
    try {
      const res = await fetch(`${base}/planogram/parse-package-csv`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ kind, content }),
      });
      if (res.ok) return (await res.json()) as { rows: Array<{ valid: boolean; data?: unknown; errors?: string[] }>; errors: string[] };
    } catch {
      // fallback: client accepts any non-empty CSV with header
    }
  }
  const lines = content.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return { rows: [], errors: ["CSV must include a header and at least one row."] };
  return { rows: lines.slice(1).map(() => ({ valid: true, data: {} })), errors: [] };
}

export function packageForSave(pkg: PlanogramAuditPackage): Record<string, unknown> {
  const { assortment_skus, msl_skus, ...rest } = pkg;
  return {
    ...rest,
    assortment_skus,
    msl_skus,
  };
}

export function packageFromDb(raw: unknown): PlanogramAuditPackage {
  if (!raw || typeof raw !== "object") return { ...EMPTY_AUDIT_PACKAGE };
  const obj = raw as Record<string, unknown>;
  return {
    assortment_skus: (obj.assortment_skus as AssortmentEntry[]) ?? [],
    msl_skus: (obj.msl_skus as AssortmentEntry[]) ?? [],
    price_requirements: (obj.price_requirements as PriceRequirement[]) ?? [],
    promotions: (obj.promotions as PromotionEntry[]) ?? [],
    scoring: (obj.scoring as ScoringTargets) ?? {},
    primary_brand: typeof obj.primary_brand === "string" ? obj.primary_brand : "",
    fixture_id: typeof obj.fixture_id === "string" ? obj.fixture_id : "",
    store_timezone: typeof obj.store_timezone === "string" ? obj.store_timezone : "",
  };
}

export type PlanogramPackageExport = {
  version: 1;
  exported_at: string;
  name?: string;
  rows: PlanogramRow[];
  audit_package: PlanogramAuditPackage;
};

let rowKeyCounter = 0;

function nextRowKey(prefix = "import"): string {
  rowKeyCounter += 1;
  return `${prefix}-${Date.now()}-${rowKeyCounter}`;
}

/** Download full planogram + audit package as JSON. */
export function exportPlanogramPackageJson(
  name: string,
  rows: DraftRow[],
  auditPackage: PlanogramAuditPackage,
): void {
  const payload: PlanogramPackageExport = {
    version: 1,
    exported_at: new Date().toISOString(),
    name: name.trim() || undefined,
    rows: rows.map(({ key: _key, ...row }) => row),
    audit_package: auditPackage,
  };
  const stamp = new Date().toISOString().slice(0, 10);
  const slug = (name.trim() || "planogram").replace(/[^\w.-]+/g, "-").slice(0, 40);
  downloadBlob(JSON.stringify(payload, null, 2), `aislix-${slug}-${stamp}.json`, "application/json");
}

export type PlanogramPackageImportResult = {
  rows: DraftRow[];
  auditPackage: PlanogramAuditPackage;
  name?: string;
  errors: string[];
};

/** Parse and validate a planogram package JSON export. */
export function parsePlanogramPackageImport(raw: unknown): PlanogramPackageImportResult {
  const errors: string[] = [];
  if (!raw || typeof raw !== "object") {
    return { rows: [], auditPackage: { ...EMPTY_AUDIT_PACKAGE }, errors: ["Invalid JSON object."] };
  }
  const obj = raw as Record<string, unknown>;
  const name = typeof obj.name === "string" ? obj.name : undefined;
  const auditRaw = obj.audit_package ?? obj.auditPackage;
  const auditPackage = packageFromDb(auditRaw);

  const rowSource = obj.rows;
  if (!Array.isArray(rowSource)) {
    errors.push("Missing rows array.");
    return { rows: [], auditPackage, name, errors };
  }

  const rows: DraftRow[] = [];
  for (const [i, item] of rowSource.entries()) {
    if (!item || typeof item !== "object") {
      errors.push(`Row ${i + 1}: invalid object.`);
      continue;
    }
    const row = item as Record<string, unknown>;
    const product = String(row.product_name ?? row.product ?? "").trim();
    const brand = String(row.brand ?? "").trim();
    if (!product || !brand) {
      errors.push(`Row ${i + 1}: brand and product_name are required.`);
      continue;
    }
    rows.push({
      key: nextRowKey("row"),
      location: String(row.location ?? ""),
      category: String(row.category ?? ""),
      sub_category: String(row.sub_category ?? row.subcategory ?? ""),
      brand,
      product_name: product,
      variant: String(row.variant ?? ""),
      expected_qty: Number(row.expected_qty ?? row.expected_facings ?? 1) || 1,
      expected_facings:
        row.expected_facings != null ? Number(row.expected_facings) : undefined,
      min_facings: row.min_facings != null ? Number(row.min_facings) : undefined,
      max_facings: row.max_facings != null ? Number(row.max_facings) : undefined,
      expected_shelf_units:
        row.expected_shelf_units != null ? Number(row.expected_shelf_units) : undefined,
      expected_shelf_level: String(row.expected_shelf_level ?? ""),
      expected_position: String(row.expected_position ?? ""),
      mrp_inr: row.mrp_inr != null ? Number(row.mrp_inr) : undefined,
      avg_daily_sales: row.avg_daily_sales != null ? Number(row.avg_daily_sales) : undefined,
      sku: String(row.sku ?? ""),
      shelf_position: String(row.shelf_position ?? row.expected_position ?? ""),
      match_key: String(row.match_key ?? `${brand}::${product}`),
    });
  }

  return { rows, auditPackage, name, errors };
}
