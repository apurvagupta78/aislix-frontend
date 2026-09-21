/**
 * Parse Astra FNV QC JSON into a typed disposition result.
 */

export type FnvDisposition = "SELLABLE" | "DAMAGED" | "HUMAN_REVIEW";

export type FnvQcResult = {
  product: string | null;
  category: string | null;
  disposition: FnvDisposition;
  defect_types: string[];
  confidence: number | null;
  notes: string | null;
};

const DISPOSITIONS = new Set<FnvDisposition>(["SELLABLE", "DAMAGED", "HUMAN_REVIEW"]);

export function parseFnvQcPayload(raw: unknown): FnvQcResult {
  const root =
    raw && typeof raw === "object"
      ? ((raw as Record<string, unknown>).result ??
          (raw as Record<string, unknown>).fnv_qc ??
          raw)
      : raw;
  const obj = (root && typeof root === "object" ? root : {}) as Record<string, unknown>;

  const dispositionRaw = String(obj.disposition ?? obj.qc_disposition ?? "HUMAN_REVIEW")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
  const disposition: FnvDisposition = DISPOSITIONS.has(dispositionRaw as FnvDisposition)
    ? (dispositionRaw as FnvDisposition)
    : "HUMAN_REVIEW";

  const defectsRaw = obj.defect_types ?? obj.defects ?? [];
  const defect_types = Array.isArray(defectsRaw)
    ? defectsRaw.map((d) => String(d).trim()).filter(Boolean)
    : [];

  const conf = obj.confidence != null ? Number(obj.confidence) : null;

  return {
    product: obj.product != null ? String(obj.product) : null,
    category: obj.category != null ? String(obj.category) : null,
    disposition,
    defect_types: disposition === "DAMAGED" ? defect_types : disposition === "SELLABLE" ? [] : defect_types,
    confidence: conf != null && Number.isFinite(conf) ? conf : null,
    notes: obj.notes != null ? String(obj.notes) : null,
  };
}
