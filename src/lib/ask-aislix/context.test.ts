import { describe, expect, it } from "vitest";

import { clampFiltersToScope, resolveStoreQuery } from "@/lib/ask-aislix/context";
import type { AskAislixAccessScope } from "@/lib/ask-aislix/ask-aislix.types";

const baseScope: AskAislixAccessScope = {
  orgId: "org-1",
  userId: "user-1",
  role: "manager",
  allowedStoreIds: ["store-mumbai"],
  allowedCities: ["Mumbai"],
  allowedCountries: ["India"],
  isOrgAdmin: false,
  isManager: true,
  accessibleAssignmentIds: ["a1"],
  accessibleScanIds: [],
};

describe("AskAccessScope helpers", () => {
  it("denies city outside allowed scope via clamp", () => {
    const clamped = clampFiltersToScope(
      { datePreset: "30d", city: "Delhi", storeId: "all", country: "all" },
      baseScope,
    );
    expect(clamped.city).toBe("__none__");
  });

  it("resolves store within authorized scope", () => {
    const store = resolveStoreQuery(
      baseScope,
      [{ id: "store-mumbai", name: "Megamart", city: "Mumbai", country: "India" }],
      "Megamart Bangalore",
    );
    expect(store?.id).toBe("store-mumbai");
  });

  it("returns null for unauthorized store query", () => {
    const store = resolveStoreQuery(
      baseScope,
      [{ id: "store-delhi", name: "Megamart Delhi", city: "Delhi", country: "India" }],
      "Megamart Delhi",
    );
    expect(store).toBeNull();
  });
});
