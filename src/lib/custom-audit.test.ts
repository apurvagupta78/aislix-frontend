import { describe, expect, it } from "vitest";

import type { Database } from "@/integrations/supabase/types";
import {
  OBSOLETE_SHELF_SCAN_SUBMIT_COLUMNS,
  buildCustomAuditShelfScanInsert,
} from "@/lib/custom-audit";

type ShelfScanInsert = Database["public"]["Tables"]["shelf_scans"]["Insert"];

const SAMPLE_SUBMIT_INPUT = {
  orgId: "org-1",
  storeId: "store-1",
  userId: "user-1",
  assignmentId: "asn-1",
  templateId: "tpl-1",
  templateVersion: 2,
  templateSnapshot: { name: "Local Store Inventory Audit" },
  workflowSubmission: "manager_approval" as const,
};

describe("buildCustomAuditShelfScanInsert", () => {
  it("uses live shelf_scans columns (audit_mode, created_by, assignment_id)", () => {
    const row = buildCustomAuditShelfScanInsert(SAMPLE_SUBMIT_INPUT);

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
      category_selections: {},
      device_info: {},
    });
    for (const obsolete of OBSOLETE_SHELF_SCAN_SUBMIT_COLUMNS) {
      expect(row).not.toHaveProperty(obsolete);
    }
    expect(typeof row.submitted_at).toBe("string");
  });

  it("marks direct workflow submissions approved", () => {
    const row = buildCustomAuditShelfScanInsert({
      ...SAMPLE_SUBMIT_INPUT,
      storeId: null,
      templateVersion: 1,
      templateSnapshot: {},
      workflowSubmission: "direct",
    });

    expect(row.submission_status).toBe("approved");
  });

  it("only includes keys accepted by the live shelf_scans Insert schema", () => {
    const row = buildCustomAuditShelfScanInsert(SAMPLE_SUBMIT_INPUT);
    const allowed: Array<keyof ShelfScanInsert> = [
      "org_id",
      "store_id",
      "created_by",
      "assignment_id",
      "status",
      "audit_mode",
      "submission_status",
      "submitted_at",
      "template_id",
      "template_version",
      "template_snapshot",
      "photo_count",
      "category_selections",
      "device_info",
    ];

    expect(Object.keys(row).sort()).toEqual(allowed.sort());
    for (const obsolete of OBSOLETE_SHELF_SCAN_SUBMIT_COLUMNS) {
      expect(Object.keys(row)).not.toContain(obsolete);
    }
  });
});
