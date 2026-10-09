import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { draftProblem, emptyDraft, itemsFromDrafts, slaMinutesOf } from "@/lib/audit-action-form";
import { issueCategoryOf } from "@/lib/corrective-action-catalog";

const draft = (patch: Parameters<typeof Object.assign>[1]) =>
  Object.assign(emptyDraft("p1", "Lay's Magic Masala", "LAY-52"), patch);

describe("slaMinutesOf", () => {
  it("reads the preset choices", () => {
    expect(slaMinutesOf(draft({ sla: "60" }))).toBe(60);
    expect(slaMinutesOf(draft({ sla: "2880" }))).toBe(2880);
  });

  it("converts Other hours and days", () => {
    expect(slaMinutesOf(draft({ sla: "other", otherAmount: "6", otherUnit: "hours" }))).toBe(360);
    expect(slaMinutesOf(draft({ sla: "other", otherAmount: "3", otherUnit: "days" }))).toBe(4320);
    expect(slaMinutesOf(draft({ sla: "other", otherAmount: "0.5", otherUnit: "hours" }))).toBe(30);
  });

  it("rejects blank, zero and out-of-range Other values", () => {
    expect(slaMinutesOf(draft({ sla: "other", otherAmount: "" }))).toBeNull();
    expect(slaMinutesOf(draft({ sla: "other", otherAmount: "0" }))).toBeNull();
    expect(slaMinutesOf(draft({ sla: "other", otherAmount: "0.1", otherUnit: "hours" }))).toBeNull();
    expect(slaMinutesOf(draft({ sla: "other", otherAmount: "31", otherUnit: "days" }))).toBeNull();
  });
});

describe("draft validation", () => {
  it("ignores products with no issue", () => {
    expect(draftProblem(draft({ category: null, sla: "other" }))).toBeNull();
    expect(itemsFromDrafts([draft({ category: null })])).toEqual([]);
  });

  it("needs a description for Other and a valid deadline", () => {
    expect(draftProblem(draft({ category: "other", detail: " " }))).toBe("Describe the issue");
    expect(draftProblem(draft({ category: "location", sla: "other", otherAmount: "" }))).toMatch(/deadline/);
    expect(draftProblem(draft({ category: "location" }))).toBeNull();
  });

  it("builds the items sent to the database", () => {
    expect(itemsFromDrafts([draft({ category: "location", sla: "720" })])).toEqual([
      { category: "location", detail: null, product: "Lay's Magic Masala", sku: "LAY-52", sla_minutes: 720 },
    ]);
  });
});

describe("issueCategoryOf", () => {
  it("keeps a saved issue type", () => {
    expect(issueCategoryOf({ issue_category: "branding", issue_type: "missing" })).toBe("branding");
  });

  it("maps older AI actions the same way as the database", () => {
    expect(issueCategoryOf({ issue_type: "unexpected", title: "23 facing(s) belong elsewhere" })).toBe("location");
    expect(issueCategoryOf({ issue_type: "qty_mismatch", suggestion: "Replenish Lays — 2 unit(s) required." })).toBe(
      "less_quantity",
    );
    expect(
      issueCategoryOf({ issue_type: "qty_mismatch", suggestion: "Remove 6 extra facing(s) of Lays Tomato Tango." }),
    ).toBe("more_quantity");
    expect(issueCategoryOf({ issue_type: "inventory_shortage" })).toBe("less_quantity");
    expect(issueCategoryOf({ issue_type: "inventory_excess" })).toBe("more_quantity");
    expect(issueCategoryOf({ issue_type: "missing", action_type: "availability" })).toBe("less_quantity");
    expect(issueCategoryOf({ issue_type: "wrong_product" })).toBe("branding");
    expect(issueCategoryOf({ issue_type: "damaged_product", action_type: "inventory" })).toBe("damaged");
    expect(issueCategoryOf({ issue_type: "planogram_violation" })).toBe("planogram");
    expect(issueCategoryOf({ issue_type: "facings_short" })).toBe("facing");
  });

  it("re-classifies the retired Quantity issue", () => {
    expect(issueCategoryOf({ issue_category: "quantity", issue_type: "manual_quantity" })).toBe("less_quantity");
  });
});
