import { describe, expect, it } from "vitest";
import { assignmentNotificationBody } from "./assignments";

describe("assignmentNotificationBody", () => {
  it("leads with the audit name and store", () => {
    expect(
      assignmentNotificationBody({
        auditMode: "ai",
        scopeType: "location",
        scopeValues: { audit_name: "Weekly biscuits check", location: "Main shelf" },
        storeName: "Andheri",
      }),
    ).toBe("AI audit: Weekly biscuits check · Andheri · Main shelf");
  });

  it("names digital audits", () => {
    expect(
      assignmentNotificationBody({
        auditMode: "digital",
        scopeType: "location",
        scopeValues: { audit_name: "Stock list" },
        storeName: null,
      }),
    ).toBe("Digital audit: Stock list");
  });

  it("falls back to the scope summary without a name or store", () => {
    expect(
      assignmentNotificationBody({
        auditMode: "ai",
        scopeType: "location",
        scopeValues: { location: "Aisle 3" },
      }),
    ).toBe("You have a new AI audit task: Location · Aisle 3.");
  });
});
