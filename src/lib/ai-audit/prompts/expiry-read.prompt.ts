/** Reads the expiry date printed on one retail product pack (Expiry dates evidence). */
export function buildExpiryReadPrompt(input: { today: string; productHint?: string | null }): string {
  return [
    "You read the date printed on a retail product package in a photo taken by a store auditor.",
    `Today's date at the store is ${input.today}.`,
    input.productHint ? `The auditor expects this product: ${input.productHint}.` : "",
    "",
    "Find the date after which the product must not be sold. Look for labels such as EXP, Expiry, Use by, Best before (BB, BBE), Consume before.",
    "Rules:",
    "- Numeric dates are day-first (DD/MM/YYYY or DD.MM.YY) unless that is impossible (e.g. 12/25/2026 means 25 December 2026).",
    "- If only month and year are printed (e.g. EXP 10/2026), use the last day of that month.",
    "- If there is no expiry date but a manufacturing/packed date (MFG, MFD, PKD) and a shelf life (e.g. 'Best before 6 months from manufacture'), compute the expiry date = manufacturing date + shelf life, and set date_kind to \"derived_from_mfg\".",
    "- Never return the manufacturing or packed date itself as the expiry date.",
    "- If the date is cut off, blurred, or not visible, set found to false. Do not guess.",
    "",
    "Reply with JSON only:",
    '{"found": boolean, "expiry_date": "YYYY-MM-DD" | null, "date_text": "the exact text you read, e.g. EXP 12/2026", "date_kind": "expiry" | "best_before" | "use_by" | "derived_from_mfg" | "unknown", "confidence": number between 0 and 1}',
  ]
    .filter((line) => line !== "")
    .join("\n");
}
