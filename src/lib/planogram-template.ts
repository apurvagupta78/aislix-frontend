/** Canonical planogram CSV schema, safe to import from server routes. */

export const SAMPLE_CSV_HEADERS =
  "location,category,sub_category,brand,product_name,variant,expected_facings,min_facings,max_facings,expected_qty,mrp_inr,avg_daily_sales,sku,shelf_position";

export const REQUIRED_CSV_COLUMNS = [
  "location",
  "category",
  "sub_category",
  "brand",
  "product_name",
  "expected_qty",
] as const;

export const SAMPLE_CSV_TEMPLATE = [
  SAMPLE_CSV_HEADERS,
  "A-1-Z,Personal Care,Shampoo,Dove,Intense Repair Shampoo,340ml,4,2,6,4,299,6,,1",
].join("\n");
