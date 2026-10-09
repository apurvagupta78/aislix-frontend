import { describe, expect, it } from "vitest";
import { FALLBACK_INSIGHTS, plainText, summaryInsights } from "@/lib/ai-audit/executive-summary-insights";
import { actionVarianceType, variancesByStore, type InsightAction } from "@/lib/corrective-action-insights";

const SHELF_ONLY_PENDING = `## Audit Overview

Audit: Ad hoc shelf audit · Main shelf · Packaged Food & Snacks/Biscuits
Operating model: supermarket · Mode: Shelf-only

## Executive Findings

- Visual count verification pending review.
- Overall execution risk: CRITICAL.

## Overall KPI Summary

Products identified: 15
Brands identified: 10

## Risk & Priority

Overall execution risk: CRITICAL.
- Visual count verification pending review.

## Recommended Next Actions

- Reprocess scan or manually verify visual counts (count mismatch detected).
- Visual count verification pending review.`;

const DOCUMENT_OK = `## Executive Findings

- Planogram compliance: 100.0% (check-based).
- Overall execution risk: CRITICAL.

## Risk & Priority

Overall execution risk: CRITICAL.
- Estimated visible shelf coverage below high-risk threshold.
- Estimated visible shelf coverage below critical threshold.
- Estimated visible shelf coverage below high-risk threshold.

## Recommended Next Actions

- Estimated visible shelf coverage below high-risk threshold.
- Estimated visible shelf coverage below high-risk threshold.`;

const NO_RISK = `## Executive Findings

- Shelf audit completed with available visual evidence.

## Risk & Priority

Overall execution risk: NONE.

## Recommended Next Actions

No automated next actions — review detailed appendix.`;

describe("summaryInsights", () => {
  it("never leaks markdown headings or bullets", () => {
    for (const s of [SHELF_ONLY_PENDING, DOCUMENT_OK, NO_RISK]) {
      const out = summaryInsights(s);
      for (const v of Object.values(out)) {
        expect(v).not.toMatch(/#|^\s*-\s/);
        expect(v).not.toMatch(/Audit Overview|Executive Findings/);
      }
    }
  });

  it("uses KPI counts as the good news when every finding is a problem", () => {
    const out = summaryInsights(SHELF_ONLY_PENDING);
    expect(out.good).toBe("Products identified: 15 · Brands identified: 10.");
    expect(out.attention).toBe("Critical execution risk: Visual count verification pending review.");
    expect(out.nextAction).toContain("Reprocess scan or manually verify visual counts");
  });

  it("picks the positive finding and de-duplicates repeated actions", () => {
    const out = summaryInsights(DOCUMENT_OK);
    expect(out.good).toBe("Planogram compliance: 100.0% (check-based).");
    expect(out.attention).toMatch(/^Critical execution risk: Estimated visible shelf coverage below high-risk threshold\. \(\+1 more\)$/);
    expect(out.nextAction).toBe("Estimated visible shelf coverage below high-risk threshold.");
  });

  it("says nothing is flagged when the risk is none", () => {
    const out = summaryInsights(NO_RISK);
    expect(out.attention).toBe("Nothing flagged in this audit.");
    expect(out.nextAction).toMatch(/^No action needed/);
  });

  it("falls back for empty or legacy prose summaries", () => {
    expect(summaryInsights(null)).toEqual(FALLBACK_INSIGHTS);
    expect(summaryInsights("Shelf looks full. **Two** gaps on row 3. Restock chips.")).toEqual({
      good: "Shelf looks full.",
      attention: "Two gaps on row 3.",
      nextAction: "Restock chips.",
    });
  });

  it("strips inline markdown", () => {
    expect(plainText("## **Bold** `code` _it_")).toBe("Bold code it");
  });
});

function act(over: Partial<InsightAction>): InsightAction {
  return {
    status: "open",
    priority: "medium",
    source: "ai",
    action_type: null,
    created_at: "2026-10-01T00:00:00Z",
    closed_at: null,
    verified_at: null,
    due_at: null,
    assigned_name: "",
    store_id: "s1",
    store_name: "Store 1",
    escalation_level: 0,
    verification_status: null,
    before_score: null,
    after_score: null,
    code: null,
    title: "",
    issue_type: null,
    ...over,
  };
}

describe("actionVarianceType", () => {
  it.each([
    [{ issue_type: "unexpected", action_type: "planogram" }, "planogram"],
    [{ issue_type: "wrong_category", action_type: "planogram" }, "planogram"],
    [{ issue_type: "missing", action_type: "availability" }, "missing"],
    [{ issue_type: "missing_product", action_type: "availability" }, "missing"],
    [{ issue_type: "qty_mismatch", action_type: "planogram" }, "quantity"],
    [{ issue_type: "planogram_violation", action_type: "planogram", title: "Below planned quantity — Salt" }, "quantity"],
    [{ issue_type: "wrong_placement", action_type: "planogram" }, "location"],
    [{ issue_type: "wrong_location", action_type: "planogram" }, "location"],
    [{ issue_type: "wrong_product", action_type: "planogram" }, "product"],
    [{ issue_type: "pricing_issue", action_type: "pricing" }, "price"],
    [{ issue_type: "display_issue", action_type: "display" }, "promotion"],
    [{ issue_type: "something_new", action_type: null }, "other"],
  ])("%o → %s", (input, expected) => {
    expect(actionVarianceType(act(input as Partial<InsightAction>))).toBe(expected);
  });
});

describe("variancesByStore", () => {
  it("counts every action per store and type, and how many are not fixed", () => {
    const { rows, totals } = variancesByStore([
      act({ issue_type: "pricing_issue", action_type: "pricing" }),
      act({ issue_type: "missing", status: "closed" }),
      act({ store_id: "s2", store_name: "Store 2", issue_type: "wrong_location" }),
    ]);
    expect(rows[0]).toMatchObject({ storeId: "s1", total: 2, open: 1 });
    expect(rows[0]!.counts.price).toBe(1);
    expect(rows[0]!.counts.missing).toBe(1);
    expect(totals.location).toBe(1);
  });
});
