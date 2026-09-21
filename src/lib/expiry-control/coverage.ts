/**
 * Expiry evidence coverage — Required Units = physical units needing verification
 * (never planogram/expected stock). Complete/Verified only at 100%.
 */

export type ExpiryCoverageInput = {
  /** Physical units requiring expiry check (Astra-detected or verified count / digital qty). */
  requiredUnits: number | null;
  /** Distinct physical units with valid verified expiry + linked evidence. */
  verifiedUnits: number | null;
};

export type ExpiryCoverageResult = {
  requiredUnits: number | null;
  verifiedUnits: number | null;
  coveragePct: number | null;
  complete: boolean;
  statusLabel: "EVIDENCE INCOMPLETE" | "Expiry Verified" | "N/A";
};

export function computeExpiryEvidenceCoverage(input: ExpiryCoverageInput): ExpiryCoverageResult {
  const required =
    input.requiredUnits != null && Number.isFinite(input.requiredUnits)
      ? Math.max(0, Math.round(input.requiredUnits))
      : null;
  const verified =
    input.verifiedUnits != null && Number.isFinite(input.verifiedUnits)
      ? Math.max(0, Math.round(input.verifiedUnits))
      : null;

  if (required == null || required <= 0) {
    return {
      requiredUnits: required,
      verifiedUnits: verified,
      coveragePct: null,
      complete: false,
      statusLabel: "N/A",
    };
  }

  const verifiedSafe = verified ?? 0;
  const coveragePct = (verifiedSafe / required) * 100;
  const complete = coveragePct >= 100;

  return {
    requiredUnits: required,
    verifiedUnits: verifiedSafe,
    coveragePct,
    complete,
    statusLabel: complete ? "Expiry Verified" : "EVIDENCE INCOMPLETE",
  };
}

/** Prefer human physical count when present; else Astra/actual physical; never expected/planogram. */
export function resolveExpiryRequiredUnits(input: {
  physicalCount?: number | null;
  actualQuantity?: number | null;
  astraDetectedUnits?: number | null;
}): number | null {
  if (input.physicalCount != null && Number.isFinite(input.physicalCount)) {
    return Math.max(0, Number(input.physicalCount));
  }
  if (input.astraDetectedUnits != null && Number.isFinite(input.astraDetectedUnits)) {
    return Math.max(0, Number(input.astraDetectedUnits));
  }
  if (input.actualQuantity != null && Number.isFinite(input.actualQuantity)) {
    return Math.max(0, Number(input.actualQuantity));
  }
  return null;
}
