/** Canonical shelf price CSV schema — must match backend app/planogram_package_csv.PRICE_HEADERS. */

export const PRICE_CSV_HEADERS =
  "sku,label_location,expected_price,currency,price_basis,valid_from,valid_to";

export const PRICE_CSV_REQUIRED_LABEL =
  "sku (Product / SKU), expected_price (Expected Price)";

export const PRICE_CSV_OPTIONAL_LABEL =
  "label_location (Price Label Location), currency, price_basis (Per item / pack / kg / litre), valid_from (Start Date), valid_to (End Date)";

export const PRICE_CSV_TEMPLATE = [
  PRICE_CSV_HEADERS,
  "COL-MAX-150,shelf_tag,3.59,USD,item,2026-09-01,",
  "PEP-GER-150,shelf_tag,4.29,USD,item,2026-09-01,2026-12-31",
].join("\n");

export const SHELF_PRICE_CURRENCIES = [
  { code: "USD", label: "USD — US Dollar" },
  { code: "EUR", label: "EUR — Euro" },
  { code: "GBP", label: "GBP — British Pound" },
  { code: "INR", label: "INR — Indian Rupee" },
  { code: "AED", label: "AED — UAE Dirham" },
  { code: "SAR", label: "SAR — Saudi Riyal" },
  { code: "QAR", label: "QAR — Qatari Riyal" },
  { code: "SGD", label: "SGD — Singapore Dollar" },
  { code: "AUD", label: "AUD — Australian Dollar" },
  { code: "CAD", label: "CAD — Canadian Dollar" },
  { code: "JPY", label: "JPY — Japanese Yen" },
  { code: "CNY", label: "CNY — Chinese Yuan" },
  { code: "CHF", label: "CHF — Swiss Franc" },
  { code: "HKD", label: "HKD — Hong Kong Dollar" },
  { code: "NZD", label: "NZD — New Zealand Dollar" },
  { code: "ZAR", label: "ZAR — South African Rand" },
] as const;

export const DEFAULT_SHELF_PRICE_CURRENCY = "USD";

export function formatPriceBasisLabel(basis: string): string {
  switch (basis) {
    case "item":
      return "Per item";
    case "pack":
      return "Per pack";
    case "kg":
      return "Per kg";
    case "litre":
      return "Per litre";
    case "other":
      return "Other";
    default:
      return basis.replace(/_/g, " ");
  }
}

export function formatShelfPriceDate(iso?: string): string {
  if (!iso?.trim()) return "—";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
