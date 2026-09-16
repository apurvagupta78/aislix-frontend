/**
 * Shared custom-audit helpers with no imports from custom-audit-review.
 * Keeps custom-audit ↔ custom-audit-review free of circular module dependencies.
 */

import type { AuditResponseValue, TemplateDefinition } from "@/lib/audit-builder/types";

export type ResponseMap = Record<string, Record<number, Record<string, AuditResponseValue>>>;

/** Supabase Storage bucket for universal/custom audit evidence uploads. */
export const AUDIT_EVIDENCE_BUCKET = "audit-evidence";
/** Persisted reference prefix — private bucket paths are re-signed on display. */
export const AUDIT_EVIDENCE_REF_PREFIX = "audit-evidence://";

export function isAuditEvidenceRef(value: string): boolean {
  return value.startsWith(AUDIT_EVIDENCE_REF_PREFIX);
}

export function buildRecordContexts(
  definition: TemplateDefinition,
  responses: ResponseMap,
) {
  const records: {
    sectionKey: string;
    recordIndex: number;
    values: Record<string, AuditResponseValue>;
  }[] = [];

  for (const section of definition.sections) {
    const sectionData = responses[section.key] ?? { 0: {} };
    const indices = Object.keys(sectionData).map(Number).sort((a, b) => a - b);
    const idxList = indices.length ? indices : [0];
    for (const idx of idxList) {
      records.push({
        sectionKey: section.key,
        recordIndex: idx,
        values: sectionData[idx] ?? {},
      });
    }
  }
  return records;
}
