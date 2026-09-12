/** Canonical promotion CSV schema — must match backend app/planogram_package_csv.PROMOTION_HEADERS. */

export const PROMOTION_CSV_HEADERS =
  "promotion_id,participating_skus,start_date,end_date,required_location,expected_offer_text,expected_promo_price,required_facings";

export const PROMOTION_CSV_REQUIRED_LABEL =
  "promotion_id (Promotion Name), participating_skus (Products Included)";

export const PROMOTION_CSV_OPTIONAL_LABEL =
  "start_date (Start Date), end_date (End Date), required_location (Display Location), expected_offer_text (Offer Text), expected_promo_price (Promotional Price), required_facings (Required Facings)";

export const PROMOTION_CSV_TEMPLATE = [
  PROMOTION_CSV_HEADERS,
  'SUMMER-SALE,"COL-MAX-150|PEP-GER-150",2026-09-01,2026-09-30,Shelf 2 end cap,Buy 2 Save 10%,3.59,4',
  'WEEKEND-OFFER,COL-MAX-150,2026-10-01,2026-10-07,Shelf tag,Weekend special,2.99,3',
].join("\n");

export function formatPromotionDate(iso?: string): string {
  if (!iso?.trim()) return "—";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatPromotionDateRange(start?: string, end?: string): string {
  const from = formatPromotionDate(start);
  const until = formatPromotionDate(end);
  if (from === "—" && until === "—") return "—";
  if (until === "—") return from;
  if (from === "—") return `Until ${until}`;
  return `${from} – ${until}`;
}

export type PromotionStatusLabel = "Active" | "Upcoming" | "Ended" | "—";

export function promotionStatusLabel(start?: string, end?: string): PromotionStatusLabel {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDate = start?.trim() ? new Date(start) : null;
  const endDate = end?.trim() ? new Date(end) : null;
  if (startDate && !Number.isNaN(startDate.getTime())) startDate.setHours(0, 0, 0, 0);
  if (endDate && !Number.isNaN(endDate.getTime())) endDate.setHours(0, 0, 0, 0);
  if (!startDate && !endDate) return "—";
  if (startDate && today < startDate) return "Upcoming";
  if (endDate && today > endDate) return "Ended";
  return "Active";
}

export function formatParticipatingProducts(skus: string[]): string {
  if (!skus.length) return "—";
  return skus.join(", ");
}
