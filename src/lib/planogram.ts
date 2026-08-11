/**
 * Store Master / Planogram expected data (Milestone 1).
 *
 * CSV parsing and row normalization run on the Aislix vision backend; drafts,
 * versions and items are persisted in Supabase under the org's RLS policies.
 */

import { supabase } from "@/integrations/supabase/client";
import { api } from "@/lib/api/client";
import { dbError, getMembership, requireOrgId, requireUserId } from "@/lib/db/context";

export type PlanogramRow = {
  location: string;
  aisle: string;
  category: string;
  sub_category: string;
  brand: string;
  product_name: string;
  sku: string;
  expected_qty: number;
  shelf_position: string;
  match_key: string;
};

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

export const SAMPLE_CSV_HEADERS =
  "location,aisle,category,sub_category,brand,product_name,expected_qty";

let rowKeySeq = 0;
export function nextRowKey(): string {
  rowKeySeq += 1;
  return `row-${Date.now().toString(36)}-${rowKeySeq}`;
}

export function emptyRow(): PlanogramRow {
  return {
    location: "",
    aisle: "",
    category: "",
    sub_category: "",
    brand: "",
    product_name: "",
    sku: "",
    expected_qty: 1,
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
    aisle: String(row?.aisle ?? "").trim(),
    category: String(row?.category ?? "").trim(),
    sub_category: String(row?.sub_category ?? "").trim(),
    brand: String(row?.brand ?? "").trim(),
    product_name: String(row?.product_name ?? "").trim(),
    sku: String(row?.sku ?? "").trim(),
    expected_qty: Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : base.expected_qty,
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

export async function parsePlanogramCsv(file: File): Promise<CsvParseResult> {
  const csvText = await file.text();
  const payload = await api.post<CsvParseResult>(
    "/planogram/parse-csv",
    { csv_text: csvText, filename: file.name },
    { anonymous: true },
  );
  return {
    rows: Array.isArray(payload?.rows) ? payload.rows : [],
    errors: Array.isArray(payload?.errors) ? payload.errors.map(String) : [],
    valid_count: Number(payload?.valid_count ?? 0),
    error_count: Number(payload?.error_count ?? 0),
  };
}

export async function normalizePlanogramRow(input: PlanogramRow): Promise<DraftRow> {
  const payload = await api.post<{ row?: Partial<PlanogramRow> }>(
    "/planogram/normalize-row",
    input,
    { anonymous: true },
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
      "location, aisle, category, sub_category, brand, product_name, sku, expected_qty, shelf_position, match_key",
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
        location: row.location || null,
        aisle: row.aisle || null,
        category: row.category,
        sub_category: row.sub_category || null,
        brand: row.brand,
        product_name: row.product_name,
        sku: row.sku || null,
        expected_qty: row.expected_qty,
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
  aisle: string;
  categories: Array<{
    category: string;
    subCategories: Array<{
      sub_category: string;
      products: Array<{ brand: string; product_name: string; expected_qty: number }>;
    }>;
  }>;
};

export function buildHierarchy(rows: DraftRow[]): HierarchyNode[] {
  const aisles = new Map<string, Map<string, Map<string, DraftRow[]>>>();
  for (const row of rows) {
    const aisle = row.aisle || "Unassigned aisle";
    const category = row.category || "Uncategorised";
    const sub = row.sub_category || "General";
    if (!aisles.has(aisle)) aisles.set(aisle, new Map());
    const categories = aisles.get(aisle)!;
    if (!categories.has(category)) categories.set(category, new Map());
    const subs = categories.get(category)!;
    if (!subs.has(sub)) subs.set(sub, []);
    subs.get(sub)!.push(row);
  }
  return [...aisles.entries()].map(([aisle, categories]) => ({
    aisle,
    categories: [...categories.entries()].map(([category, subs]) => ({
      category,
      subCategories: [...subs.entries()].map(([sub_category, items]) => ({
        sub_category,
        products: items.map((item) => ({
          brand: item.brand,
          product_name: item.product_name,
          expected_qty: item.expected_qty,
        })),
      })),
    })),
  }));
}
