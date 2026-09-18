import { describe, expect, it } from "vitest";

import {
  buildTrustedContextBlock,
  summarizeAuditScope,
} from "@/lib/ask-aislix/ask-aislix.context-builder";
import type { AskAislixAccessScope, AskAislixRequest } from "@/lib/ask-aislix/ask-aislix.types";
import { DEFAULT_DASHBOARD_FILTERS } from "@/lib/dashboard-filters";

const scope: AskAislixAccessScope = {
  orgId: "org-1",
  userId: "user-1",
  role: "manager",
  allowedStoreIds: ["store-1", "store-2"],
  allowedCities: ["Mumbai"],
  allowedCountries: ["India"],
  isOrgAdmin: false,
  isManager: true,
  accessibleAssignmentIds: ["a1", "a2"],
  accessibleScanIds: ["scan-1"],
  assignedToUserAssignmentIds: ["a1"],
  conductedScanIds: ["scan-9"],
  conductedAssignmentIds: ["a9"],
};

const request: AskAislixRequest = {
  question: "Why did this audit fail?",
  activeOrgId: "org-1",
  filters: DEFAULT_DASHBOARD_FILTERS,
  messages: [{ role: "user", content: "Show overdue audits" }],
};

describe("ask-aislix context builder", () => {
  it("summarizes assigned and conducted audit counts", () => {
    const summaries = summarizeAuditScope(scope);
    expect(summaries.assignedCount).toBe(1);
    expect(summaries.conductedCount).toBe(1);
    expect(summaries.conductedSample).toContain("scan-9");
  });

  it("builds trusted context with scope and filters", () => {
    const block = buildTrustedContextBlock(scope, request, summarizeAuditScope(scope), ["Megamart"]);
    expect(block).toContain("CURRENT AISLIX CONTEXT");
    expect(block).toContain("AUDITS ASSIGNED TO USER: 1");
    expect(block).toContain("AUDITS CONDUCTED BY USER: 1");
    expect(block).toContain("Megamart");
    expect(block).toContain("Show overdue audits");
    expect(block).not.toContain("{{user_role}}");
  });
});
