/**
 * Dashboard roll-ups of the per-field checks shown on the results page: plan vs AI detected,
 * AI vs human verified, and open findings by field. Counts persisted statuses only.
 */

import { astraAnalysisFromScanResult } from "@/lib/ai-audit/astra-response";
import {
  aiFieldValue,
  verifiedFieldValue,
  type FieldVerification,
  type VerificationFieldKey,
} from "@/lib/ai-audit/field-verifications";
import { aiAgrees, buildVerificationRows, fieldResult, VERIFY_FIELDS } from "@/lib/ai-audit/verification-rows";

export type FieldMatchRate = {
  field: VerificationFieldKey;
  label: string;
  matched: number;
  checked: number;
  notVisible: number;
};

export type FieldAccuracy = {
  field: VerificationFieldKey;
  label: string;
  agreed: number;
  verified: number;
};

const MATCH_FIELDS: Array<{ field: VerificationFieldKey; label: string }> = [
  { field: "present", label: "Product found" },
  { field: "brand", label: "Brand" },
  { field: "facings", label: "Facings" },
  { field: "location", label: "Location" },
  { field: "price", label: "Price" },
  { field: "promotion", label: "Promotion" },
];

const FIELD_LABEL = new Map(VERIFY_FIELDS.map((f) => [f.key, f.label]));

/** Planned rows across scans: how often what the AI detected matched the plan, per field. */
export function aggregateFieldMatchRates(metricsList: unknown[]): FieldMatchRate[] {
  const totals = new Map(MATCH_FIELDS.map((f) => [f.field, { ...f, matched: 0, checked: 0, notVisible: 0 }]));
  for (const metrics of metricsList) {
    if (!metrics || typeof metrics !== "object") continue;
    const analysis = astraAnalysisFromScanResult({ metrics: metrics as Record<string, unknown> });
    if (analysis.mode !== "planogram") continue;
    for (const row of buildVerificationRows(analysis)) {
      if (!row.planned) continue;
      for (const f of MATCH_FIELDS) {
        const result = fieldResult(row, f.field, null);
        const t = totals.get(f.field)!;
        if (result === "na") continue;
        if (result === "not_visible") {
          t.notVisible += 1;
          continue;
        }
        t.checked += 1;
        if (result === "match" || (result === "above" && f.field === "facings")) t.matched += 1;
      }
    }
  }
  return [...totals.values()];
}

/** Of the fields humans verified, how often the AI had read the same value. */
export function aggregateAiAccuracy(verifications: FieldVerification[]): FieldAccuracy[] {
  const totals = new Map<VerificationFieldKey, FieldAccuracy>();
  for (const v of verifications) {
    const verified = verifiedFieldValue(v);
    if (verified == null) continue;
    const entry =
      totals.get(v.field_key) ??
      { field: v.field_key, label: FIELD_LABEL.get(v.field_key) ?? v.field_key, agreed: 0, verified: 0 };
    entry.verified += 1;
    if (aiAgrees(v.field_key, aiFieldValue(v), verified)) entry.agreed += 1;
    totals.set(v.field_key, entry);
  }
  return VERIFY_FIELDS.map((f) => totals.get(f.key)).filter((x): x is FieldAccuracy => Boolean(x));
}

const FINDING_FIELD: Record<string, string> = {
  missing_product: "Product found",
  out_of_stock: "Product found",
  low_stock: "Facings / quantity",
  planogram_violation: "Facings / quantity",
  wrong_placement: "Location",
  pricing_issue: "Price",
  display_issue: "Promotion",
};

/** Open findings (one corrective action each) grouped by the field they are about. */
export function openFindingsByField(rows: Array<{ finding_type: string | null }>): { label: string; value: number }[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const label = FINDING_FIELD[row.finding_type ?? ""] ?? "Other shelf issues";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}
