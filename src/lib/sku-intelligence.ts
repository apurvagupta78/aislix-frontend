/**
 * Cross-store SKU intelligence — variance, recurrence, and store distribution.
 */

import { supabase } from "@/integrations/supabase/client";
import { dbError, requireOrgId } from "@/lib/db/context";
import type { ExceptionTier } from "@/lib/audit-intelligence";

export type SkuStoreFinding = {
  store_id: string;
  store_name: string;
  shelf_label: string;
  expected_qty: number;
  actual_qty: number;
  variance_qty: number;
  variance_value_inr: number;
  scan_id: string;
  captured_at: string;
  tier: ExceptionTier;
};

export type SkuAggregate = {
  sku: string;
  product_name: string;
  barcode: string | null;
  category: string | null;
  store_count: number;
  finding_count: number;
  total_variance_qty: number;
  total_variance_value_inr: number;
  worst_tier: ExceptionTier;
  stores: SkuStoreFinding[];
};

const CRITICAL_INR = 10_000;

function tier(valueInr: number): ExceptionTier {
  return Math.abs(valueInr) >= CRITICAL_INR ? "critical" : Math.abs(valueInr) > 0 ? "attention" : "normal";
}

export async function fetchSkuIntelligence(options?: {
  storeId?: string;
  search?: string;
  days?: number;
  limit?: number;
}): Promise<SkuAggregate[]> {
  const orgId = await requireOrgId();
  const days = options?.days ?? 90;
  const since = new Date();
  since.setDate(since.getDate() - days);

  let query = supabase
    .from("digital_audit_lines")
    .select(
      "id, sku, product_name, barcode, category, location, expected_qty, actual_qty, variance_qty, variance_value_inr, scan_id, store_id, updated_at, stores:store_id (name)",
    )
    .eq("org_id", orgId)
    .gte("updated_at", since.toISOString())
    .not("variance_qty", "is", null)
    .neq("variance_qty", 0);

  if (options?.storeId && options.storeId !== "all") {
    query = query.eq("store_id", options.storeId);
  }

  const { data, error } = await query.order("updated_at", { ascending: false }).limit(500);
  if (error) dbError(error, "Could not load SKU intelligence.");

  const bySku = new Map<string, SkuAggregate>();

  for (const row of data ?? []) {
    const skuKey = ((row.sku as string) || (row.product_name as string) || row.id) as string;
    const search = options?.search?.trim().toLowerCase();
    if (
      search &&
      !skuKey.toLowerCase().includes(search) &&
      !String(row.product_name ?? "").toLowerCase().includes(search) &&
      !String(row.barcode ?? "").toLowerCase().includes(search)
    ) {
      continue;
    }

    const valueInr = Number(row.variance_value_inr) || 0;
    const finding: SkuStoreFinding = {
      store_id: row.store_id as string,
      store_name: ((row.stores as { name?: string })?.name) ?? "Store",
      shelf_label: (row.location as string) || "Shelf",
      expected_qty: Number(row.expected_qty) || 0,
      actual_qty: Number(row.actual_qty) || 0,
      variance_qty: Number(row.variance_qty) || 0,
      variance_value_inr: valueInr,
      scan_id: row.scan_id as string,
      captured_at: row.updated_at as string,
      tier: tier(valueInr),
    };

    const existing = bySku.get(skuKey) ?? {
      sku: skuKey,
      product_name: (row.product_name as string) || skuKey,
      barcode: (row.barcode as string) ?? null,
      category: (row.category as string) ?? null,
      store_count: 0,
      finding_count: 0,
      total_variance_qty: 0,
      total_variance_value_inr: 0,
      worst_tier: "normal" as ExceptionTier,
      stores: [] as SkuStoreFinding[],
    };

    existing.finding_count++;
    existing.total_variance_qty += finding.variance_qty;
    existing.total_variance_value_inr += valueInr;
    existing.stores.push(finding);
    if (finding.tier === "critical") existing.worst_tier = "critical";
    else if (finding.tier === "attention" && existing.worst_tier !== "critical") {
      existing.worst_tier = "attention";
    }
    bySku.set(skuKey, existing);
  }

  const aggregates = [...bySku.values()].map((agg) => ({
    ...agg,
    store_count: new Set(agg.stores.map((s) => s.store_id)).size,
    stores: agg.stores.sort(
      (a, b) => Math.abs(b.variance_value_inr) - Math.abs(a.variance_value_inr),
    ),
  }));

  aggregates.sort(
    (a, b) => Math.abs(b.total_variance_value_inr) - Math.abs(a.total_variance_value_inr),
  );

  return aggregates.slice(0, options?.limit ?? 50);
}

export async function fetchSkuDetail(sku: string): Promise<SkuAggregate | null> {
  const all = await fetchSkuIntelligence({ search: sku, limit: 100 });
  return all.find((a) => a.sku === sku || a.product_name === sku) ?? all[0] ?? null;
}
