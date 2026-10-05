import type { Store } from "@/lib/account";
import type { LocationScope } from "@/lib/assignment-engine";

/** Location scope for the chosen stores, kept in the order they were picked. */
export function storeSelection(stores: Store[], ids: string[]): LocationScope {
  const selected = ids
    .map((id) => stores.find((s) => s.id === id))
    .filter((s): s is Store => Boolean(s));
  return {
    storeIds: selected.map((s) => s.id),
    stores: selected.map((s) => ({ id: s.id, name: s.name, city: s.city, country: s.country })),
    countries: [...new Set(selected.map((s) => s.country).filter(Boolean))],
    cities: [...new Set(selected.map((s) => s.city).filter(Boolean))],
  };
}
