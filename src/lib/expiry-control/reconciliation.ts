/** Quantity reconciliation — client-side validation mirroring server rules. */

export type ReconciliationInput = {
  physicalCount: number | null;
  sellable: number;
  remove: number;
  unresolved: number;
  observationsRecorded: number;
};

export type ReconciliationResult =
  | { ok: true; equation: string }
  | { ok: false; reason: string; equation: string };

export function checkReconciliation(input: ReconciliationInput): ReconciliationResult {
  const { physicalCount, sellable, remove, unresolved, observationsRecorded } = input;
  const sum = sellable + remove + unresolved;
  const equation = `${physicalCount ?? "?"} = ${sellable} sellable + ${remove} remove + ${unresolved} unresolved (${observationsRecorded} observations)`;

  if (physicalCount == null) {
    return { ok: false, reason: "Physical count is required.", equation };
  }
  if (physicalCount !== sum) {
    return {
      ok: false,
      reason: "Physical count must equal sellable + remove + unresolved.",
      equation,
    };
  }
  if (observationsRecorded !== physicalCount) {
    return {
      ok: false,
      reason: "Every physical unit must have a recorded observation.",
      equation,
    };
  }
  return { ok: true, equation };
}

export function canMarkSellable(input: {
  unreadable: boolean;
  classification: string;
  dateType?: string | null;
  hasShelfLifeRule?: boolean;
}): boolean {
  if (input.unreadable) return false;
  if (input.classification === "unresolved") return false;
  if (input.dateType === "manufacturing" && !input.hasShelfLifeRule) return false;
  return true;
}
