import { describe, expect, it } from "vitest";

import {
  buildOperatingContext,
  buildUserContext,
  USER_ROLE_PLACEHOLDERS,
} from "./help-ask-aislix.context";

describe("help-ask-aislix context builders", () => {
  it("builds operating context per model", () => {
    expect(buildOperatingContext("supermarket")).toContain("supermarket operation");
    expect(buildOperatingContext("warehouse")).toContain("warehouse operation");
  });

  it("builds user context with role label", () => {
    expect(buildUserContext("supermarket", "Store Manager")).toBe(
      "I am a Supermarket Store Manager.",
    );
    expect(buildUserContext("fmcg_distributor", "Territory Sales Manager")).toBe(
      "I am an FMCG Territory Sales Manager.",
    );
  });

  it("provides role placeholders for each operating model", () => {
    expect(USER_ROLE_PLACEHOLDERS.supermarket).toContain("Store Manager");
    expect(USER_ROLE_PLACEHOLDERS.warehouse).toContain("Warehouse Manager");
  });
});
