import {
  EVIDENCE_PROOF_OPTIONS,
  policyMinimumPhotos,
  policyNearExpiryDays,
  type AuditEvidencePolicy,
  type EvidenceProof,
} from "@/lib/audit-evidence-policy";
import { localIsoDate, rowExpiryState } from "@/lib/audit-engine/expiry-evidence";
import { haversineMeters } from "@/lib/geo/distance";
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

export type StoreCheck = "at_store" | "near_store" | "outside" | "store_location_missing";

export type GpsFix = {
  lat: number;
  lng: number;
  accuracyM: number | null;
  capturedAt: string;
  address?: string | null;
  storeCheck?: StoreCheck | null;
  storeDistanceM?: number | null;
  storeRadiusM?: number | null;
};

const STORE_CHECKS = new Set<StoreCheck>(["at_store", "near_store", "outside", "store_location_missing"]);

export type StoreLocation = { lat: number | null; lng: number | null; radiusM: number | null };

/**
 * Is the auditee at the assigned store? Within the store radius = at the store; within the radius
 * plus the phone's reported GPS accuracy (capped at 150 m) = near the store; otherwise outside.
 */
export function storeCheckFor(
  fix: { lat: number; lng: number; accuracyM: number | null },
  store: StoreLocation | null | undefined,
): { storeCheck: StoreCheck; storeDistanceM: number | null; storeRadiusM: number | null } {
  if (!store || store.lat == null || store.lng == null) {
    return { storeCheck: "store_location_missing", storeDistanceM: null, storeRadiusM: null };
  }
  const radius = store.radiusM && store.radiusM > 0 ? store.radiusM : 200;
  const distance = Math.round(haversineMeters(store.lat, store.lng, fix.lat, fix.lng));
  const slack = Math.min(150, Math.max(0, fix.accuracyM ?? 0));
  return {
    storeCheck: distance <= radius ? "at_store" : distance <= radius + slack ? "near_store" : "outside",
    storeDistanceM: distance,
    storeRadiusM: radius,
  };
}

export function parseGps(value: unknown): GpsFix | null {
  if (typeof value !== "string" || !value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<GpsFix>;
    if (typeof parsed.lat !== "number" || typeof parsed.lng !== "number") return null;
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
    return {
      lat: parsed.lat,
      lng: parsed.lng,
      accuracyM: num(parsed.accuracyM),
      capturedAt: String(parsed.capturedAt ?? ""),
      address: typeof parsed.address === "string" && parsed.address.trim() ? parsed.address : null,
      storeCheck: parsed.storeCheck && STORE_CHECKS.has(parsed.storeCheck) ? parsed.storeCheck : null,
      storeDistanceM: num(parsed.storeDistanceM),
      storeRadiusM: num(parsed.storeRadiusM),
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
  /** Barcode the row should have (from the manager's file), when known. */
  barcodeExpected?: string | null;
};

export type GridRequirementId = EvidenceProof | "variance_explanation" | "expired_removal";

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
  /** Store-local date used to judge expiry; defaults to the device's today. */
  today?: string;
}): GridRequirement[] {
  const proofs = new Set<EvidenceProof>(input.policy?.requiredProof ?? []);
  const audit = auditEvidenceValues(input.responses);
  const slots = shelfSlots(input.dataset, input.columns.shelfColumnId);
  const minPhotos = policyMinimumPhotos(input.policy);
  const photoCount = minPhotos > 1 ? `at least ${minPhotos} photos` : "a photo";
  const out: GridRequirement[] = [];
  const single = (proof: EvidenceProof, hint: string, has: boolean) =>
    out.push({ id: proof, label: labelOf(proof), hint, done: has ? 1 : 0, total: 1, ok: has, missing: has ? [] : [labelOf(proof)] });
  const enoughPhotos = (value: unknown) => listValue(value).length >= minPhotos;

  for (const proof of EVIDENCE_PROOF_OPTIONS.map((o) => o.value)) {
    if (!proofs.has(proof)) continue;
    switch (proof) {
      case "context_photo":
        single(
          proof,
          minPhotos > 1 ? `${minPhotos} photos showing the whole area you audited.` : "One photo showing the whole area you audited.",
          enoughPhotos(audit.context_photo),
        );
        break;
      case "shelf_photo":
      case "before_after": {
        const keys: ShelfPhotoKey[] = proof === "shelf_photo" ? ["shelf_photo"] : ["shelf_photo", "after_photo"];
        const missing = slots.filter((slot) => {
          const values = shelfEvidenceValues(input.responses, slot);
          return keys.some((k) => !enoughPhotos(values[k]));
        });
        const perShelf = slots.length > 1 || slots[0]?.name;
        out.push({
          id: proof,
          label: labelOf(proof),
          hint:
            proof === "shelf_photo"
              ? perShelf
                ? `Add ${photoCount} for every shelf listed below.`
                : `Add ${photoCount} of the shelf you audited.`
              : perShelf
                ? `For every shelf: ${photoCount} before you fix anything and ${photoCount} after.`
                : `${photoCount.charAt(0).toUpperCase()}${photoCount.slice(1)} before you fix anything and ${photoCount} after.`,
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
              ? `Add ${photoCount} in the Evidence column on every row.`
              : needed.length
                ? `Add ${photoCount} on every row where your value differs from the provided one.`
                : "No differences so far — only needed when your value differs from the provided one.",
          done: needed.length - missing.length,
          total: needed.length,
          ok: missing.length === 0,
          missing: missing.map(rowLabel),
        });
        break;
      }
      case "barcode": {
        const scanned = (r: GridEvidenceRow) => String(r.values[BARCODE_SCAN_KEY] ?? "").trim();
        const unscanned = input.rows.filter((r) => !scanned(r));
        const mismatched = input.policy?.blockBarcodeMismatch
          ? input.rows.filter((r) => scanned(r) && r.barcodeExpected && !barcodeMatches(r.barcodeExpected, scanned(r)))
          : [];
        const bad = unscanned.length + mismatched.length;
        out.push({
          id: proof,
          label: labelOf(proof),
          hint: !input.rows.length
            ? "No product rows yet — nothing to scan."
            : input.policy?.blockBarcodeMismatch
              ? "Scan the barcode on every product row. It must match the expected barcode."
              : "Scan the barcode on every product row.",
          done: input.rows.length - bad,
          total: input.rows.length,
          ok: bad === 0,
          missing: [...unscanned.map(rowLabel), ...mismatched.map((r) => `${rowLabel(r)} (doesn't match)`)],
        });
        break;
      }
      case "expiry_date": {
        const today = input.today ?? localIsoDate();
        const nearDays = policyNearExpiryDays(input.policy);
        const states = input.rows.map((r) => ({ row: r, state: rowExpiryState(r.values, today, nearDays) }));
        const missing = states.filter((s) => s.state.dateMissing);
        out.push({
          id: proof,
          label: labelOf(proof),
          hint: "Photograph the expiry date on every product in the Expiry date column. AI reads it — check the date.",
          done: states.length - missing.length,
          total: states.length,
          ok: missing.length === 0,
          missing: missing.map((s) => rowLabel(s.row)),
        });
        const expired = states.filter((s) => s.state.status === "expired");
        if (expired.length) {
          const notRemoved = expired.filter((s) => s.state.removalMissing);
          out.push({
            id: "expired_removal",
            label: "Expired items removed",
            hint: "Take every expired product off the shelf, tick Removed and add a photo.",
            done: expired.length - notRemoved.length,
            total: expired.length,
            ok: notRemoved.length === 0,
            missing: notRemoved.map((s) => rowLabel(s.row)),
          });
        }
        break;
      }
      case "gps": {
        const fix = parseGps(audit[GPS_KEY]);
        const outside = Boolean(input.policy?.blockOutsideStore) && fix?.storeCheck === "outside";
        if (outside) {
          out.push({
            id: proof,
            label: labelOf(proof),
            hint: "You must be at the store to submit. Go to the store, then tap Update location.",
            done: 0,
            total: 1,
            ok: false,
            missing: ["Outside the store area"],
          });
        } else {
          single(proof, "Your location is recorded automatically — allow location access if asked.", fix !== null);
        }
        break;
      }
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
        single(proof, "Record the audit walk live in Aislix — date, time and GPS are stamped on the video.", listValue(audit.session_video).length > 0);
        break;
      case "quarantine_contents":
        single(
          proof,
          minPhotos > 1 ? `${minPhotos} photos of removed or held stock.` : "Photo of removed or held stock.",
          enoughPhotos(audit.quarantine_contents),
        );
        break;
      case "sealed_container":
        single(
          proof,
          minPhotos > 1
            ? `${minPhotos} photos of the sealed bag / container showing the seal ID.`
            : "Photo of the sealed bag / container showing the seal ID.",
          enoughPhotos(audit.sealed_container),
        );
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
