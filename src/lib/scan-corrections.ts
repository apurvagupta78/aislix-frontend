/**
 * Accuracy correction loop.
 *
 * Ops fix a wrong SKU on the scan results page; every fix is appended to
 * `scan_corrections` and can be exported as JSON for the backend benchmark
 * importer. Corrections never block scan completion.
 */

import { supabase } from "@/integrations/supabase/client";
import { dbError, requireOrgId, requireUserId } from "@/lib/db/context";
import type { FacingBox } from "@/lib/scan-results";
import { downloadBlob } from "@/lib/scan-results";

export type ScanCorrectionInput = {
  scan_id: string;
  box?: FacingBox | undefined;
  corrected_brand: string;
  corrected_product: string;
  corrected_variant?: string | undefined;
  corrected_ocr_label?: string | undefined;
  predicted_brand?: string | undefined;
  predicted_product?: string | undefined;
  pack_text?: string | undefined;
  category?: string | undefined;
  sub_category?: string | undefined;
};

export type ScanCorrection = {
  id: string;
  scan_id: string;
  x1: number | null;
  y1: number | null;
  x2: number | null;
  y2: number | null;
  corrected_brand: string | null;
  corrected_product: string | null;
  corrected_variant: string | null;
  corrected_ocr_label: string | null;
  predicted_brand: string | null;
  predicted_product: string | null;
  pack_text: string | null;
  category: string | null;
  sub_category: string | null;
  created_at: string;
};

const COLUMNS =
  "id, scan_id, x1, y1, x2, y2, corrected_brand, corrected_product, corrected_variant, corrected_ocr_label, predicted_brand, predicted_product, pack_text, category, sub_category, created_at";

/** Appends one correction row for the active workspace. */
export async function saveScanCorrection(input: ScanCorrectionInput): Promise<ScanCorrection> {
  const [orgId, userId] = await Promise.all([requireOrgId(), requireUserId()]);
  const { data, error } = await supabase
    .from("scan_corrections")
    .insert({
      org_id: orgId,
      created_by: userId,
      scan_id: input.scan_id,
      x1: input.box ? Math.round(input.box.x1) : null,
      y1: input.box ? Math.round(input.box.y1) : null,
      x2: input.box ? Math.round(input.box.x2) : null,
      y2: input.box ? Math.round(input.box.y2) : null,
      corrected_brand: input.corrected_brand,
      corrected_product: input.corrected_product,
      corrected_variant: input.corrected_variant ?? null,
      corrected_ocr_label: input.corrected_ocr_label ?? null,
      predicted_brand: input.predicted_brand ?? null,
      predicted_product: input.predicted_product ?? null,
      pack_text: input.pack_text ?? null,
      category: input.category ?? null,
      sub_category: input.sub_category ?? null,
    })
    .select(COLUMNS)
    .single();
  if (error) dbError(error, "Could not save this correction.");
  return data as unknown as ScanCorrection;
}

/** Corrections already recorded for one scan. */
export async function fetchScanCorrections(scanId: string): Promise<ScanCorrection[]> {
  const orgId = await requireOrgId();
  const { data, error } = await supabase
    .from("scan_corrections")
    .select(COLUMNS)
    .eq("org_id", orgId)
    .eq("scan_id", scanId)
    .order("created_at", { ascending: false });
  if (error) dbError(error, "Could not load corrections for this audit.");
  return (data ?? []) as unknown as ScanCorrection[];
}

/** Every correction in the workspace, newest first (training export source). */
export async function fetchOrgCorrections(limit = 5000): Promise<ScanCorrection[]> {
  const orgId = await requireOrgId();
  const { data, error } = await supabase
    .from("scan_corrections")
    .select(COLUMNS)
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) dbError(error, "Could not load corrections.");
  return (data ?? []) as unknown as ScanCorrection[];
}

/** Shape the backend's `import_corrections_to_manifest.py` expects. */
export function correctionsToTrainingJson(rows: ScanCorrection[]): string {
  return JSON.stringify(
    rows.map((row) => ({
      scan_id: row.scan_id,
      bbox:
        row.x1 !== null && row.y1 !== null && row.x2 !== null && row.y2 !== null
          ? { x1: row.x1, y1: row.y1, x2: row.x2, y2: row.y2 }
          : null,
      corrected: {
        brand: row.corrected_brand,
        product_name: row.corrected_product,
        variant: row.corrected_variant,
        ocr_label: row.corrected_ocr_label,
      },
      predicted: {
        brand: row.predicted_brand,
        product_name: row.predicted_product,
        pack_text: row.pack_text,
      },
      category: row.category,
      sub_category: row.sub_category,
      created_at: row.created_at,
    })),
    null,
    2,
  );
}

/** Downloads the workspace corrections as a JSON file. Returns the row count. */
export async function exportCorrectionsJson(): Promise<number> {
  const rows = await fetchOrgCorrections();
  const stamp = new Date().toISOString().slice(0, 10);
  downloadBlob(
    correctionsToTrainingJson(rows),
    `aislix-corrections-${stamp}.json`,
    "application/json",
  );
  return rows.length;
}

/** Brand / product suggestions from the workspace's learned catalog. */
export async function fetchCatalogSuggestions(): Promise<{
  brands: string[];
  products: string[];
}> {
  const orgId = await requireOrgId();
  const { data } = await supabase
    .from("learned_skus")
    .select("brand, name")
    .eq("org_id", orgId)
    .limit(2000);
  const brands = new Set<string>();
  const products = new Set<string>();
  for (const row of (data ?? []) as Array<{ brand: string | null; name: string | null }>) {
    if (row.brand) brands.add(row.brand);
    if (row.name) products.add(row.name);
  }
  return {
    brands: Array.from(brands).sort(),
    products: Array.from(products).sort(),
  };
}
