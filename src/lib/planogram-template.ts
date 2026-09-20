/** Canonical planogram CSV schema — must match backend app/planogram_csv.csv_template_header(). */

export const SAMPLE_CSV_HEADERS =
  "location,category,sub_category,brand,product_name,variant,expected_facings,min_facings,max_facings,expected_shelf_units,price,avg_daily_sales,product_id,shelf_position";

/** Required fields for every CSV row (facings column is one of expected_facings or expected_qty). */
export const PLANOGRAM_CSV_REQUIRED_LABEL =
  "location, category, sub_category, brand, product_name, expected_facings (or expected_qty)";

export const PLANOGRAM_CSV_OPTIONAL_LABEL =
  "variant, min_facings, max_facings, expected_shelf_units, price, avg_daily_sales, product_id, shelf_position";

export const REQUIRED_CSV_COLUMNS = [
  "location",
  "category",
  "sub_category",
  "brand",
  "product_name",
] as const;

/** Header names that satisfy the facings / quantity requirement. */
export const FACINGS_CSV_COLUMNS = [
  "expected_facings",
  "expected_qty",
  "facings",
  "qty",
  "quantity",
] as const;

export const SAMPLE_CSV_TEMPLATE = [
  SAMPLE_CSV_HEADERS,
  "A-1-Z,Personal Care,Shampoo,Dove,Intense Repair Shampoo,340ml,4,2,6,12,299,6,DOVE-IR-340,1",
].join("\n");
