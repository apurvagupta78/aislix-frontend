import { createServerFn } from "@tanstack/react-start";
import type { ShelfCategory } from "@/lib/categories.data";

export const fetchShelfCategories = createServerFn({ method: "GET" }).handler(
  async (): Promise<ShelfCategory[]> => {
    const { loadShelfCategories } = await import("@/lib/categories.server");
    return loadShelfCategories();
  },
);
