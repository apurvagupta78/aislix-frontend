const REPEATED_WORDS = /(^|[\s—(-])(\p{L}[\p{L}\p{N}'&.]*(?:\s+\p{L}[\p{L}\p{N}'&.]*){0,2})\s+\2(?=$|[\s,.;:)])/giu;

/** "Texas Texas Mixed Drops" → "Texas Mixed Drops" (brand prefixed onto a name that already starts with it). */
export function collapseRepeatedWords(text: string): string {
  // Short repeats such as "Bon Bon" are real product names.
  return text.replace(REPEATED_WORDS, (match, lead: string, words: string) =>
    words.replace(/\s/g, "").length >= 4 ? `${lead}${words}` : match,
  );
}

/**
 * Groups the same problem on the same product at the same store across audits.
 * AI findings often have no SKU, so fall back to the product name; whole-shelf
 * findings never count as a repeat of each other.
 */
export function findingRecurrenceKey(finding: {
  id?: string | null;
  store_id?: string | null;
  sku?: string | null;
  product_name?: string | null;
  finding_type?: string | null;
}): string {
  const product =
    finding.sku?.trim().toLowerCase() ||
    collapseRepeatedWords(finding.product_name?.trim() ?? "").toLowerCase() ||
    `finding:${finding.id ?? ""}`;
  return `${finding.store_id ?? ""}|${product}|${finding.finding_type ?? ""}`;
}

/** What a finding is about: the product, the SKU, or the whole shelf for scan-level findings. */
export function findingSubjectLabel(finding: {
  product_name?: string | null;
  sku?: string | null;
}): string {
  const name = finding.product_name?.trim();
  if (name) return collapseRepeatedWords(name);
  return finding.sku?.trim() || "Whole shelf";
}
