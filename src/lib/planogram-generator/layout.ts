/**
 * AI planogram generator layout: the shape the page edits and the server saves. Location IDs are
 * always rebuilt by Aislix from rack / shelf / space numbers, so they are unique by construction.
 */

import { hideModelNames } from "@/lib/ai-display-text";
import type { DraftRow } from "@/lib/planogram";

export const STORE_TYPES = [
  "Supermarket",
  "Hypermarket",
  "Convenience store",
  "Dark store",
  "Kirana / general store",
  "Pharmacy",
  "Department store",
  "Other",
] as const;

export const PRIORITY_OPTIONS = [
  "Bestsellers",
  "High margin",
  "New launches",
  "Promotions",
  "Private label",
] as const;

export const MAX_RACKS = 12;
export const MAX_SHELVES = 10;
export const MAX_SPACES_PER_SHELF = 12;
export const MAX_PRODUCTS_PER_SPACE = 12;
export const MAX_GENERATOR_PHOTOS = 4;
export const MAX_TYPED_PRODUCTS = 300;
export const SHELF_SPACE_BASE_URL = "https://aislix.com/shelf/";

export type InputProduct = { name: string; brand: string; category: string; sku: string };

export type LayoutProduct = {
  id: string;
  name: string;
  brand: string;
  category: string;
  sku: string;
  facings: number | null;
  quantity: number | null;
  quantityEstimated: boolean;
  reason: string;
  /** null when no product list was given; false flags a product that is not in the user's list. */
  inList: boolean | null;
};

export type LayoutSpace = {
  space: number;
  locationId: string;
  widthCm: number | null;
  estimated: boolean;
  instructions: string;
  products: LayoutProduct[];
};

export type LayoutShelf = {
  shelf: number;
  position: string;
  widthCm: number | null;
  heightCm: number | null;
  estimated: boolean;
  spaces: LayoutSpace[];
};

export type LayoutRack = { rack: number; description: string; shelves: LayoutShelf[] };

export type PlanogramLayout = {
  storeCode: string;
  summary: string;
  racks: LayoutRack[];
  assumptions: string[];
  missing: string[];
};

type Row = Record<string, unknown>;

const pad2 = (n: number) => String(n).padStart(2, "0");

export function locationId(storeCode: string, rack: number, shelf: number, space: number): string {
  return `${storeCode}-R${pad2(rack)}-SH${pad2(shelf)}-SP${pad2(space)}`;
}

export function physicalPosition(rack: number, shelf: number, space: number): string {
  return `Rack ${rack} → Shelf ${shelf} → Space ${space}`;
}

/** Store code used in location IDs: the store's own code, else a stable code from its ID. */
export function storeCodeFor(store: { id: string; code?: string | null }): string {
  const own = String(store.code ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 10);
  return own || `ST${store.id.replace(/-/g, "").slice(0, 4).toUpperCase()}`;
}

export function productKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? hideModelNames(value.trim()).slice(0, max) : "";
}

function count(value: unknown, max: number): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : null;
}

function cm(value: unknown): number | null {
  const n = Number(value);
  return value !== null && value !== "" && Number.isFinite(n) && n > 0 ? Math.min(Math.round(n), 2000) : null;
}

function list(value: unknown): Row[] {
  return Array.isArray(value) ? value.filter((v): v is Row => Boolean(v) && typeof v === "object") : [];
}

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function byNumber(key: string) {
  return (a: Row, b: Row) => (Number(a[key]) || 0) - (Number(b[key]) || 0);
}

function emptyShelf(storeCode: string, rack: number, shelf: number): LayoutShelf {
  return {
    shelf,
    position: "",
    widthCm: null,
    heightCm: null,
    estimated: true,
    spaces: [
      {
        space: 1,
        locationId: locationId(storeCode, rack, shelf, 1),
        widthCm: null,
        estimated: true,
        instructions: "Not planned by AI. Add products before approving, or leave free.",
        products: [],
      },
    ],
  };
}

/**
 * Turns the AI's JSON into a clean layout: requested rack / shelf counts, renumbered spaces,
 * Aislix-built location IDs, bounded numbers, and products checked against the user's list.
 */
export function normalizeLayout(
  raw: unknown,
  opts: { storeCode: string; racks: number | null; shelvesPerRack: number | null; productList: InputProduct[] },
): PlanogramLayout {
  const root = (raw && typeof raw === "object" ? raw : {}) as Row;
  const known = new Set(opts.productList.flatMap((p) => [productKey(p.name), p.sku ? `sku:${p.sku.toLowerCase()}` : ""]));
  const hasList = opts.productList.length > 0;

  const aiRacks = list(root.racks).sort(byNumber("rack_number"));
  const rackCount = Math.min(MAX_RACKS, opts.racks ?? Math.max(1, aiRacks.length));
  const racks: LayoutRack[] = [];
  for (let r = 1; r <= rackCount; r++) {
    const aiRack = aiRacks[r - 1];
    const aiShelves = list(aiRack?.shelves).sort(byNumber("shelf_number"));
    const shelfCount = Math.min(MAX_SHELVES, opts.shelvesPerRack ?? Math.max(1, aiShelves.length));
    const shelves: LayoutShelf[] = [];
    for (let s = 1; s <= shelfCount; s++) {
      const aiShelf = aiShelves[s - 1];
      if (!aiShelf) {
        shelves.push(emptyShelf(opts.storeCode, r, s));
        continue;
      }
      const aiSpaces = list(aiShelf.spaces).sort(byNumber("space_number")).slice(0, MAX_SPACES_PER_SHELF);
      const spaces: LayoutSpace[] = aiSpaces.map((sp, i) => ({
        space: i + 1,
        locationId: locationId(opts.storeCode, r, s, i + 1),
        widthCm: cm(sp.width_cm),
        estimated: sp.estimated === true || cm(sp.width_cm) === null,
        instructions: text(sp.placement_instructions, 400),
        products: list(sp.products)
          .slice(0, MAX_PRODUCTS_PER_SPACE)
          .map((p) => {
            const name = text(p.product_name ?? p.name, 160);
            const sku = text(p.sku, 60).replace(/^null$/i, "");
            return {
              id: newId(),
              name,
              brand: text(p.brand, 80),
              category: text(p.category, 80),
              sku,
              facings: count(p.facings, 99),
              quantity: count(p.quantity, 9999),
              quantityEstimated: p.quantity_estimated === true,
              reason: text(p.reason, 300),
              inList: hasList ? known.has(productKey(name)) || (sku ? known.has(`sku:${sku.toLowerCase()}`) : false) : null,
            };
          })
          .filter((p) => p.name),
      }));
      shelves.push(
        spaces.length
          ? {
              shelf: s,
              position: text(aiShelf.position, 40),
              widthCm: cm(aiShelf.width_cm),
              heightCm: cm(aiShelf.height_cm),
              estimated: aiShelf.estimated === true,
              spaces,
            }
          : emptyShelf(opts.storeCode, r, s),
      );
    }
    racks.push({ rack: r, description: text(aiRack?.description, 120), shelves });
  }

  const strings = (value: unknown) =>
    (Array.isArray(value) ? value : []).map((v) => text(v, 300)).filter(Boolean).slice(0, 20);
  return {
    storeCode: opts.storeCode,
    summary: text(root.planogram_summary, 1200),
    racks,
    assumptions: strings(root.assumptions),
    missing: strings(root.missing_information),
  };
}

export function isPlanogramLayout(value: unknown): value is PlanogramLayout {
  const v = value as PlanogramLayout | null;
  return Boolean(v && typeof v === "object" && typeof v.storeCode === "string" && Array.isArray(v.racks));
}

export function layoutStats(layout: PlanogramLayout) {
  let shelves = 0;
  let spaces = 0;
  let products = 0;
  let notInList = 0;
  for (const rack of layout.racks) {
    for (const shelf of rack.shelves) {
      shelves++;
      for (const space of shelf.spaces) {
        spaces++;
        products += space.products.length;
        notInList += space.products.filter((p) => p.inList === false).length;
      }
    }
  }
  return { racks: layout.racks.length, shelves, spaces, products, notInList };
}

/** Adds an empty space at the end of a shelf. */
export function addSpace(layout: PlanogramLayout, rack: number, shelf: number): PlanogramLayout {
  return {
    ...layout,
    racks: layout.racks.map((r) =>
      r.rack !== rack
        ? r
        : {
            ...r,
            shelves: r.shelves.map((s) => {
              if (s.shelf !== shelf || s.spaces.length >= MAX_SPACES_PER_SHELF) return s;
              const next = s.spaces.length + 1;
              return {
                ...s,
                spaces: [
                  ...s.spaces,
                  {
                    space: next,
                    locationId: locationId(layout.storeCode, rack, shelf, next),
                    widthCm: null,
                    estimated: true,
                    instructions: "",
                    products: [],
                  },
                ],
              };
            }),
          },
    ),
  };
}

/** Removes the last space of a shelf when it holds no products. */
export function removeLastSpace(layout: PlanogramLayout, rack: number, shelf: number): PlanogramLayout {
  return {
    ...layout,
    racks: layout.racks.map((r) =>
      r.rack !== rack
        ? r
        : {
            ...r,
            shelves: r.shelves.map((s) => {
              const last = s.spaces[s.spaces.length - 1];
              if (s.shelf !== shelf || s.spaces.length <= 1 || !last || last.products.length) return s;
              return { ...s, spaces: s.spaces.slice(0, -1) };
            }),
          },
    ),
  };
}

export function mapSpaces(layout: PlanogramLayout, fn: (space: LayoutSpace) => LayoutSpace): PlanogramLayout {
  return {
    ...layout,
    racks: layout.racks.map((r) => ({
      ...r,
      shelves: r.shelves.map((s) => ({ ...s, spaces: s.spaces.map(fn) })),
    })),
  };
}

export function emptyProduct(): LayoutProduct {
  return {
    id: newId(),
    name: "",
    brand: "",
    category: "",
    sku: "",
    facings: 1,
    quantity: null,
    quantityEstimated: false,
    reason: "Added by you",
    inList: null,
  };
}

/** Store planogram rows for one rack, in the format audits and compliance checks already use. */
export function rackPlanogramRows(rack: LayoutRack): DraftRow[] {
  const rows: DraftRow[] = [];
  for (const shelf of rack.shelves) {
    for (const space of shelf.spaces) {
      for (const p of space.products) {
        if (!p.name.trim()) continue;
        const category = p.category.trim() || rack.description.trim() || "General";
        rows.push({
          key: newId(),
          location: `Rack ${rack.rack}`,
          category,
          sub_category: category,
          brand: p.brand.trim() || "Unbranded",
          product_name: p.name.trim(),
          variant: "",
          expected_qty: p.quantity ?? p.facings ?? 1,
          expected_facings: p.facings ?? undefined,
          expected_shelf_units: p.quantity ?? undefined,
          sku: p.sku.trim(),
          shelf_position: `SH${pad2(shelf.shelf)}-SP${pad2(space.space)}`,
          match_key: "",
        });
      }
    }
  }
  return rows;
}

export function rackPlanogramName(rack: LayoutRack, storeCode: string): string {
  const what = rack.description.trim();
  return `AI planogram · ${storeCode} Rack ${rack.rack}${what ? ` · ${what}` : ""}`.slice(0, 120);
}

export type ShelfSpaceProduct = {
  name: string;
  brand: string;
  category: string;
  sku: string;
  facings: number | null;
  quantity: number | null;
};

export function spaceProducts(space: LayoutSpace): ShelfSpaceProduct[] {
  return space.products
    .filter((p) => p.name.trim())
    .map((p) => ({
      name: p.name.trim(),
      brand: p.brand.trim(),
      category: p.category.trim(),
      sku: p.sku.trim(),
      facings: p.facings,
      quantity: p.quantity,
    }));
}
