import { describe, expect, it } from "vitest";

import type { AskAislixAccessScope } from "@/lib/ask-aislix/ask-aislix.types";

import { assertAssignmentAuthorized, assertScanAuthorized } from "./audit-retrieval";

const memberScope: AskAislixAccessScope = {
  orgId: "org-1",
  userId: "user-1",
  role: "member",
  allowedStoreIds: ["store-mumbai"],
  allowedCities: ["Mumbai"],
  allowedCountries: ["India"],
  isOrgAdmin: false,
  isManager: false,
  accessibleAssignmentIds: ["a1"],
  accessibleScanIds: ["scan-1"],
  assignedToUserAssignmentIds: ["a1"],
  conductedScanIds: ["scan-9"],
  conductedAssignmentIds: ["a9"],
};

const adminScope: AskAislixAccessScope = {
  ...memberScope,
  role: "owner",
  isOrgAdmin: true,
  isManager: true,
  accessibleAssignmentIds: ["a1", "a2"],
  accessibleScanIds: ["scan-1", "scan-2"],
};

describe("audit retrieval authorization", () => {
  it("denies scan access outside accessible lists for members", () => {
    expect(assertScanAuthorized(memberScope, "scan-1")).toBe(true);
    expect(assertScanAuthorized(memberScope, "scan-9")).toBe(true);
    expect(assertScanAuthorized(memberScope, "scan-other")).toBe(false);
  });

  it("denies scan access outside org scope even for org admins", () => {
    expect(assertScanAuthorized(adminScope, "scan-1")).toBe(true);
    expect(assertScanAuthorized(adminScope, "scan-other")).toBe(false);
  });

  it("allows org admins to access any assignment in scope lists", () => {
    expect(assertAssignmentAuthorized(adminScope, "any-id")).toBe(true);
  });

  it("denies assignment access for members outside accessible lists", () => {
    expect(assertAssignmentAuthorized(memberScope, "a1")).toBe(true);
    expect(assertAssignmentAuthorized(memberScope, "a-other")).toBe(false);
  });
});
