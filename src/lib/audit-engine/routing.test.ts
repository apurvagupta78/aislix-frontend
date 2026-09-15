import { describe, expect, it } from "vitest";

import { resolveAuditExecutionRoute } from "./index";

describe("resolveAuditExecutionRoute", () => {
  it("routes template field definitions to universal executor", () => {
    expect(
      resolveAuditExecutionRoute({
        assignmentId: "a1",
        method: "digital",
        templateType: "inventory_audit",
        hasFieldDefinitions: true,
      }),
    ).toBe("universal");
  });

  it("routes legacy planogram without fields to digital audit", () => {
    expect(
      resolveAuditExecutionRoute({
        assignmentId: "a1",
        method: "digital",
        templateType: "planogram",
        hasFieldDefinitions: false,
      }),
    ).toBe("digital");
  });

  it("routes expiry audits to expiry module", () => {
    expect(
      resolveAuditExecutionRoute({
        assignmentId: "a1",
        method: "digital",
        templateType: "expiry_audit",
        creationSource: "expiry_control",
      }),
    ).toBe("expiry");
  });
});
