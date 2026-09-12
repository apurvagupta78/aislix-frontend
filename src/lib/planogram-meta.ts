/** Basic planogram metadata (Step 1 — common to all roles). */

export type PlanogramMeta = {
  name: string;
  store_outlet: string;
  category: string;
  sub_category?: string;
  valid_from: string;
  valid_until?: string;
  measurement_unit: "cm" | "inch" | "mm";
  fixture_type?: string;
  fixture_width?: number;
  fixture_height?: number;
  shelf_count?: number;
};

export type FixtureMeta = {
  fixture_type: string;
  fixture_width?: number;
  fixture_height?: number;
  fixture_depth?: number;
  shelf_count?: number;
};

export const EMPTY_PLANOGRAM_META: PlanogramMeta = {
  name: "",
  store_outlet: "",
  category: "Personal Care",
  sub_category: "",
  valid_from: new Date().toISOString().slice(0, 10),
  measurement_unit: "cm",
  fixture_type: "gondola",
  shelf_count: 4,
};

export function planogramIdFromName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug ? `PG-${slug}` : `PG-${Date.now()}`;
}
