/** Expected product row for without-planogram Astra comparison (8 fields). */

export type ExpectedProduct = {
  location: string;
  category: string;
  sub_category: string;
  brand: string;
  product_name: string;
  variant: string;
  expected_facings: number;
  expected_shelf_units: number;
};

export function emptyExpectedProduct(defaults?: Partial<ExpectedProduct>): ExpectedProduct {
  return normalizeExpectedProduct({
    location: "",
    category: "",
    sub_category: "",
    brand: "",
    product_name: "",
    variant: "",
    expected_facings: 0,
    expected_shelf_units: 0,
    ...defaults,
  });
}

export function normalizeExpectedProduct(raw: Partial<ExpectedProduct> | null | undefined): ExpectedProduct {
  return {
    location: String(raw?.location ?? "").trim(),
    category: String(raw?.category ?? "").trim(),
    sub_category: String(raw?.sub_category ?? "").trim(),
    brand: String(raw?.brand ?? "").trim(),
    product_name: String(raw?.product_name ?? "").trim(),
    variant: String(raw?.variant ?? "").trim(),
    expected_facings: Number.isFinite(Number(raw?.expected_facings))
      ? Math.max(0, Math.floor(Number(raw!.expected_facings)))
      : 0,
    expected_shelf_units: Number.isFinite(Number(raw?.expected_shelf_units))
      ? Math.max(0, Math.floor(Number(raw!.expected_shelf_units)))
      : 0,
  };
}

/** Trim and coerce expected product rows before persisting or sending to Astra. */
export function prepareExpectedProductsForSubmit(
  rows: ExpectedProduct[] | undefined,
): ExpectedProduct[] {
  return (rows ?? []).map((row) => normalizeExpectedProduct(row));
}

export function validateExpectedProduct(row: ExpectedProduct): string | null {
  if (!row.brand.trim()) return "Brand is required.";
  if (!row.product_name.trim()) return "Product name is required.";
  if (row.expected_facings < 0) return "Expected facings must be 0 or more.";
  if (row.expected_shelf_units < 0) return "Expected shelf units must be 0 or more.";
  return null;
}
