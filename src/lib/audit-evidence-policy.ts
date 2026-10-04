export type EvidenceLevel = "basic" | "standard" | "high" | "custom";

export type EvidenceProof =
  | "context_photo"
  | "shelf_photo"
  | "per_sku_photo"
  | "variance_photo"
  | "before_after"
  | "barcode"
  | "expiry_date"
  | "gps"
  | "device_metadata"
  | "live_session_video"
  | "quarantine_contents"
  | "sealed_container";

export type AuditEvidencePolicy = {
  level: EvidenceLevel;
  requiredProof: EvidenceProof[];
  captureSource: "in_app_only" | "import_allowed" | "either";
  minimumPhotos: number;
  /** Expiry dates: a product expiring within this many days is flagged "Near expiry". */
  nearExpiryDays?: number;
  maximumEvidenceAgeMinutes: number;
  qualityChecks: Array<"blur" | "dark" | "glare" | "duplicate_hash" | "similarity_review">;
  reviewMode: "none" | "manager" | "independent" | "supervisor_receipt";
};

export const EVIDENCE_PROOF_OPTIONS: Array<{
  value: EvidenceProof;
  label: string;
  description: string;
}> = [
  {
    value: "context_photo",
    label: "Contextual shelf photo",
    description: "One overall photo of the inspected area and scope.",
  },
  {
    value: "shelf_photo",
    label: "Evidence per shelf",
    description: "One photo for every shelf / location in the audit.",
  },
  {
    value: "per_sku_photo",
    label: "Per-row (SKU) photo",
    description: "At least one clear photo on every row.",
  },
  {
    value: "variance_photo",
    label: "Per-variance photo",
    description: "Required whenever expected and actual differ.",
  },
  {
    value: "before_after",
    label: "Before and after",
    description: "Proof before correction and after action.",
  },
  {
    value: "barcode",
    label: "Barcode scan",
    description: "Scan the barcode on every product row to confirm it's the right item.",
  },
  {
    value: "expiry_date",
    label: "Expiry dates",
    description: "Photo of the expiry date on every product. AI reads it; expired items must be removed.",
  },
  {
    value: "gps",
    label: "GPS location",
    description: "Recorded automatically with the address and a check that the auditee is at the store.",
  },
  {
    value: "device_metadata",
    label: "Time and device metadata",
    description: "Capture time, receipt time and device context.",
  },
  {
    value: "live_session_video",
    label: "Session video",
    description: "Record the audit for later manager review.",
  },
  {
    value: "quarantine_contents",
    label: "Quarantine contents",
    description: "Show removed or held stock.",
  },
  {
    value: "sealed_container",
    label: "Sealed container",
    description: "Show bag/container and seal ID.",
  },
];

export const EVIDENCE_PRESETS: Record<Exclude<EvidenceLevel, "custom">, AuditEvidencePolicy> = {
  basic: {
    level: "basic",
    requiredProof: ["context_photo"],
    captureSource: "either",
    minimumPhotos: 1,
    maximumEvidenceAgeMinutes: 120,
    qualityChecks: ["duplicate_hash"],
    reviewMode: "manager",
  },
  standard: {
    level: "standard",
    requiredProof: ["context_photo", "variance_photo", "device_metadata"],
    captureSource: "either",
    minimumPhotos: 1,
    maximumEvidenceAgeMinutes: 60,
    qualityChecks: ["blur", "dark", "duplicate_hash"],
    reviewMode: "manager",
  },
  high: {
    level: "high",
    requiredProof: [
      "context_photo",
      "shelf_photo",
      "per_sku_photo",
      "variance_photo",
      "barcode",
      "gps",
      "device_metadata",
      "live_session_video",
    ],
    captureSource: "in_app_only",
    minimumPhotos: 1,
    maximumEvidenceAgeMinutes: 15,
    qualityChecks: ["blur", "dark", "glare", "duplicate_hash", "similarity_review"],
    reviewMode: "independent",
  },
};

export function policyForLevel(level: EvidenceLevel): AuditEvidencePolicy {
  if (level === "custom") return { ...EVIDENCE_PRESETS.standard, level: "custom" };
  const preset = EVIDENCE_PRESETS[level];
  return {
    ...preset,
    requiredProof: [...preset.requiredProof],
    qualityChecks: [...preset.qualityChecks],
  };
}

export type RowPhotoMode = "required" | "on_mismatch" | "optional";

/** Row photo rule for spreadsheet audits, derived from the selected proofs. */
export function rowEvidenceFromPolicy(policy: Pick<AuditEvidencePolicy, "requiredProof">): RowPhotoMode {
  if (policy.requiredProof.includes("per_sku_photo")) return "required";
  if (policy.requiredProof.includes("variance_photo")) return "on_mismatch";
  return "optional";
}

/** Evidence per shelf needs the file column that names each shelf. */
export function policyNeedsShelfColumn(policy: Pick<AuditEvidencePolicy, "requiredProof">): boolean {
  return policy.requiredProof.includes("shelf_photo");
}

/** Before and after is taken per shelf when a shelf column is set, otherwise once for the audit. */
export function policyUsesShelfColumn(policy: Pick<AuditEvidencePolicy, "requiredProof">): boolean {
  return policyNeedsShelfColumn(policy) || policy.requiredProof.includes("before_after");
}

/** Minimum Evidences: photos needed for every photo requirement (at least 1). */
export function policyMinimumPhotos(policy: Partial<Pick<AuditEvidencePolicy, "minimumPhotos">> | null | undefined): number {
  const n = Math.round(Number(policy?.minimumPhotos));
  return Number.isFinite(n) && n > 1 ? n : 1;
}

export type QualityCheck = AuditEvidencePolicy["qualityChecks"][number];

export const QUALITY_CHECK_OPTIONS: Array<{ value: QualityCheck; label: string; description: string }> = [
  { value: "blur", label: "Blurry photos", description: "Rejected — the auditee retakes it." },
  { value: "dark", label: "Dark photos", description: "Rejected — the auditee retakes it." },
  { value: "glare", label: "Glare / washed out", description: "Rejected — the auditee retakes it." },
  { value: "duplicate_hash", label: "Same photo twice", description: "Rejected — every photo must be new." },
  { value: "similarity_review", label: "Very similar photos", description: "Allowed, but flagged for the reviewer." },
];

/** 0 = no limit. */
export const PHOTO_AGE_OPTIONS = [0, 5, 15, 30, 60, 120, 240];

export function photoAgeLabel(minutes: number): string {
  if (!minutes) return "No limit";
  if (minutes < 60) return `${minutes} minutes`;
  const hours = minutes / 60;
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

export type ReviewMode = AuditEvidencePolicy["reviewMode"];

export const REVIEW_MODE_OPTIONS: Array<{ value: ReviewMode; label: string; description: string }> = [
  { value: "manager", label: "Manager review", description: "Any manager approves, flags or rejects the submitted audit." },
  {
    value: "independent",
    label: "Independent reviewer",
    description: "Only the person you choose can approve it. They're notified when it's submitted.",
  },
  {
    value: "supervisor_receipt",
    label: "Supervisor receipt",
    description: "A manager only confirms they received it — no approve or reject step.",
  },
  { value: "none", label: "No additional review", description: "Approved automatically when the auditee submits." },
];

export const DEFAULT_NEAR_EXPIRY_DAYS = 7;

export function policyNearExpiryDays(policy: Partial<Pick<AuditEvidencePolicy, "nearExpiryDays">> | null | undefined): number {
  const days = Number(policy?.nearExpiryDays);
  return Number.isFinite(days) && days >= 0 ? Math.round(days) : DEFAULT_NEAR_EXPIRY_DAYS;
}

export function policyNeedsBarcodeColumn(policy: Pick<AuditEvidencePolicy, "requiredProof">): boolean {
  return policy.requiredProof.includes("barcode");
}

export function mergeTemplateMinimum(
  selected: AuditEvidencePolicy,
  minimum?: Partial<AuditEvidencePolicy> | null,
): AuditEvidencePolicy {
  if (!minimum) return selected;
  return {
    ...selected,
    requiredProof: [...new Set([...(minimum.requiredProof ?? []), ...selected.requiredProof])],
    qualityChecks: [...new Set([...(minimum.qualityChecks ?? []), ...selected.qualityChecks])],
    minimumPhotos: Math.max(selected.minimumPhotos, minimum.minimumPhotos ?? 0),
  };
}
