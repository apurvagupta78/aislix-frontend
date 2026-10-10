/** Location types a workspace can manage under Manage → Stores (`stores.store_type`). */
export const STORE_TYPES = [
  { value: "supermarket", label: "Supermarket" },
  { value: "fmcg_brand", label: "FMCG brand" },
  { value: "local_store", label: "Local store" },
  { value: "dark_store", label: "Dark store" },
  { value: "fmcg_distributor", label: "Distributor" },
  { value: "warehouse", label: "Warehouse" },
  { value: "outlet", label: "Outlet" },
] as const;

export type StoreTypeValue = (typeof STORE_TYPES)[number]["value"];

const ALIASES: Record<string, StoreTypeValue> = {
  distributor: "fmcg_distributor",
  brand: "fmcg_brand",
  local: "local_store",
  darkstore: "dark_store",
};

export function normalizeStoreType(raw: string | null | undefined): StoreTypeValue | null {
  const slug = (raw ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (!slug) return null;
  if (ALIASES[slug]) return ALIASES[slug];
  return STORE_TYPES.some((t) => t.value === slug) ? (slug as StoreTypeValue) : null;
}

export function storeTypeLabel(raw: string | null | undefined): string {
  const value = normalizeStoreType(raw);
  if (value) return STORE_TYPES.find((t) => t.value === value)!.label;
  const text = (raw ?? "").trim().replace(/_/g, " ");
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "Not set";
}

/** Stored spellings that mean the same type (older rows used spaces, e.g. "local store"). */
export function storeTypeVariants(value: string): string[] {
  const normalized = normalizeStoreType(value) ?? value;
  const variants = new Set([normalized, normalized.replace(/_/g, " "), normalized.replace(/_/g, "-")]);
  for (const [alias, target] of Object.entries(ALIASES)) if (target === normalized) variants.add(alias);
  return [...variants];
}
