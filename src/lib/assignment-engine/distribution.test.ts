import { describe, expect, it } from "vitest";

import type { AssignableMember } from "@/lib/assignments";
import {
  distributeAssignments,
  storeAssigneeMapping,
  uncoveredStores,
} from "@/lib/assignment-engine/distribution";
import {
  canCoverStore,
  coveredStoreCount,
  type StoreCoverage,
} from "@/lib/assignment-engine/store-coverage";

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

describe("storeAssigneeMapping with store coverage", () => {
  const stores = ["s1", "s2", "s3", "s4"];
  const coverage: StoreCoverage = {
    city: { scoped: true, storeIds: ["s1", "s2", "s3"] },
    s4mgr: { scoped: true, storeIds: ["s4"] },
    open: { scoped: false, storeIds: [] },
  };

  it("gives each store to someone tagged to it", () => {
    const mapping = storeAssigneeMapping(stores, [member("city"), member("s4mgr")], {}, coverage);
    expect(mapping).toEqual({ s1: "city", s2: "city", s3: "city", s4: "s4mgr" });
  });

  it("prefers tagged people over people with no store scope", () => {
    const mapping = storeAssigneeMapping(["s4"], [member("open"), member("s4mgr")], {}, coverage);
    expect(mapping).toEqual({ s4: "s4mgr" });
  });

  it("falls back to people with no store scope when nobody is tagged", () => {
    const mapping = storeAssigneeMapping(["s4"], [member("city"), member("open")], {}, coverage);
    expect(mapping).toEqual({ s4: "open" });
  });

  it("balances stores across people who cover them", () => {
    const wide: StoreCoverage = {
      ana: { scoped: true, storeIds: stores },
      ben: { scoped: true, storeIds: stores },
    };
    const mapping = storeAssigneeMapping(stores, team(), {}, wide);
    expect(Object.values(mapping).filter((id) => id === "ana")).toHaveLength(2);
    expect(Object.values(mapping).filter((id) => id === "ben")).toHaveLength(2);
  });

  it("keeps a per-store choice", () => {
    const mapping = storeAssigneeMapping(["s4"], [member("city"), member("s4mgr")], { s4: "city" }, coverage);
    expect(mapping).toEqual({ s4: "city" });
  });

  it("lists stores nobody selected covers", () => {
    expect(uncoveredStores(stores, [member("city")], coverage)).toEqual(["s4"]);
    expect(uncoveredStores(stores, [member("open")], coverage)).toEqual([]);
  });

  it("counts covered stores", () => {
    expect(coveredStoreCount(coverage, "city", stores)).toBe(3);
    expect(coveredStoreCount(coverage, "open", stores)).toBe(4);
    expect(canCoverStore(coverage, "unknown", "s1")).toBe(true);
  });

  function team() {
    return [member("ana"), member("ben")];
  }
});
