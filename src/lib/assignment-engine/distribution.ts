import type { AssignableMember } from "@/lib/assignments";
import type { DistributionEntry, DistributionStrategy, LocationScope, TeamScope } from "./types";

export function distributeAssignments(input: {
  storeIds: string[];
  assignees: AssignableMember[];
  strategy: DistributionStrategy;
  manualMapping?: Record<string, string>;
  storeNames?: Record<string, string>;
}): DistributionEntry[] {
  const { storeIds, assignees, strategy, manualMapping, storeNames } = input;
  if (!storeIds.length || !assignees.length) return [];

  if (strategy === "manual" && manualMapping) {
    const byAssignee = new Map<string, string[]>();
    for (const storeId of storeIds) {
      const assigneeId = manualMapping[storeId];
      if (!assigneeId) continue;
      const list = byAssignee.get(assigneeId) ?? [];
      list.push(storeId);
      byAssignee.set(assigneeId, list);
    }
    return assignees
      .filter((a) => byAssignee.has(a.user_id))
      .map((a) => ({
        assigneeId: a.user_id,
        assigneeName: a.name,
        storeIds: byAssignee.get(a.user_id) ?? [],
        storeCount: (byAssignee.get(a.user_id) ?? []).length,
      }));
  }

  if (strategy === "team_based") {
    return [
      {
        assigneeId: assignees[0]!.user_id,
        assigneeName: assignees.map((a) => a.name).join(", "),
        storeIds: [...storeIds],
        storeCount: storeIds.length,
      },
    ];
  }

  // equal and location_based (V1: round-robin equal split)
  const perAssignee = Math.floor(storeIds.length / assignees.length);
  const remainder = storeIds.length % assignees.length;
  const entries: DistributionEntry[] = [];
  let cursor = 0;

  assignees.forEach((assignee, index) => {
    const count = perAssignee + (index < remainder ? 1 : 0);
    const slice = storeIds.slice(cursor, cursor + count);
    cursor += count;
    if (slice.length) {
      entries.push({
        assigneeId: assignee.user_id,
        assigneeName: assignee.name,
        storeIds: slice,
        storeCount: slice.length,
      });
    }
  });

  void storeNames;
  return entries;
}

export function buildManualMappingFromDistribution(
  distribution: DistributionEntry[],
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const entry of distribution) {
    for (const storeId of entry.storeIds) {
      map[storeId] = entry.assigneeId;
    }
  }
  return map;
}

export function summarizeLocationScope(scope: LocationScope): {
  cities: string[];
  countries: string[];
} {
  const cities = [
    ...new Set(
      (scope.stores ?? [])
        .map((s) => s.city?.trim())
        .filter(Boolean) as string[],
    ),
    ...(scope.cities ?? []),
  ];
  const countries = [
    ...new Set(
      (scope.stores ?? [])
        .map((s) => s.country?.trim())
        .filter(Boolean) as string[],
    ),
    ...(scope.countries ?? []),
  ];
  return { cities, countries };
}

export function filterAssigneesByRole(
  members: AssignableMember[],
  roleFilter?: string,
): AssignableMember[] {
  if (!roleFilter) return members;
  return members.filter((m) => m.role.toLowerCase() === roleFilter.toLowerCase());
}

export function resolveSelectedAssignees(
  teamScope: TeamScope,
  allMembers: AssignableMember[],
): AssignableMember[] {
  const ids = new Set(teamScope.assigneeIds);
  return allMembers.filter((m) => ids.has(m.user_id));
}
