/**
 * Human verification of AI numeric fields (facings / visible_units).
 * AI values stay immutable; operational actual = verified ?? ai.
 */

import { supabase } from "@/integrations/supabase/client";
import { dbError, requireOrgId, requireUserId } from "@/lib/db/context";

export type VerificationFieldKey = "facings" | "visible_units";

export type FieldVerification = {
  id: string;
  scan_id: string;
  detected_product_id: string | null;
  field_key: VerificationFieldKey;
  ai_value: number | null;
  verified_value: number | null;
  verified_by: string | null;
  verified_at: string | null;
};

/** Prefer verified when present; else AI; else null (N/A). */
export function operationalActual(
  ai: number | null | undefined,
  verified: number | null | undefined,
): number | null {
  if (verified != null && Number.isFinite(Number(verified))) return Number(verified);
  if (ai != null && Number.isFinite(Number(ai))) return Number(ai);
  return null;
}

export async function listScanFieldVerifications(
  scanId: string,
): Promise<FieldVerification[]> {
  const { data, error } = await supabase
    .from("scan_field_verifications" as never)
    .select(
      "id, scan_id, detected_product_id, field_key, ai_value, verified_value, verified_by, verified_at",
    )
    .eq("scan_id", scanId);
  if (error) {
    // Table may not be applied yet — fail soft.
    console.error("[verifications] list failed", error.message);
    return [];
  }
  return (data ?? []) as FieldVerification[];
}

export async function upsertFieldVerification(input: {
  scanId: string;
  detectedProductId: string | null;
  fieldKey: VerificationFieldKey;
  aiValue: number | null;
  verifiedValue: number | null;
}): Promise<void> {
  const orgId = await requireOrgId();
  const userId = await requireUserId();
  const now = new Date().toISOString();

  const { error } = await supabase.from("scan_field_verifications" as never).upsert(
    {
      org_id: orgId,
      scan_id: input.scanId,
      detected_product_id: input.detectedProductId,
      field_key: input.fieldKey,
      ai_value: input.aiValue,
      verified_value: input.verifiedValue,
      verified_by: userId,
      verified_at: now,
      updated_at: now,
    } as never,
    { onConflict: "scan_id,detected_product_id,field_key" },
  );
  if (error) dbError(error, "Could not save verification.");
}

export function verificationMap(
  rows: FieldVerification[],
): Map<string, FieldVerification> {
  const map = new Map<string, FieldVerification>();
  for (const row of rows) {
    map.set(`${row.detected_product_id ?? "scan"}:${row.field_key}`, row);
  }
  return map;
}
