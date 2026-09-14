/**
 * AI-Assisted verification — compare digital actual vs latest AI qty (Wave 5).
 */

import { supabase } from "@/integrations/supabase/client";
import { dbError, requireOrgId } from "@/lib/db/context";

const MISMATCH_THRESHOLD = 2;

export type AiAssistedFlag = {
  line_id: string;
  sku: string;
  product_name: string;
  actual_qty: number;
  ai_suggested_qty: number;
  delta: number;
};

/** Populate ai_suggested_qty from latest AI comparison lines for the store. */
export async function enrichDigitalLinesWithAiSuggestions(scanId: string): Promise<number> {
  const orgId = await requireOrgId();

  const { data: scan } = await supabase
    .from("shelf_scans")
    .select("store_id")
    .eq("id", scanId)
    .maybeSingle();
  if (!scan) return 0;

  const { data: digitalLines } = await supabase
    .from("digital_audit_lines")
    .select("id, sku, product_name, actual_qty")
    .eq("scan_id", scanId);
  if (!digitalLines?.length) return 0;

  const { data: aiScans } = await supabase
    .from("shelf_scans")
    .select("id")
    .eq("org_id", orgId)
    .eq("store_id", scan.store_id as string)
    .eq("audit_mode", "ai")
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(5);

  const aiScanIds = (aiScans ?? []).map((s) => s.id as string);
  if (!aiScanIds.length) return 0;

  const { data: comparisons } = await supabase
    .from("planogram_comparisons")
    .select("id, scan_id")
    .in("scan_id", aiScanIds)
    .order("created_at", { ascending: false })
    .limit(3);

  const comparisonIds = (comparisons ?? []).map((c) => c.id as string);
  if (!comparisonIds.length) return 0;

  const { data: compLines } = await supabase
    .from("planogram_comparison_lines")
    .select("expected_product, actual_qty")
    .in("comparison_id", comparisonIds);

  const aiQtyByProduct = new Map<string, number>();
  for (const line of compLines ?? []) {
    const key = String(line.expected_product ?? "")
      .trim()
      .toLowerCase();
    if (!key) continue;
    aiQtyByProduct.set(key, Number(line.actual_qty) || 0);
  }

  let flagged = 0;
  for (const line of digitalLines) {
    const key = String(line.product_name ?? "")
      .trim()
      .toLowerCase();
    const aiQty = aiQtyByProduct.get(key);
    if (aiQty == null || line.actual_qty == null) continue;

    const actual = Number(line.actual_qty);
    const delta = actual - aiQty;
    const mismatch = Math.abs(delta) > MISMATCH_THRESHOLD;

    await supabase
      .from("digital_audit_lines")
      .update({
        ai_suggested_qty: aiQty,
        ai_assisted_flag: mismatch,
      })
      .eq("id", line.id as string);

    if (mismatch) flagged++;
  }

  return flagged;
}

export async function fetchAiAssistedFlags(scanId: string): Promise<AiAssistedFlag[]> {
  const { data, error } = await supabase
    .from("digital_audit_lines")
    .select("id, sku, product_name, actual_qty, ai_suggested_qty, ai_assisted_flag")
    .eq("scan_id", scanId)
    .eq("ai_assisted_flag", true);
  if (error) dbError(error, "Could not load AI-assisted flags.");

  return (data ?? []).map((row) => ({
    line_id: row.id as string,
    sku: (row.sku as string) ?? "—",
    product_name: row.product_name as string,
    actual_qty: Number(row.actual_qty) || 0,
    ai_suggested_qty: Number(row.ai_suggested_qty) || 0,
    delta: (Number(row.actual_qty) || 0) - (Number(row.ai_suggested_qty) || 0),
  }));
}
