/** Canonical required-products CSV schema — must match backend app/planogram_package_csv.ASSORTMENT_HEADERS. */

export const ASSORTMENT_CSV_HEADERS =
  "sku,list_type,outlet_scope,valid_from,valid_to,substitution_allowed";

export const ASSORTMENT_CSV_REQUIRED_LABEL =
  "sku (Product / SKU), list_type (mandatory_assortment or msl)";

export const ASSORTMENT_CSV_OPTIONAL_LABEL =
  "outlet_scope (Store / Outlet), valid_from (Start Date), valid_to (End Date), substitution_allowed (true/false)";

export const ASSORTMENT_CSV_LIST_TYPE_NOTE =
  "Use mandatory_assortment for Required Assortment, or msl for Must-Stock.";

export const ASSORTMENT_CSV_TEMPLATE = [
  ASSORTMENT_CSV_HEADERS,
  "COL-MAX-150,mandatory_assortment,all,2026-01-01,2026-12-31,false",
  "PEP-GER-150,msl,outlet_a,2026-01-01,2026-12-31,false",
].join("\n");
