/**
 * Stores each person covers: their own stores, stores they manage and their team's stores.
 * `scoped: false` means no store scope is set, so they can audit any store.
 */
export type StoreCoverage = Record<string, { scoped: boolean; storeIds: string[] }>;

export function canCoverStore(coverage: StoreCoverage | undefined, userId: string, storeId: string): boolean {
  const entry = coverage?.[userId];
  if (!entry || !entry.scoped) return true;
  return entry.storeIds.includes(storeId);
}

export function isScopedMember(coverage: StoreCoverage | undefined, userId: string): boolean {
  return Boolean(coverage?.[userId]?.scoped);
}

/** How many of the chosen stores a person covers. */
export function coveredStoreCount(
  coverage: StoreCoverage | undefined,
  userId: string,
  storeIds: string[],
): number {
  return storeIds.filter((storeId) => canCoverStore(coverage, userId, storeId)).length;
}
