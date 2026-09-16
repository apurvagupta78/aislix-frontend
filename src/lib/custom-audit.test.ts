import { describe, expect, it } from "vitest";

import { buildCustomAuditShelfScanInsert } from "@/lib/custom-audit";

describe("buildCustomAuditShelfScanInsert", () => {
  it("uses live shelf_scans columns (audit_mode, created_by, assignment_id)", () => {
    const row = buildCustomAuditShelfScanInsert({
      orgId: "org-1",
      storeId: "store-1",
      userId: "user-1",
      assignmentId: "asn-1",
      templateId: "tpl-1",
      templateVersion: 2,
      templateSnapshot: { name: "Local Store Inventory Audit" },
      workflowSubmission: "manager_approval",
    });

    expect(row).toMatchObject({
      org_id: "org-1",
      store_id: "store-1",
      created_by: "user-1",
      assignment_id: "asn-1",
      audit_mode: "digital",
      submission_status: "pending_review",
      template_id: "tpl-1",
      template_version: 2,
      status: "completed",
    });
    expect(row).not.toHaveProperty("collection_method");
    expect(row).not.toHaveProperty("user_id");
    expect(typeof row.submitted_at).toBe("string");
  });

  it("marks direct workflow submissions approved", () => {
    const row = buildCustomAuditShelfScanInsert({
      orgId: "org-1",
      storeId: null,
      userId: "user-1",
      assignmentId: "asn-1",
      templateId: "tpl-1",
      templateVersion: 1,
      templateSnapshot: {},
      workflowSubmission: "direct",
    });

    expect(row.submission_status).toBe("approved");
  });
});
