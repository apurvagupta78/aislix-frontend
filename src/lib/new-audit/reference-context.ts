import {
  referenceDocumentScope,
  referencePayload,
  referenceRowsToPlanogramRows,
} from "@/lib/ai-audit/reference-document";
import type { ScanContextState } from "@/lib/scan-context";

/** The document's own category columns win; otherwise the category chosen in setup. */
export function referenceScope(ctx: ScanContextState) {
  const doc = ctx.reference ? referenceDocumentScope(ctx.reference.rows) : null;
  return {
    category: doc?.category ?? (ctx.planogramMeta?.category?.trim() || null),
    subCategory: doc?.subCategory ?? (ctx.planogramMeta?.sub_category?.trim() || null),
  };
}

/** Scan context whose expected products are the reference document lines. */
export function withReferencePlanogramRows(ctx: ScanContextState): ScanContextState {
  const rows = ctx.reference ? referenceRowsToPlanogramRows(ctx.reference.rows, referenceScope(ctx)) : [];
  return { ...ctx, planogramRows: rows };
}

/** Persisted reference block (scan adhoc payload / assignment template snapshot). */
export function referencePayloadFromContext(ctx: ScanContextState) {
  return ctx.reference ? referencePayload(ctx.reference, referenceScope(ctx)) : null;
}
