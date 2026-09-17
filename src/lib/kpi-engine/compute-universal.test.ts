import { describe, expect, it } from "vitest";

import type { LifecycleAction } from "@/lib/corrective-action-lifecycle";
import type { Finding } from "@/lib/findings";
import {
  assignmentStatusBucket,
  buildAuditStatusBuckets,
  buildRecurringIssues,
  completionPct,
  computeUniversalDashboardFromRows,
  countCriticalFindings,
  countOpenActions,
  countOpenFindings,
  countOverdueActions,
  formatInrCompact,
  isCompletedAssignment,
  NOT_WIRED_YET,
} from "./compute-universal";

function finding(partial: Partial<Finding> & Pick<Finding, "id" | "status" | "severity">): Finding {
  return {
    org_id: "org-1",
    scan_id: null,
    assignment_id: null,
    store_id: "store-1",
    store_name: "Aislix India",
    source_type: "digital",
    source_id: null,
    audit_origin: "digital",
    finding_type: "inventory_shortage",
    confirmation_state: "human_confirmed",
    title: "Short pick",
    description: null,
    sku: "QA-01",
    product_name: "QA SKU",
    category: null,
    shelf_label: null,
    expected_value: 10,
    actual_value: 8,
    variance_units: -2,
    variance_percentage: -20,
    variance_value_inr: 50,
    rca_code: "missing",
    rca_notes: null,
    assigned_to: null,
    assigned_name: "",
    due_at: null,
    created_at: "2026-09-10T10:00:00.000Z",
    resolved_at: null,
    verified_at: null,
    closed_at: null,
    ...partial,
  };
}

function action(partial: Partial<LifecycleAction> & Pick<LifecycleAction, "id" | "status">): LifecycleAction {
  return {
    finding_id: null,
    scan_id: null,
    store_id: "store-1",
    org_id: "org-1",
    title: "Fix shortage",
    description: null,
    suggestion: "Restock",
    issue_type: "inventory_shortage",
    priority: "high",
    assigned_to: null,
    assigned_name: "R. Sharma",
    created_by: null,
    sla_hours: 12,
    due_at: "2026-09-01T10:00:00.000Z",
    created_at: "2026-08-30T10:00:00.000Z",
    start_at: null,
    resolved_at: null,
    resolution_notes: null,
    resolution_qty: null,
    verified_by: null,
    verified_at: null,
    rejection_reason: null,
    closed_at: null,
    sku: "QA-01",
    ...partial,
  };
}

describe("universal dashboard compute helpers", () => {
  it("computes completion % as completed / total excluding empty", () => {
    expect(completionPct(0, 0)).toBeNull();
    expect(completionPct(3, 4)).toBe(75);
    expect(completionPct(1, 3)).toBe(33.3);
  });

  it("treats completed and approved assignments as done", () => {
    expect(isCompletedAssignment({ status: "completed", approval_status: "pending" })).toBe(true);
    expect(isCompletedAssignment({ status: "pending", approval_status: "approved" })).toBe(true);
    expect(isCompletedAssignment({ status: "in_progress", approval_status: "pending" })).toBe(false);
  });

  it("counts open findings as not closed, including resolved", () => {
    expect(countOpenFindings([{ status: "open" }, { status: "resolved" }, { status: "closed" }])).toBe(2);
  });

  it("counts critical findings as unresolved high + critical", () => {
    expect(
      countCriticalFindings([
        { status: "open", severity: "critical" },
        { status: "open", severity: "high" },
        { status: "open", severity: "medium" },
        { status: "closed", severity: "critical" },
      ]),
    ).toBe(2);
  });

  it("counts open and overdue corrective actions", () => {
    const now = new Date("2026-09-17T12:00:00.000Z").getTime();
    const rows = [
      { status: "open", due_at: "2026-09-01T00:00:00.000Z" },
      { status: "in_progress", due_at: "2026-09-20T00:00:00.000Z" },
      { status: "closed", due_at: "2026-09-01T00:00:00.000Z" },
    ];
    expect(countOpenActions(rows)).toBe(2);
    expect(countOverdueActions(rows, now)).toBe(1);
  });

  it("buckets assignment status including overdue vs approved", () => {
    const now = new Date("2026-09-17T12:00:00.000Z").getTime();
    expect(
      assignmentStatusBucket({ status: "pending", approval_status: "pending", due_at: "2026-09-01" }, now),
    ).toBe("Overdue");
    expect(
      assignmentStatusBucket({ status: "completed", approval_status: "pending", due_at: "2026-09-01" }, now),
    ).toBe("Approved");
    const buckets = buildAuditStatusBuckets(
      [
        {
          id: "1",
          status: "pending",
          approval_status: "pending",
          store_id: "s",
          store_name: "A",
          due_at: null,
          created_at: "2026-09-10T00:00:00.000Z",
          assignee_id: "u",
          assignee_name: "Pat",
          template_id: null,
          template_name: "Expiry",
          operating_model: "local_store",
        },
        {
          id: "2",
          status: "completed",
          approval_status: "approved",
          store_id: "s",
          store_name: "A",
          due_at: null,
          created_at: "2026-09-10T00:00:00.000Z",
          assignee_id: "u",
          assignee_name: "Pat",
          template_id: null,
          template_name: "Expiry",
          operating_model: "local_store",
        },
      ],
      now,
    );
    expect(buckets.find((b) => b.name === "Assigned")?.value).toBe(1);
    expect(buckets.find((b) => b.name === "Approved")?.value).toBe(1);
  });

  it("groups recurring RCA codes with frequency >= 2", () => {
    const rows = [
      finding({ id: "a", status: "open", severity: "high", rca_code: "missing" }),
      finding({ id: "b", status: "open", severity: "high", rca_code: "missing", store_id: "store-2" }),
      finding({ id: "c", status: "open", severity: "low", rca_code: "damaged" }),
    ];
    const recurring = buildRecurringIssues(rows, new Date("2026-09-17T00:00:00.000Z").getTime());
    expect(recurring).toHaveLength(1);
    expect(recurring[0]?.issue).toBe("Missing");
    expect(recurring[0]?.frequency).toBe(2);
    expect(recurring[0]?.locations).toBe(2);
  });

  it("formats INR compactly", () => {
    expect(formatInrCompact(214000)).toBe("₹2.14L");
    expect(formatInrCompact(800)).toBe("₹800");
  });

  it("builds live universal KPIs and N/A for unwired catalog cards", () => {
    const payload = computeUniversalDashboardFromRows({
      model: "all",
      assignments: [
        {
          id: "asn-1",
          status: "completed",
          approval_status: "approved",
          store_id: "store-1",
          store_name: "Aislix India",
          due_at: null,
          created_at: "2026-09-10T00:00:00.000Z",
          assignee_id: "u1",
          assignee_name: "Pat",
          template_id: null,
          template_name: "Expiry",
          operating_model: "local_store",
        },
        {
          id: "asn-2",
          status: "pending",
          approval_status: "pending",
          store_id: "store-1",
          store_name: "Aislix India",
          due_at: null,
          created_at: "2026-09-11T00:00:00.000Z",
          assignee_id: "u1",
          assignee_name: "Pat",
          template_id: null,
          template_name: "Expiry",
          operating_model: "local_store",
        },
      ],
      findings: [
        finding({ id: "f1", status: "open", severity: "critical" }),
        finding({ id: "f2", status: "open", severity: "high", sku: "QA-02" }),
      ],
      actions: [
        action({ id: "ca-1", status: "open", due_at: "2026-09-01T00:00:00.000Z" }),
        action({ id: "ca-2", status: "closed", due_at: "2026-09-01T00:00:00.000Z" }),
      ],
      now: new Date("2026-09-17T12:00:00.000Z").getTime(),
    });

    expect(payload.labeledDemo).toBe(false);
    const byId = Object.fromEntries(payload.universalKpis.map((k) => [k.id, k]));
    expect(byId.audit_completion?.value).toBe("50%");
    expect(byId.audit_completion?.detail).toContain("1 / 2");
    expect(byId.open_findings?.value).toBe("2");
    expect(byId.critical_findings?.value).toBe("2");
    expect(byId.open_actions?.value).toBe("1");
    expect(byId.overdue_actions?.value).toBe("1");
    expect(byId.evidence_coverage?.value).toBe("N/A");
    expect(byId.evidence_coverage?.detail).toBe(NOT_WIRED_YET);
    expect(byId.sla_compliance?.available).toBe(false);
    expect(payload.contextualKpis.every((k) => k.value === "N/A")).toBe(true);
    expect(payload.auditSpecificKpis.every((k) => !k.available)).toBe(true);
    expect(payload.correctiveActionHealth.open).toBe(1);
    expect(payload.sla.available).toBe(false);
    expect(payload.evidenceCoverage.available).toBe(false);
  });
});
