import { describe, expect, it } from "vitest";
import { auditChecks, isExtraFacing, matchesCheck, type CheckAction } from "./audit-checks";

const NOW = new Date("2026-10-09T12:00:00Z").getTime();
const iso = (minutesFromNow: number) => new Date(NOW + minutesFromNow * 60000).toISOString();

function action(over: Partial<CheckAction> = {}): CheckAction {
  return {
    id: "a1",
    code: null,
    title: "Fix shelf",
    status: "open",
    priority: "medium",
    source: "ai",
    action_type: "planogram",
    issue_type: null,
    sla_type: "corrective_action",
    sla_minutes: 60,
    created_at: iso(-30),
    due_at: iso(30),
    submitted_at: null,
    verified_at: null,
    closed_at: null,
    resolved_at: null,
    store_id: "s1",
    store_name: "Store 1",
    assigned_to: null,
    assigned_name: "",
    delay_reason: null,
    root_cause: null,
    before_score: null,
    after_score: null,
    verification_status: null,
    ...over,
  };
}

describe("isExtraFacing", () => {
  it("matches unplanned products and extra facings", () => {
    expect(isExtraFacing({ issue_type: "unexpected" })).toBe(true);
    expect(isExtraFacing({ title: "Unplanned product on shelf" })).toBe(true);
    expect(isExtraFacing({ issue_type: "missing_product", title: "Refill" })).toBe(false);
  });
});

describe("auditChecks", () => {
  const rows = [
    action({ id: "qty", issue_type: "quantity_shortfall" }),
    action({ id: "loc", issue_type: "wrong_location" }),
    action({ id: "extra", issue_type: "unexpected" }),
    action({ id: "done", status: "verified", submitted_at: iso(10), before_score: 60, after_score: 90 }),
    action({ id: "late", status: "closed", submitted_at: iso(45), before_score: 80, after_score: 70 }),
  ];

  it("summarises the five checks", () => {
    const checks = auditChecks(
      rows,
      [
        { scanId: "x", storeId: "s1", field: "visible_units", ai: 10, actual: 12, product: "A", verifiedAt: null },
        { scanId: "x", storeId: "s1", field: "facings", ai: 3, actual: 3, product: "B", verifiedAt: null },
      ],
      NOW,
    );
    expect(checks.quantity).toEqual({ checked: 2, differ: 1, avgGap: 2, openActions: 1 });
    expect(checks.location).toEqual({ total: 1, open: 1 });
    expect(checks.extraFacings).toEqual({ total: 1, open: 1 });
    expect(checks.implemented).toEqual({ total: 5, done: 2, pending: 3, onTime: 1, late: 1 });
    expect(checks.prePost).toEqual({ compared: 2, avgBefore: 70, avgAfter: 80, improvedPct: 50 });
  });

  it("shows no averages without data", () => {
    const checks = auditChecks([], [], NOW);
    expect(checks.quantity.avgGap).toBeNull();
    expect(checks.prePost.improvedPct).toBeNull();
  });

  it("filters the list by check", () => {
    expect(matchesCheck(rows[2]!, "extra_facings")).toBe(true);
    expect(matchesCheck(rows[3]!, "implemented")).toBe(true);
    expect(matchesCheck(rows[0]!, "pre_post")).toBe(false);
  });
});
