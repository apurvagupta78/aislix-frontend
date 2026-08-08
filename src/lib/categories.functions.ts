import { createServerFn } from "@tanstack/react-start";

export type ShelfCategory = { name: string; examples: string };

export const FALLBACK_CATEGORIES: ShelfCategory[] = [
  {
    name: "Beverages",
    examples: "Water, soft drinks, juices, energy drinks, tea, coffee, sports drinks",
  },
  { name: "Fresh Food", examples: "Fruits, vegetables, fresh meat, fish, eggs" },
  { name: "Dairy & Chilled", examples: "Milk, curd, paneer, cheese, butter, yogurt" },
  { name: "Grocery & Staples", examples: "Rice, atta, dal, pulses, oil, sugar, salt, spices" },
  {
    name: "Packaged Food & Snacks",
    examples:
      "Biscuits, chips, namkeen, noodles, pasta, cereals, chocolates, confectionery, sauces",
  },
  {
    name: "Frozen Foods & Ice Cream",
    examples: "Ice cream, frozen vegetables, frozen snacks, frozen meals",
  },
  {
    name: "Personal Care",
    examples: "Shampoo, soap, toothpaste, deodorant, skincare, cosmetics, shaving",
  },
  {
    name: "Home Care",
    examples:
      "Detergent, dishwash, floor cleaner, toilet cleaner, disinfectants, air fresheners, insecticides",
  },
  {
    name: "Health & Wellness",
    examples: "OTC products, vitamins, supplements, first aid, health foods",
  },
  { name: "Baby & Pet Care", examples: "Baby food, diapers, wipes, pet food, pet hygiene" },
];

export const fetchShelfCategories = createServerFn({ method: "GET" }).handler(
  async (): Promise<ShelfCategory[]> => {
    const base = process.env["AISLIX_AI_API_URL"];
    if (!base) return FALLBACK_CATEGORIES;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const response = await fetch(`${base.replace(/\/$/, "")}/categories`, {
        headers: { accept: "application/json" },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!response.ok) return FALLBACK_CATEGORIES;
      const payload = (await response.json()) as {
        categories?: Array<{ name?: string; examples?: string | string[] }>;
      };
      const rows = (payload?.categories ?? [])
        .map((row) => ({
          name: String(row?.name ?? "").trim(),
          examples: Array.isArray(row?.examples)
            ? row.examples.join(", ")
            : String(row?.examples ?? "").trim(),
        }))
        .filter((row) => row.name.length > 0);
      return rows.length ? rows : FALLBACK_CATEGORIES;
    } catch {
      return FALLBACK_CATEGORIES;
    }
  },
);
