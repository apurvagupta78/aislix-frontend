/**
 * Planogram Management — expected shelf data per store (Milestone 1).
 *
 * CSV parsing and row normalization run on the Aislix vision backend; drafts,
 * versions and items are persisted in Supabase under the org's RLS policies.
 */

import { supabase } from "@/integrations/supabase/client";
import { dbError, getMembership, requireOrgId, requireUserId } from "@/lib/db/context";

export type PlanogramRow = {
  location: string;
  category: string;
  sub_category: string;
  brand: string;
  product_name: string;
  /** Optional pack size / flavour, e.g. "340ml" or "25 bags". */
  variant: string;
  /** Legacy shelf quantity field — prefer expected_facings for planogram facing rules. */
  expected_qty: number;
  /** Visible product faces expected on shelf (distinct from inventory units). */
  expected_facings?: number;
  min_facings?: number;
  max_facings?: number;
  /** Optional on-shelf inventory unit expectation (separate from facings). */
  expected_shelf_units?: number;
  expected_shelf_level?: string;
  expected_position?: string;
  /** Price in INR (CSV column mrp_inr) — used for financial impact calculations. */
  mrp_inr?: number;
  /** Average daily unit sales — used for velocity-based lost sales. */
  avg_daily_sales?: number;
  sku: string;
  shelf_position: string;
  match_key: string;
};

/** Required fields for a planogram row, in display order. */
export const REQUIRED_PLANOGRAM_FIELDS = [
  ["location", "Location"],
  ["category", "Category"],
  ["sub_category", "Sub category"],
  ["brand", "Brand"],
  ["product_name", "Product Name"],
] as const;

/** Returns a validation message for the first missing required field. */
export function validatePlanogramRow(row: PlanogramRow): string | null {
  for (const [key, label] of REQUIRED_PLANOGRAM_FIELDS) {
    if (!String(row[key] ?? "").trim()) return `${label} is required.`;
  }
  if (!Number.isFinite(Number(row.expected_qty)) || Number(row.expected_qty) < 0) {
    return "Expected qty must be a number of 0 or more.";
  }
  return null;
}

export type DraftRow = PlanogramRow & { key: string };

export type PlanogramVersion = {
  id: string;
  store_id: string;
  name: string;
  status: string;
  source_type: string;
  row_count: number;
  activated_at: string | null;
  created_at: string;
};

export type CsvParseRow = {
  row_num: number;
  valid: boolean;
  data?: Partial<PlanogramRow> | null;
  errors?: string[] | null;
};

export type CsvParseResult = {
  rows: CsvParseRow[];
  errors: string[];
  valid_count: number;
  error_count: number;
};

export const PLANOGRAM_MANAGER_ROLES = ["owner", "admin", "manager"] as const;

import {
  REQUIRED_CSV_COLUMNS,
  SAMPLE_CSV_HEADERS,
  SAMPLE_CSV_TEMPLATE,
} from "@/lib/planogram-template";

export { REQUIRED_CSV_COLUMNS, SAMPLE_CSV_HEADERS, SAMPLE_CSV_TEMPLATE };

let rowKeySeq = 0;
export function nextRowKey(): string {
  rowKeySeq += 1;
  return `row-${Date.now().toString(36)}-${rowKeySeq}`;
}

export function emptyRow(): PlanogramRow {
  return {
    location: "",
    category: "",
    sub_category: "",
    brand: "",
    product_name: "",
    variant: "",
    expected_qty: 1,
    mrp_inr: undefined,
    avg_daily_sales: undefined,
    sku: "",
    shelf_position: "",
    match_key: "",
  };
}

export function toDraftRow(row: Partial<PlanogramRow> | null | undefined): DraftRow {
  const base = emptyRow();
  const qty = Number(row?.expected_qty);
  return {
    key: nextRowKey(),
    location: String(row?.location ?? "").trim(),
    category: String(row?.category ?? "").trim(),
    sub_category: String(row?.sub_category ?? "").trim(),
    brand: String(row?.brand ?? "").trim(),
    product_name: String(row?.product_name ?? "").trim(),
    variant: String(row?.variant ?? "").trim(),
    sku: String(row?.sku ?? "").trim(),
    expected_qty: Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : base.expected_qty,
    mrp_inr: Number.isFinite(Number(row?.mrp_inr)) ? Number(row?.mrp_inr) : undefined,
    avg_daily_sales: Number.isFinite(Number(row?.avg_daily_sales))
      ? Number(row?.avg_daily_sales)
      : undefined,
    shelf_position: String(row?.shelf_position ?? "").trim(),
    match_key: String(row?.match_key ?? "").trim(),
  };
}

/** True when the signed-in member may create or activate planograms. */
export async function canManagePlanogram(): Promise<boolean> {
  const membership = await getMembership();
  const role = String(membership?.role ?? "").toLowerCase();
  return (PLANOGRAM_MANAGER_ROLES as readonly string[]).includes(role);
}

/* ---------------------------- backend helpers ---------------------------- */

/**
 * Calls a same-origin planogram proxy route (`/api/planogram/*`) which forwards
 * to the Railway vision backend. Going through our own origin avoids the CORS
 * failures that previously surfaced as a generic "Network error", and the real
 * backend message is preserved for the UI.
 */
async function callPlanogramApi<T>(path: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw new Error(
      error instanceof TypeError
        ? "Could not reach the Aislix server. Check your connection and try again — if this persists, contact support."
        : error instanceof Error
          ? error.message
          : "Planogram request failed.",
    );
  }

  const payload = (await response.json().catch(() => null)) as
    (Record<string, unknown> & { detail?: unknown; message?: unknown }) | null;

  if (!response.ok) {
    const detail = payload?.detail ?? payload?.message ?? response.statusText;
    throw new Error(
      typeof detail === "string" && detail.trim()
        ? detail
        : `Planogram service returned ${response.status}: ${JSON.stringify(detail)}`,
    );
  }
  return payload as T;
}

/** Fetches the canonical CSV template text from the backend, with a local fallback. */
export async function fetchPlanogramCsvTemplate(): Promise<string> {
  try {
    const response = await fetch("/api/planogram/csv-template", {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return SAMPLE_CSV_TEMPLATE;
    const payload = (await response.json()) as { csv_text?: unknown };
    const text = typeof payload?.csv_text === "string" ? payload.csv_text.trim() : "";
    return text || SAMPLE_CSV_TEMPLATE;
  } catch {
    return SAMPLE_CSV_TEMPLATE;
  }
}

/** Returns the first required CSV column missing from the header row, if any. */
export function missingCsvColumn(csvText: string): string | null {
  const header = (csvText.split(/\r?\n/)[0] ?? "")
    .split(",")
    .map((cell) => cell.trim().toLowerCase().replace(/\s+/g, "_"));
  for (const column of REQUIRED_CSV_COLUMNS) {
    if (!header.includes(column)) return column;
  }
  return null;
}

export async function parsePlanogramCsv(file: File): Promise<CsvParseResult> {
  const csvText = await file.text();
  if (!csvText.trim()) throw new Error("This CSV file is empty.");
  const missing = missingCsvColumn(csvText);
  if (missing) throw new Error(`Missing required column: ${missing}`);
  const payload = await callPlanogramApi<CsvParseResult>("/api/planogram/parse-csv", {
    csv_text: csvText,
    filename: file.name,
  });
  return {
    rows: Array.isArray(payload?.rows) ? payload.rows : [],
    errors: Array.isArray(payload?.errors) ? payload.errors.map(String) : [],
    valid_count: Number(payload?.valid_count ?? 0),
    error_count: Number(payload?.error_count ?? 0),
  };
}

export async function normalizePlanogramRow(input: PlanogramRow): Promise<DraftRow> {
  const payload = await callPlanogramApi<{ row?: Partial<PlanogramRow> }>(
    "/api/planogram/normalize-row",
    input,
  );
  return toDraftRow(payload?.row ?? input);
}

/* ------------------------------- versions -------------------------------- */

export type StoreOption = { id: string; name: string; code: string | null };

export async function fetchPlanogramStores(): Promise<StoreOption[]> {
  const orgId = await requireOrgId();
  const { data, error } = await supabase
    .from("stores")
    .select("id, name, code")
    .eq("org_id", orgId)
    .order("name", { ascending: true });
  if (error) dbError(error, "Could not load your stores.");
  return (data ?? []) as StoreOption[];
}

async function fetchVersionByStatus(
  storeId: string,
  status: "active" | "draft",
): Promise<PlanogramVersion | null> {
  const orgId = await requireOrgId();
  const { data, error } = await supabase
    .from("planogram_versions")
    .select("id, store_id, name, status, source_type, row_count, activated_at, created_at")
    .eq("org_id", orgId)
    .eq("store_id", storeId)
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) dbError(error, "Could not load the planogram for this store.");
  return (data as PlanogramVersion | null) ?? null;
}

export function fetchActivePlanogram(storeId: string): Promise<PlanogramVersion | null> {
  return fetchVersionByStatus(storeId, "active");
}

export function fetchDraftPlanogram(storeId: string): Promise<PlanogramVersion | null> {
  return fetchVersionByStatus(storeId, "draft");
}

export async function fetchPlanogramItems(versionId: string): Promise<DraftRow[]> {
  const { data, error } = await supabase
    .from("planogram_items")
    .select(
      "location, category, sub_category, brand, product_name, variant, sku, expected_qty, shelf_position, match_key",
    )
    .eq("version_id", versionId)
    .order("created_at", { ascending: true });
  if (error) dbError(error, "Could not load planogram products.");
  return (data ?? []).map((row) => toDraftRow(row as Partial<PlanogramRow>));
}

export type PlanogramSnapshot = {
  active: PlanogramVersion | null;
  activeRows: DraftRow[];
  draft: PlanogramVersion | null;
  draftRows: DraftRow[];
};

export async function fetchPlanogramSnapshot(storeId: string): Promise<PlanogramSnapshot> {
  const [active, draft] = await Promise.all([
    fetchActivePlanogram(storeId),
    fetchDraftPlanogram(storeId),
  ]);
  const [activeRows, draftRows] = await Promise.all([
    active ? fetchPlanogramItems(active.id) : Promise.resolve([]),
    draft ? fetchPlanogramItems(draft.id) : Promise.resolve([]),
  ]);
  return { active, activeRows, draft, draftRows };
}

export type SourceType = "csv" | "manual" | "mixed";

/** Creates or reuses the store's draft version and replaces its items. */
export async function savePlanogramDraft(input: {
  storeId: string;
  rows: DraftRow[];
  sourceType: SourceType;
  sourceFilename?: string | null;
}): Promise<PlanogramVersion> {
  const orgId = await requireOrgId();
  const userId = await requireUserId();
  const existing = await fetchDraftPlanogram(input.storeId);

  let version = existing;
  if (version) {
    const { data, error } = await supabase
      .from("planogram_versions")
      .update({
        source_type: input.sourceType,
        row_count: input.rows.length,
        source_filename: input.sourceFilename ?? null,
      })
      .eq("id", version.id)
      .select("id, store_id, name, status, source_type, row_count, activated_at, created_at")
      .single();
    if (error) dbError(error, "Could not save the planogram draft.");
    version = data as PlanogramVersion;

    const { error: deleteError } = await supabase
      .from("planogram_items")
      .delete()
      .eq("version_id", version.id);
    if (deleteError) dbError(deleteError, "Could not update the planogram draft.");
  } else {
    const { data, error } = await supabase
      .from("planogram_versions")
      .insert({
        org_id: orgId,
        store_id: input.storeId,
        name: "Planogram draft",
        status: "draft",
        source_type: input.sourceType,
        uploaded_by: userId,
        source_filename: input.sourceFilename ?? null,
        row_count: input.rows.length,
      })
      .select("id, store_id, name, status, source_type, row_count, activated_at, created_at")
      .single();
    if (error) dbError(error, "Could not create the planogram draft.");
    version = data as PlanogramVersion;
  }

  if (input.rows.length) {
    const { error } = await supabase.from("planogram_items").insert(
      input.rows.map((row) => ({
        version_id: version!.id,
        org_id: orgId,
        store_id: input.storeId,
        location: row.location,
        aisle: null,
        category: row.category,
        sub_category: row.sub_category,
        brand: row.brand,
        product_name: row.product_name,
        variant: row.variant || null,
        sku: row.sku || null,
        expected_qty: row.expected_qty,
        mrp_inr: row.mrp_inr ?? null,
        avg_daily_sales: row.avg_daily_sales ?? null,
        shelf_position: row.shelf_position || null,
        match_key: row.match_key || null,
      })),
    );
    if (error) dbError(error, "Could not save planogram products.");
  }

  return version!;
}

/** Archives the current active version and promotes the draft. */
export async function activatePlanogram(input: {
  storeId: string;
  versionId: string;
  rowCount: number;
}): Promise<PlanogramVersion> {
  const orgId = await requireOrgId();

  const { error: archiveError } = await supabase
    .from("planogram_versions")
    .update({ status: "archived" })
    .eq("org_id", orgId)
    .eq("store_id", input.storeId)
    .eq("status", "active");
  if (archiveError) dbError(archiveError, "Could not archive the previous planogram.");

  const { data, error } = await supabase
    .from("planogram_versions")
    .update({
      status: "active",
      activated_at: new Date().toISOString(),
      row_count: input.rowCount,
      name: `Planogram · ${new Date().toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })}`,
    })
    .eq("id", input.versionId)
    .select("id, store_id, name, status, source_type, row_count, activated_at, created_at")
    .single();
  if (error) dbError(error, "Could not activate the planogram.");
  return data as PlanogramVersion;
}

/* ------------------------------- hierarchy ------------------------------- */

export type HierarchyNode = {
  category: string;
  subCategories: Array<{
    sub_category: string;
    products: Array<{
      brand: string;
      product_name: string;
      expected_qty: number;
      location: string;
      shelf_position: string;
    }>;
  }>;
};

export function buildHierarchy(rows: DraftRow[]): HierarchyNode[] {
  const categories = new Map<string, Map<string, DraftRow[]>>();
  for (const row of rows) {
    const category = row.category || "Uncategorised";
    const sub = row.sub_category || "General";
    if (!categories.has(category)) categories.set(category, new Map());
    const subs = categories.get(category)!;
    if (!subs.has(sub)) subs.set(sub, []);
    subs.get(sub)!.push(row);
  }
  return [...categories.entries()].map(([category, subs]) => ({
    category,
    subCategories: [...subs.entries()].map(([sub_category, items]) => ({
      sub_category,
      products: items.map((item) => ({
        brand: item.brand,
        product_name: item.product_name,
        expected_qty: item.expected_qty,
        location: item.location,
        shelf_position: item.shelf_position,
      })),
    })),
  }));
}

/* ------------------------------ shared scope ----------------------------- */

function modeOf(values: Array<string | null | undefined>): string {
  const counts = new Map<string, number>();
  for (const value of values) {
    const trimmed = String(value ?? "").trim();
    if (!trimmed) continue;
    counts.set(trimmed, (counts.get(trimmed) ?? 0) + 1);
  }
  let best = "";
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

export type DominantScope = {
  category: string;
  sub_category: string;
  location: string;
  productCount: number;
  facingCount: number;
};

/**
 * Dominant category / sub-category / location of a set of expected products,
 * plus product and facing totals. Shared by New Scan, Store Master and
 * Assign Scan so every surface labels a planogram the same way.
 */
export function dominantScopeFromRows(
  rows: Array<Pick<PlanogramRow, "category" | "sub_category" | "location" | "expected_qty">>,
): DominantScope {
  return {
    category: modeOf(rows.map((row) => row.category)),
    sub_category: modeOf(rows.map((row) => row.sub_category)),
    location: modeOf(rows.map((row) => row.location)),
    productCount: rows.length,
    facingCount: rows.reduce((sum, row) => sum + (Number(row.expected_qty) || 0), 0),
  };
}

/** Creates a draft planogram version for one assignment and inserts its rows. */
export async function createAssignmentPlanogramVersion(input: {
  storeId: string;
  rows: DraftRow[];
  sourceType: SourceType;
  sourceFilename?: string | null;
}): Promise<string> {
  const orgId = await requireOrgId();
  const userId = await requireUserId();

  const { data: version, error } = await supabase
    .from("planogram_versions")
    .insert({
      org_id: orgId,
      store_id: input.storeId,
      name: `Assignment planogram · ${new Date().toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })}`,
      status: "draft",
      source_type: input.sourceType,
      uploaded_by: userId,
      source_filename: input.sourceFilename ?? null,
      row_count: input.rows.length,
    })
    .select("id")
    .single();
  if (error) dbError(error, "Could not save this assignment's planogram.");

  const versionId = version!.id as string;
  const { error: itemsError } = await supabase.from("planogram_items").insert(
    input.rows.map((row) => ({
      version_id: versionId,
      org_id: orgId,
      store_id: input.storeId,
      location: row.location,
      aisle: row.location || null,
      category: row.category,
      sub_category: row.sub_category,
      brand: row.brand,
      product_name: row.product_name,
      variant: row.variant || null,
      sku: row.sku || null,
      expected_qty: row.expected_qty,
      mrp_inr: row.mrp_inr ?? null,
      avg_daily_sales: row.avg_daily_sales ?? null,
      shelf_position: row.shelf_position || null,
      match_key: row.match_key || null,
    })),
  );
  if (itemsError) dbError(itemsError, "Could not save the assignment's expected products.");

  return versionId;
}
