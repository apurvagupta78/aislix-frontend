/**
 * Audit Intelligence — variance aggregates, store health, trends (Wave 3).
 */

import { supabase } from "@/integrations/supabase/client";
import { dbError, requireOrgId } from "@/lib/db/context";

export type ExceptionTier = "critical" | "attention" | "normal";

export type VarianceByStore = {
  store_id: string;
  store_name: string;
  audit_count: number;
  total_variance_value_inr: number;
  sku_variance_count: number;
  avg_compliance: number | null;
  health_score: number | null;
};

export type VarianceBySku = {
  sku: string;
  product_name: string;
  store_name: string;
  expected_qty: number;
  actual_qty: number;
  variance_qty: number;
  variance_value_inr: number;
  tier: ExceptionTier;
};

export type AuditTrendPoint = {
  date: string;
  compliance_percent: number | null;
  variance_value_inr: number;
  audit_mode: string;
};

export type AuditIntelligenceSummary = {
  total_audits: number;
  digital_audits: number;
  ai_audits: number;
  total_variance_inr: number;
  critical_exceptions: number;
  attention_exceptions: number;
  by_store: VarianceByStore[];
  top_skus: VarianceBySku[];
  trends: AuditTrendPoint[];
};

const CRITICAL_INR = 10_000;
const ATTENTION_PCT = 5;

function tierForVariance(varianceQty: number, expected: number, valueInr: number): ExceptionTier {
  if (Math.abs(valueInr) >= CRITICAL_INR) return "critical";
  const pct = expected > 0 ? (Math.abs(varianceQty) / expected) * 100 : 100;
  if (pct > ATTENTION_PCT) return "attention";
  return "normal";
}

function healthScore(compliance: number | null, varianceInr: number): number | null {
  if (compliance == null) return null;
  const penalty = Math.min(40, Math.abs(varianceInr) / 500);
  return Math.max(0, Math.round(compliance - penalty));
}

export async function fetchAuditIntelligence(options?: {
  storeId?: string;
  days?: number;
}): Promise<AuditIntelligenceSummary> {
  const orgId = await requireOrgId();
  const days = options?.days ?? 90;
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceIso = since.toISOString();

  let scanQuery = supabase
    .from("shelf_scans")
    .select(
      "id, store_id, audit_mode, submission_status, submitted_at, created_at, planogram_compliance_percent, stores:store_id (name)",
    )
    .eq("org_id", orgId)
    .gte("created_at", sinceIso)
    .in("submission_status", ["approved", "pending_review", "flagged"]);

  if (options?.storeId) scanQuery = scanQuery.eq("store_id", options.storeId);

  const { data: scans, error: scanErr } = await scanQuery;
  if (scanErr) dbError(scanErr, "Could not load audit intelligence.");

  const scanIds = (scans ?? []).map((s) => s.id as string);
  const digitalIds = (scans ?? [])
    .filter((s) => (s as { audit_mode?: string }).audit_mode === "digital")
    .map((s) => s.id as string);

  let lines: Record<string, unknown>[] = [];
  if (digitalIds.length) {
    const { data: lineRows, error: lineErr } = await supabase
      .from("digital_audit_lines")
      .select(
        "scan_id, store_id, sku, product_name, expected_qty, actual_qty, variance_qty, variance_value_inr, stores:store_id (name)",
      )
      .in("scan_id", digitalIds);
    if (lineErr) dbError(lineErr, "Could not load variance lines.");
    lines = lineRows ?? [];
  }

  const storeMap = new Map<string, VarianceByStore>();
  const skuRows: VarianceBySku[] = [];
  let totalVarianceInr = 0;
  let critical = 0;
  let attention = 0;

  for (const line of lines) {
    const varianceQty = Number(line.variance_qty) || 0;
    if (varianceQty === 0) continue;
    const expected = Number(line.expected_qty) || 0;
    const actual = Number(line.actual_qty) || 0;
    const valueInr = Number(line.variance_value_inr) || 0;
    totalVarianceInr += valueInr;
    const tier = tierForVariance(varianceQty, expected, valueInr);
    if (tier === "critical") critical++;
    else if (tier === "attention") attention++;

    const storeId = line.store_id as string;
    const storeName =
      ((line.stores as { name?: string } | null)?.name) ?? "Store";
    const existing = storeMap.get(storeId) ?? {
      store_id: storeId,
      store_name: storeName,
      audit_count: 0,
      total_variance_value_inr: 0,
      sku_variance_count: 0,
      avg_compliance: null,
      health_score: null,
    };
    existing.total_variance_value_inr += valueInr;
    existing.sku_variance_count++;
    storeMap.set(storeId, existing);

    skuRows.push({
      sku: (line.sku as string) ?? "—",
      product_name: line.product_name as string,
      store_name: storeName,
      expected_qty: expected,
      actual_qty: actual,
      variance_qty: varianceQty,
      variance_value_inr: valueInr,
      tier,
    });
  }

  for (const scan of scans ?? []) {
    const storeId = scan.store_id as string;
    const storeName = ((scan.stores as { name?: string } | null)?.name) ?? "Store";
    const existing = storeMap.get(storeId) ?? {
      store_id: storeId,
      store_name: storeName,
      audit_count: 0,
      total_variance_value_inr: 0,
      sku_variance_count: 0,
      avg_compliance: null,
      health_score: null,
    };
    existing.audit_count++;
    const compliance = scan.planogram_compliance_percent as number | null;
    if (compliance != null) {
      existing.avg_compliance =
        existing.avg_compliance == null
          ? compliance
          : (existing.avg_compliance + compliance) / 2;
    }
    existing.health_score = healthScore(existing.avg_compliance, existing.total_variance_value_inr);
    storeMap.set(storeId, existing);
  }

  skuRows.sort((a, b) => Math.abs(b.variance_value_inr) - Math.abs(a.variance_value_inr));

  const trends: AuditTrendPoint[] = (scans ?? [])
    .slice()
    .sort((a, b) =>
      String(a.submitted_at ?? a.created_at).localeCompare(String(b.submitted_at ?? b.created_at)),
    )
    .map((s) => ({
      date: String(s.submitted_at ?? s.created_at).slice(0, 10),
      compliance_percent: s.planogram_compliance_percent as number | null,
      variance_value_inr: 0,
      audit_mode: ((s as { audit_mode?: string }).audit_mode ?? "ai") as string,
    }));

  const digitalCount = (scans ?? []).filter(
    (s) => (s as { audit_mode?: string }).audit_mode === "digital",
  ).length;

  return {
    total_audits: scans?.length ?? 0,
    digital_audits: digitalCount,
    ai_audits: (scans?.length ?? 0) - digitalCount,
    total_variance_inr: Math.round(totalVarianceInr * 100) / 100,
    critical_exceptions: critical,
    attention_exceptions: attention,
    by_store: [...storeMap.values()].sort(
      (a, b) => Math.abs(b.total_variance_value_inr) - Math.abs(a.total_variance_value_inr),
    ),
    top_skus: skuRows.slice(0, 20),
    trends,
  };
}
