export type EvidenceLevel = "basic" | "standard" | "high" | "custom";

export type EvidenceProof =
  | "context_photo"
  | "per_sku_photo"
  | "variance_photo"
  | "before_after"
  | "barcode"
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
    description: "Shows the inspected area and scope.",
  },
  {
    value: "per_sku_photo",
    label: "Per-SKU photo",
    description: "At least one clear image for every SKU.",
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
    description: "Confirm product identity where available.",
  },
  { value: "gps", label: "GPS location", description: "Capture availability and accuracy." },
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
