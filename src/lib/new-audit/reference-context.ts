import { referencePayload, referenceRowsToPlanogramRows } from "@/lib/ai-audit/reference-document";
import type { ScanContextState } from "@/lib/scan-context";

function scope(ctx: ScanContextState) {
  return {
    category: ctx.planogramMeta?.category ?? null,
    subCategory: ctx.planogramMeta?.sub_category ?? null,
  };
}

/** Scan context whose expected products are the reference document lines. */
export function withReferencePlanogramRows(ctx: ScanContextState): ScanContextState {
  const rows = ctx.reference ? referenceRowsToPlanogramRows(ctx.reference.rows, scope(ctx)) : [];
  return { ...ctx, planogramRows: rows };
}

/** Persisted reference block (scan adhoc payload / assignment template snapshot). */
export function referencePayloadFromContext(ctx: ScanContextState) {
  return ctx.reference ? referencePayload(ctx.reference, scope(ctx)) : null;
}
