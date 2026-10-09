/**
 * The five corrective-action checks for AI and Digital audits:
 * AI vs actual quantity, expected vs actual location, extra facings vs planogram,
 * changes implemented, and pre- vs post-audit shelf scores. Aggregates persisted rows only.
 */

import { supabase } from "@/integrations/supabase/client";
import { actionStage } from "@/lib/corrective-action-catalog";
import { actionVarianceType } from "@/lib/corrective-action-insights";
import { slaOutcome, type SlaAction } from "@/lib/sla-insights";

export type CheckAction = SlaAction & {
  before_score: number | null;
  after_score: number | null;
  verification_status: string | null;
  suggestion?: string | null;
};

export type QuantityVerification = {
  scanId: string;
  storeId: string | null;
  field: "visible_units" | "facings";
  ai: number;
  actual: number;
  product: string;
  verifiedAt: string | null;
};

/** A product on the shelf that the planogram does not include, or facings above plan. */
export function isExtraFacing(a: { issue_type?: string | null; title?: string | null; suggestion?: string | null }): boolean {
  const issue = (a.issue_type ?? "").toLowerCase();
  if (/unexpected|unplanned|extra_facing|not_in_plan/.test(issue)) return true;
  const text = `${a.title ?? ""} ${a.suggestion ?? ""}`.toLowerCase();
  return /extra facing|more facings than|above plan|not in (the )?plan(ogram)?|unplanned product/.test(text);
}

/** Variance filter values on the Corrective actions page, beyond the variance types. */
export function matchesCheck(a: CheckAction, check: string): boolean {
  switch (check) {
    case "extra_facings":
      return isExtraFacing(a);
    case "implemented": {
      const s = actionStage(a.status);
      return s === "verified" || s === "closed";
    }
    case "pre_post":
      return a.before_score != null && a.after_score != null;
    default:
      return true;
  }
}

export type AuditChecks = {
  quantity: { checked: number; differ: number; avgGap: number | null; openActions: number };
  location: { total: number; open: number };
  extraFacings: { total: number; open: number };
  implemented: { total: number; done: number; pending: number; onTime: number; late: number };
  prePost: { compared: number; avgBefore: number | null; avgAfter: number | null; improvedPct: number | null };
};

const isOpen = (a: CheckAction) => {
  const s = actionStage(a.status);
  return s !== "verified" && s !== "closed";
};

const avg = (values: number[]) =>
  values.length ? Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10 : null;

export function auditChecks(actions: CheckAction[], verifications: QuantityVerification[], now = Date.now()): AuditChecks {
  const differ = verifications.filter((v) => v.ai !== v.actual);
  const location = actions.filter((a) => actionVarianceType(a) === "location");
  const extra = actions.filter((a) => isExtraFacing(a));
  const done = actions.filter((a) => !isOpen(a));
  let onTime = 0;
  let late = 0;
  for (const a of done) {
    const o = slaOutcome(a, now);
    if (o === "met") onTime += 1;
    else if (o === "breached") late += 1;
  }
  const compared = actions.filter((a) => a.before_score != null && a.after_score != null);
  return {
    quantity: {
      checked: verifications.length,
      differ: differ.length,
      avgGap: avg(differ.map((v) => Math.abs(v.actual - v.ai))),
      openActions: actions.filter((a) => actionVarianceType(a) === "quantity" && isOpen(a)).length,
    },
    location: { total: location.length, open: location.filter(isOpen).length },
    extraFacings: { total: extra.length, open: extra.filter(isOpen).length },
    implemented: { total: actions.length, done: done.length, pending: actions.length - done.length, onTime, late },
    prePost: {
      compared: compared.length,
      avgBefore: avg(compared.map((a) => a.before_score as number)),
      avgAfter: avg(compared.map((a) => a.after_score as number)),
      improvedPct: compared.length
        ? Math.round((compared.filter((a) => (a.after_score as number) > (a.before_score as number)).length / compared.length) * 100)
        : null,
    },
  };
}

/** Human-verified counts next to the AI count, for scans in these stores and dates. */
export async function fetchQuantityVerifications(input: {
  orgId: string;
  stores: Set<string> | null;
  from: Date | null;
  to: Date | null;
}): Promise<QuantityVerification[]> {
  let q = supabase
    .from("scan_field_verifications" as never)
    .select("scan_id, field_key, ai_value, verified_value, product_name, brand, verified_at")
    .eq("org_id", input.orgId)
    .in("field_key", ["visible_units", "facings"])
    .not("verified_value", "is", null)
    .order("verified_at", { ascending: false })
    .limit(2000);
  if (input.from) q = q.gte("verified_at", input.from.toISOString());
  if (input.to) q = q.lt("verified_at", input.to.toISOString());
  const { data, error } = await q;
  if (error) return [];
  const rows = (data ?? []) as unknown as Array<{
    scan_id: string;
    field_key: "visible_units" | "facings";
    ai_value: number | null;
    verified_value: number | null;
    product_name: string | null;
    brand: string | null;
    verified_at: string | null;
  }>;
  const scanIds = [...new Set(rows.map((r) => r.scan_id))];
  const storeByScan = new Map<string, string | null>();
  for (let i = 0; i < scanIds.length; i += 200) {
    const { data: scans } = await supabase
      .from("shelf_scans")
      .select("id, store_id")
      .in("id", scanIds.slice(i, i + 200));
    for (const s of scans ?? []) storeByScan.set(s.id as string, (s.store_id as string | null) ?? null);
  }
  return rows
    .filter((r) => r.ai_value != null && r.verified_value != null)
    .map((r) => ({
      scanId: r.scan_id,
      storeId: storeByScan.get(r.scan_id) ?? null,
      field: r.field_key,
      ai: Number(r.ai_value),
      actual: Number(r.verified_value),
      product: [r.brand, r.product_name].filter(Boolean).join(" ") || "Product",
      verifiedAt: r.verified_at,
    }))
    .filter((v) => !input.stores || (v.storeId != null && input.stores.has(v.storeId)));
}
