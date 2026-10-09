import { describe, expect, it } from "vitest";
import {
  actualMinutes,
  delayReasons,
  formatMinutes,
  isDueSoon,
  matchesSlaFilters,
  slaAlerts,
  slaByStore,
  slaByTeam,
  slaOutcome,
  slaSummary,
  slaTypeOf,
  targetMinutes,
  type SlaAction,
} from "./sla-insights";

const NOW = new Date("2026-10-09T12:00:00Z").getTime();
const iso = (minutesFromNow: number) => new Date(NOW + minutesFromNow * 60000).toISOString();

function action(over: Partial<SlaAction> = {}): SlaAction {
  return {
    id: "a1",
    code: "CA-1",
    title: "Refill shelf",
    status: "open",
    priority: "medium",
    source: "ai",
    action_type: "availability",
    issue_type: "missing_product",
    sla_type: "replenishment",
    sla_minutes: 15,
    created_at: iso(-10),
    due_at: iso(5),
    submitted_at: null,
    verified_at: null,
    closed_at: null,
    resolved_at: null,
    store_id: "s1",
    store_name: "Store 1",
    assigned_to: "u1",
    assigned_name: "Asha",
    delay_reason: null,
    root_cause: null,
    ...over,
  };
}

describe("slaOutcome", () => {
  it("judges confirmed fixes by the submission time", () => {
    const onTime = action({ status: "verified", submitted_at: iso(2), verified_at: iso(30) });
    expect(slaOutcome(onTime, NOW)).toBe("met");
    const late = action({ status: "closed", submitted_at: iso(8), closed_at: iso(9) });
    expect(slaOutcome(late, NOW)).toBe("breached");
  });

  it("waits for a confirmation before judging a submitted fix", () => {
    expect(slaOutcome(action({ status: "pending_verification", submitted_at: iso(1) }), NOW)).toBe("awaiting");
  });

  it("separates open, late open and no deadline", () => {
    expect(slaOutcome(action(), NOW)).toBe("open");
    expect(slaOutcome(action({ due_at: iso(-1) }), NOW)).toBe("late_open");
    expect(slaOutcome(action({ due_at: null }), NOW)).toBe("none");
  });
});

describe("targets and timing", () => {
  it("uses the saved minutes, else the deadline window", () => {
    expect(targetMinutes(action())).toBe(15);
    expect(targetMinutes(action({ sla_minutes: null, created_at: iso(-60), due_at: iso(60) }))).toBe(120);
    expect(targetMinutes(action({ sla_minutes: null, due_at: null }))).toBeNull();
  });

  it("measures time taken only for confirmed fixes", () => {
    expect(actualMinutes(action())).toBeNull();
    expect(actualMinutes(action({ status: "verified", submitted_at: iso(0) }))).toBeCloseTo(10);
  });

  it("flags due soon in the last 20% of the window", () => {
    expect(isDueSoon(action({ created_at: iso(-12), due_at: iso(3) }), NOW)).toBe(true);
    expect(isDueSoon(action({ created_at: iso(-2), due_at: iso(13) }), NOW)).toBe(false);
  });

  it("formats minutes, hours and days", () => {
    expect(formatMinutes(15)).toBe("15 min");
    expect(formatMinutes(90)).toBe("1.5 h");
    expect(formatMinutes(2880)).toBe("2 days");
    expect(formatMinutes(null)).toBe("N/A");
  });
});

describe("slaTypeOf", () => {
  it("prefers the saved type and falls back to the issue", () => {
    expect(slaTypeOf(action({ sla_type: "issue_resolution" }))).toBe("issue_resolution");
    expect(slaTypeOf(action({ sla_type: null, issue_type: "expired", action_type: null }))).toBe("expiry_damage");
    expect(slaTypeOf(action({ sla_type: null, issue_type: "out_of_stock", action_type: null }))).toBe("replenishment");
    expect(slaTypeOf(action({ sla_type: null, issue_type: "wrong_price", action_type: "pricing" }))).toBe(
      "corrective_action",
    );
  });
});

describe("summaries", () => {
  const rows = [
    action({ id: "met", status: "verified", submitted_at: iso(2) }),
    action({ id: "late", status: "closed", submitted_at: iso(9), delay_reason: "Stock not delivered" }),
    action({ id: "lateOpen", due_at: iso(-30), store_id: "s2", store_name: "Store 2", assigned_to: "u2" }),
    action({ id: "open", due_at: iso(600), created_at: iso(-10) }),
    action({ id: "awaiting", status: "pending_verification", submitted_at: iso(1) }),
  ];

  it("counts compliance from judged actions only", () => {
    const s = slaSummary(rows, NOW);
    expect(s).toMatchObject({ total: 5, met: 1, breached: 1, lateOpen: 1, open: 1, awaiting: 1 });
    expect(s.breaches).toBe(2);
    expect(s.pending).toBe(3);
    expect(s.compliancePct).toBe(33);
  });

  it("shows no compliance when nothing is judged yet", () => {
    expect(slaSummary([action()], NOW).compliancePct).toBeNull();
  });

  it("ranks stores by breaches", () => {
    const stores = slaByStore(rows, NOW);
    expect(stores[0]!.label).toBe("Store 1");
    expect(stores.find((r) => r.key === "s2")!.breaches).toBe(1);
  });

  it("groups owners under their manager", () => {
    const teams = slaByTeam(rows, [
      { user_id: "u1", name: "Asha", reports_to: "m1" },
      { user_id: "u2", name: "Ben", reports_to: "m1" },
      { user_id: "m1", name: "Maya" },
    ], NOW);
    expect(teams).toHaveLength(1);
    expect(teams[0]!.label).toBe("Maya's team");
    expect(teams[0]!.total).toBe(5);
  });

  it("lists delay reasons for missed deadlines", () => {
    expect(delayReasons(rows, NOW)).toEqual([
      { reason: "Stock not delivered", count: 1 },
      { reason: "Still open, no reason yet", count: 1 },
    ]);
  });

  it("raises due-soon and missed alerts", () => {
    const alerts = slaAlerts([action({ id: "soon", created_at: iso(-12), due_at: iso(3) }), rows[2]!], NOW);
    expect(alerts.map((a) => [a.id, a.kind])).toEqual([
      ["soon", "due_soon"],
      ["lateOpen", "missed"],
    ]);
  });

  it("filters by type and outcome", () => {
    expect(matchesSlaFilters(rows[2]!, "replenishment", "breached", NOW)).toBe(true);
    expect(matchesSlaFilters(rows[2]!, "expiry_damage", "all", NOW)).toBe(false);
    expect(matchesSlaFilters(rows[0]!, "all", "met", NOW)).toBe(true);
  });
});
