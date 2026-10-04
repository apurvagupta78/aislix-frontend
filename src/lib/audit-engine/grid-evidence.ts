import {
  EVIDENCE_PROOF_OPTIONS,
  type AuditEvidencePolicy,
  type EvidenceProof,
} from "@/lib/audit-evidence-policy";
import type { AuditInputDataset } from "@/lib/audit-input-dataset";
import type { AuditResponseValue, TemplateField } from "@/lib/audit-builder/types";
import type { ResponseMap } from "@/lib/custom-audit-shared";

/** Audit-wide proofs (record 0): photos, video, GPS and device details. */
export const AUDIT_EVIDENCE_SECTION = "audit_evidence";
/** One record per shelf: `shelf` name plus before (`shelf_photo`) and `after_photo`. */
export const SHELF_EVIDENCE_SECTION = "shelf_evidence";

export const BARCODE_SCAN_KEY = "barcode_scan";
export const VARIANCE_REASON_KEY = "variance_reason";
export const VARIANCE_NOTE_KEY = "variance_note";
export const ROW_VARIANCE_KEY = "row_variance";

export type AuditUploadKey = "context_photo" | "session_video" | "quarantine_contents" | "sealed_container";
export type ShelfPhotoKey = "shelf_photo" | "after_photo";

export const GPS_KEY = "gps";
export const DEVICE_METADATA_KEY = "device_metadata";
export const EVIDENCE_FLAG_LIST_KEY = "flags";

export type GridEvidenceColumns = { shelfColumnId: string | null; barcodeColumnId: string | null };

export function gridEvidenceColumns(purposeConfig: Record<string, unknown> | null | undefined): GridEvidenceColumns {
  const text = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
  return {
    shelfColumnId: text(purposeConfig?.shelfColumnId),
    barcodeColumnId: text(purposeConfig?.barcodeColumnId),
  };
}

/** Synthetic field used to save evidence values through the normal response upsert. */
export function evidenceField(section: string, key: string, type: TemplateField["type"]): TemplateField {
  return {
    id: `field_${section}_${key}`,
    key,
    type,
    label: key,
    section,
    order: 0,
    required: false,
    config: {},
    fieldRole: "evidence",
    system: true,
  };
}

export type ShelfSlot = { index: number; name: string; label: string };

const SHELF_HEADER = /(shelf|aisle|bay|location|bin|rack|gondola|zone|section|fixture)/i;
const BARCODE_HEADER = /(barcode|ean|upc|gtin)/i;

export function suggestShelfColumn(dataset: AuditInputDataset): string | null {
  return dataset.columns.find((c) => SHELF_HEADER.test(c.name))?.id ?? null;
}

export function suggestBarcodeColumn(dataset: AuditInputDataset): string | null {
  return dataset.columns.find((c) => BARCODE_HEADER.test(c.name))?.id ?? null;
}

/** Distinct shelf names in file order (case-insensitive); empty when no shelf column is set. */
export function distinctShelves(dataset: AuditInputDataset | null | undefined, shelfColumnId: string | null): string[] {
  if (!dataset || !shelfColumnId) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of dataset.rows) {
    const name = (row.values[shelfColumnId] ?? "").trim();
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push(name);
  }
  return out;
}

/** Photo slots: one per shelf in the file, or a single slot for the whole audit. */
export function shelfSlots(dataset: AuditInputDataset | null | undefined, shelfColumnId: string | null): ShelfSlot[] {
  const shelves = distinctShelves(dataset, shelfColumnId);
  if (!shelves.length) return [{ index: 0, name: "", label: "Whole audit area" }];
  return shelves.map((name, index) => ({ index, name, label: name }));
}

export function listValue(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return typeof value === "string" && value.trim() ? [value] : [];
}

export function auditEvidenceValues(responses: ResponseMap): Record<string, AuditResponseValue> {
  return responses[AUDIT_EVIDENCE_SECTION]?.[0] ?? {};
}

/** Saved values for a shelf slot, matched by shelf name so file order changes can't misfile photos. */
export function shelfEvidenceValues(responses: ResponseMap, slot: ShelfSlot): Record<string, AuditResponseValue> {
  const section = responses[SHELF_EVIDENCE_SECTION] ?? {};
  const byName = Object.values(section).find(
    (values) => String(values.shelf ?? "").trim().toLowerCase() === slot.name.toLowerCase(),
  );
  return byName ?? section[slot.index] ?? {};
}

export type GpsFix = { lat: number; lng: number; accuracyM: number | null; capturedAt: string };

export function parseGps(value: unknown): GpsFix | null {
  if (typeof value !== "string" || !value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<GpsFix>;
    if (typeof parsed.lat !== "number" || typeof parsed.lng !== "number") return null;
    return {
      lat: parsed.lat,
      lng: parsed.lng,
      accuracyM: typeof parsed.accuracyM === "number" ? parsed.accuracyM : null,
      capturedAt: String(parsed.capturedAt ?? ""),
    };
  } catch {
    return null;
  }
}

export type DeviceMetadata = {
  userAgent: string | null;
  platform: string | null;
  language: string | null;
  timezone: string | null;
  screen: string | null;
  openedAt: string;
};

export function parseDeviceMetadata(value: unknown): DeviceMetadata | null {
  if (typeof value !== "string" || !value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<DeviceMetadata>;
    return parsed.openedAt ? (parsed as DeviceMetadata) : null;
  } catch {
    return null;
  }
}

export function collectDeviceMetadata(): DeviceMetadata {
  const nav = typeof navigator !== "undefined" ? navigator : null;
  let timezone: string | null = null;
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    timezone = null;
  }
  return {
    userAgent: nav?.userAgent ?? null,
    platform: (nav as (Navigator & { userAgentData?: { platform?: string } }) | null)?.userAgentData?.platform ?? nav?.platform ?? null,
    language: nav?.language ?? null,
    timezone,
    screen: typeof window !== "undefined" ? `${window.screen.width}x${window.screen.height}` : null,
    openedAt: new Date().toISOString(),
  };
}

const normalizeCode = (code: string) => code.replace(/\s+/g, "").toLowerCase();

export function barcodeMatches(expected: string, scanned: string): boolean {
  return normalizeCode(expected) === normalizeCode(scanned);
}

export type GridEvidenceRow = {
  index: number;
  position: number;
  values: Record<string, AuditResponseValue | undefined>;
  hasMismatch: boolean;
  rowEvidenceStatus: "verified" | "needs_review" | "missing" | "not_required";
};

export type GridRequirementId = EvidenceProof | "variance_explanation";

export type GridRequirement = {
  id: GridRequirementId;
  label: string;
  hint: string;
  done: number;
  total: number;
  ok: boolean;
  missing: string[];
};

const labelOf = (proof: EvidenceProof) => EVIDENCE_PROOF_OPTIONS.find((o) => o.value === proof)?.label ?? proof;
const rowLabel = (row: GridEvidenceRow) => `Row ${row.position + 1}`;

/** Expected barcode for a row, read from the manager's file. */
export function rowExpectedBarcode(
  dataset: AuditInputDataset | null | undefined,
  barcodeColumnId: string | null,
  rowIndex: number,
): string | null {
  if (!dataset || !barcodeColumnId) return null;
  const value = (dataset.rows[rowIndex]?.values[barcodeColumnId] ?? "").trim();
  return value || null;
}

/**
 * Every evidence requirement for a spreadsheet audit, in the order the manager sees them.
 * Used to guide the auditee, block submit, and mirror the server-side check.
 */
export function evaluateGridEvidence(input: {
  policy: Partial<AuditEvidencePolicy> | null | undefined;
  requireRca: boolean;
  dataset: AuditInputDataset | null | undefined;
  columns: GridEvidenceColumns;
  rows: GridEvidenceRow[];
  responses: ResponseMap;
}): GridRequirement[] {
  const proofs = new Set<EvidenceProof>(input.policy?.requiredProof ?? []);
  const audit = auditEvidenceValues(input.responses);
  const slots = shelfSlots(input.dataset, input.columns.shelfColumnId);
  const out: GridRequirement[] = [];
  const single = (proof: EvidenceProof, hint: string, has: boolean) =>
    out.push({ id: proof, label: labelOf(proof), hint, done: has ? 1 : 0, total: 1, ok: has, missing: has ? [] : [labelOf(proof)] });

  for (const proof of EVIDENCE_PROOF_OPTIONS.map((o) => o.value)) {
    if (!proofs.has(proof)) continue;
    switch (proof) {
      case "context_photo":
        single(proof, "One photo showing the whole area you audited.", listValue(audit.context_photo).length > 0);
        break;
      case "shelf_photo":
      case "before_after": {
        const keys: ShelfPhotoKey[] = proof === "shelf_photo" ? ["shelf_photo"] : ["shelf_photo", "after_photo"];
        const missing = slots.filter((slot) => {
          const values = shelfEvidenceValues(input.responses, slot);
          return keys.some((k) => listValue(values[k]).length === 0);
        });
        const perShelf = slots.length > 1 || slots[0]?.name;
        out.push({
          id: proof,
          label: labelOf(proof),
          hint:
            proof === "shelf_photo"
              ? perShelf
                ? "Add one photo for every shelf listed below."
                : "Add a photo of the shelf you audited."
              : perShelf
                ? "For every shelf: a photo before you fix anything and one after."
                : "A photo before you fix anything and one after.",
          done: slots.length - missing.length,
          total: slots.length,
          ok: missing.length === 0,
          missing: missing.map((s) => s.label),
        });
        break;
      }
      case "per_sku_photo":
      case "variance_photo": {
        const needed = input.rows.filter((r) => proof === "per_sku_photo" || r.hasMismatch);
        const missing = needed.filter((r) => r.rowEvidenceStatus === "missing");
        out.push({
          id: proof,
          label: labelOf(proof),
          hint:
            proof === "per_sku_photo"
              ? "Add a photo in the Evidence column on every row."
              : needed.length
                ? "Add a photo on every row where your value differs from the provided one."
                : "No differences so far — only needed when your value differs from the provided one.",
          done: needed.length - missing.length,
          total: needed.length,
          ok: missing.length === 0,
          missing: missing.map(rowLabel),
        });
        break;
      }
      case "barcode": {
        const needed = input.rows.filter((r) => rowExpectedBarcode(input.dataset, input.columns.barcodeColumnId, r.index));
        const missing = needed.filter((r) => !String(r.values[BARCODE_SCAN_KEY] ?? "").trim());
        out.push({
          id: proof,
          label: labelOf(proof),
          hint: !input.columns.barcodeColumnId
            ? "No barcode column was chosen for this audit — nothing to scan."
            : needed.length
              ? "Scan the barcode on every row that has one."
              : "No row has a barcode in the file — nothing to scan.",
          done: needed.length - missing.length,
          total: needed.length,
          ok: missing.length === 0,
          missing: missing.map(rowLabel),
        });
        break;
      }
      case "gps":
        single(proof, "Allow location access so the audit location is recorded.", parseGps(audit[GPS_KEY]) !== null);
        break;
      case "device_metadata":
        out.push({
          id: proof,
          label: labelOf(proof),
          hint: "Recorded automatically when you open and submit the audit.",
          done: 1,
          total: 1,
          ok: true,
          missing: [],
        });
        break;
      case "live_session_video":
        single(proof, "Record the audit walk on your phone, or upload a short video.", listValue(audit.session_video).length > 0);
        break;
      case "quarantine_contents":
        single(proof, "Photo of removed or held stock.", listValue(audit.quarantine_contents).length > 0);
        break;
      case "sealed_container":
        single(proof, "Photo of the sealed bag / container showing the seal ID.", listValue(audit.sealed_container).length > 0);
        break;
    }
  }

  if (input.requireRca) {
    const varianceRows = input.rows.filter((r) => r.hasMismatch);
    const missing = varianceRows.filter((r) => {
      const reason = String(r.values[VARIANCE_REASON_KEY] ?? "").trim();
      if (!reason) return true;
      return reason === "other" && !String(r.values[VARIANCE_NOTE_KEY] ?? "").trim();
    });
    out.push({
      id: "variance_explanation",
      label: "Explanation for every difference",
      hint: varianceRows.length
        ? "Pick a reason on every row where your value differs. “Other” also needs a note."
        : "No differences so far.",
      done: varianceRows.length - missing.length,
      total: varianceRows.length,
      ok: missing.length === 0,
      missing: missing.map(rowLabel),
    });
  }
  return out;
}
