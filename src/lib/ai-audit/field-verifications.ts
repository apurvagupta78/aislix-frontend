/**
 * Human verification of AI fields per product row (presence, brand, product, facings, units,
 * location, price, promotion). AI values stay immutable; operational actual = verified ?? ai.
 * Saving a verification that disproves an AI finding moves its corrective action to
 * "Resolved by verification" for manager approval (database trigger).
 */

import { supabase } from "@/integrations/supabase/client";
import { dbError, requireOrgId, requireUserId } from "@/lib/db/context";

export type VerificationFieldKey =
  | "present"
  | "brand"
  | "product"
  | "facings"
  | "visible_units"
  | "location"
  | "price"
  | "promotion";

export const TEXT_VERIFICATION_FIELDS: ReadonlySet<VerificationFieldKey> = new Set([
  "brand",
  "product",
  "location",
  "promotion",
]);

export type FieldVerification = {
  id: string;
  scan_id: string;
  row_key: string;
  detected_product_id: string | null;
  field_key: VerificationFieldKey;
  ai_value: number | null;
  verified_value: number | null;
  ai_text: string | null;
  verified_text: string | null;
  verified_by: string | null;
  verified_at: string | null;
};

const SELECT_COLUMNS =
  "id, scan_id, row_key, detected_product_id, field_key, ai_value, verified_value, ai_text, verified_text, verified_by, verified_at";

/** Prefer verified when present; else AI; else null (N/A). */
export function operationalActual(
  ai: number | null | undefined,
  verified: number | null | undefined,
): number | null {
  if (verified != null && Number.isFinite(Number(verified))) return Number(verified);
  if (ai != null && Number.isFinite(Number(ai))) return Number(ai);
  return null;
}

/** The human value of a verification row (text fields use verified_text). */
export function verifiedFieldValue(v: FieldVerification | undefined): string | number | null {
  if (!v) return null;
  if (TEXT_VERIFICATION_FIELDS.has(v.field_key)) return v.verified_text?.trim() ? v.verified_text.trim() : null;
  return v.verified_value == null ? null : Number(v.verified_value);
}

export function aiFieldValue(v: FieldVerification): string | number | null {
  if (TEXT_VERIFICATION_FIELDS.has(v.field_key)) return v.ai_text?.trim() ? v.ai_text.trim() : null;
  return v.ai_value == null ? null : Number(v.ai_value);
}

export async function listScanFieldVerifications(scanId: string): Promise<FieldVerification[]> {
  const { data, error } = await supabase
    .from("scan_field_verifications" as never)
    .select(SELECT_COLUMNS)
    .eq("scan_id", scanId);
  if (error) {
    console.error("[verifications] list failed", error.message);
    return [];
  }
  return (data ?? []) as FieldVerification[];
}

/** Batch load verifications for many scans (dashboard / reports). */
export async function listScanFieldVerificationsForScans(
  scanIds: string[],
): Promise<FieldVerification[]> {
  const ids = [...new Set(scanIds.filter(Boolean))];
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from("scan_field_verifications" as never)
    .select(SELECT_COLUMNS)
    .in("scan_id", ids.slice(0, 100));
  if (error) {
    console.error("[verifications] batch list failed", error.message);
    return [];
  }
  return (data ?? []) as FieldVerification[];
}

export type VerificationChange = {
  fieldKey: VerificationFieldKey;
  aiValue: string | number | null;
  verifiedValue: string | number | null;
};

export async function saveRowVerifications(input: {
  scanId: string;
  rowKey: string;
  detectedProductId: string | null;
  identity: { brand: string | null; product: string | null; variant: string | null };
  changes: VerificationChange[];
}): Promise<void> {
  if (!input.changes.length) return;
  for (const change of input.changes) {
    if (TEXT_VERIFICATION_FIELDS.has(change.fieldKey)) continue;
    const n = change.verifiedValue;
    if (n != null && (!Number.isFinite(Number(n)) || Number(n) < 0)) {
      throw new Error("Verified numbers must be 0 or more.");
    }
  }
  const orgId = await requireOrgId();
  const userId = await requireUserId();
  const now = new Date().toISOString();
  const rows = input.changes.map((change) => {
    const text = TEXT_VERIFICATION_FIELDS.has(change.fieldKey);
    const asText = (v: string | number | null) => (v == null || String(v).trim() === "" ? null : String(v).trim());
    const asNum = (v: string | number | null) => (v == null || v === "" ? null : Number(v));
    return {
      org_id: orgId,
      scan_id: input.scanId,
      row_key: input.rowKey,
      detected_product_id: input.detectedProductId,
      brand: input.identity.brand,
      product_name: input.identity.product,
      variant: input.identity.variant,
      field_key: change.fieldKey,
      ai_value: text ? null : asNum(change.aiValue),
      verified_value: text ? null : asNum(change.verifiedValue),
      ai_text: text ? asText(change.aiValue) : null,
      verified_text: text ? asText(change.verifiedValue) : null,
      verified_by: userId,
      verified_at: now,
      updated_at: now,
    };
  });
  const { error } = await supabase
    .from("scan_field_verifications" as never)
    .upsert(rows as never, { onConflict: "scan_id,row_key,field_key" });
  if (error) dbError(error, "Could not save verification.");
}

export function verificationMap(rows: FieldVerification[]): Map<string, FieldVerification> {
  const map = new Map<string, FieldVerification>();
  for (const row of rows) map.set(`${row.row_key}:${row.field_key}`, row);
  return map;
}
