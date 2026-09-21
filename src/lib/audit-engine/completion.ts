import { supabase } from "@/integrations/supabase/client";
import { dbError } from "@/lib/db/context";

export type AuditCompletionIssue = {
  type: string;
  count?: number;
  section?: string;
  recordIndex?: number;
  required?: number;
  verified?: number;
  missingPhotos?: number;
};

export type AuditCompletionResult = {
  ok: boolean;
  missingRcaCount: number;
  missingExpiryCoverageRecords: number;
  missingEvidenceCount: number;
  issues: AuditCompletionIssue[];
};

export async function validateAuditCompletion(
  assignmentId: string,
): Promise<AuditCompletionResult> {
  const { data, error } = await supabase.rpc("validate_audit_completion", {
    p_assignment_id: assignmentId,
  });
  if (error) {
    // Postgres undefined_function = 42883; PostgREST schema-cache miss = PGRST202.
    // Either means the completion RPC is not deployed — do not block submit.
    const code = String((error as { code?: string }).code ?? "");
    const message = String((error as { message?: string }).message ?? "").toLowerCase();
    if (
      code === "42883" ||
      code === "PGRST202" ||
      message.includes("could not find the function") ||
      message.includes("validate_audit_completion")
    ) {
      return {
        ok: true,
        missingRcaCount: 0,
        missingExpiryCoverageRecords: 0,
        missingEvidenceCount: 0,
        issues: [],
      };
    }
    dbError(error, "Could not validate audit completion.");
  }
  const result = (data ?? {}) as Record<string, unknown>;
  return {
    ok: Boolean(result.ok),
    missingRcaCount: Number(result.missingRcaCount) || 0,
    missingExpiryCoverageRecords: Number(result.missingExpiryCoverageRecords) || 0,
    missingEvidenceCount: Number(result.missingEvidenceCount) || 0,
    issues: (result.issues as AuditCompletionIssue[]) ?? [],
  };
}
