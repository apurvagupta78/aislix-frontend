import { describe, expect, it } from "vitest";

import type { AssignableMember } from "@/lib/assignments";
import { distributeAssignments, storeAssigneeMapping } from "@/lib/assignment-engine/distribution";

const member = (user_id: string): AssignableMember => ({
  user_id,
  name: user_id.toUpperCase(),
  role: "member",
  email: `${user_id}@example.com`,
  status: "active",
});

describe("storeAssigneeMapping", () => {
  const stores = ["s1", "s2", "s3", "s4"];
  const team = [member("ana"), member("ben")];

  it("splits stores evenly when nobody changed a store", () => {
    expect(storeAssigneeMapping(stores, team)).toEqual({ s1: "ana", s2: "ana", s3: "ben", s4: "ben" });
  });

  it("keeps a per-store choice and splits the rest", () => {
    expect(storeAssigneeMapping(stores, team, { s1: "ben" })).toEqual({
      s1: "ben",
      s2: "ana",
      s3: "ben",
      s4: "ben",
    });
  });

  it("ignores a choice for someone who is no longer selected", () => {
    expect(storeAssigneeMapping(["s1"], [member("ana")], { s1: "ben" })).toEqual({ s1: "ana" });
  });

  it("creates one audit per store with the chosen person", () => {
    const mapping = storeAssigneeMapping(stores, team, { s4: "ana" });
    const distribution = distributeAssignments({
      storeIds: stores,
      assignees: team,
      strategy: "manual",
      manualMapping: mapping,
    });
    expect(distribution.flatMap((d) => d.storeIds).sort()).toEqual(stores);
    expect(distribution.find((d) => d.assigneeId === "ana")?.storeIds).toEqual(["s1", "s2", "s4"]);
    expect(distribution.find((d) => d.assigneeId === "ben")?.storeIds).toEqual(["s3"]);
  });
});
