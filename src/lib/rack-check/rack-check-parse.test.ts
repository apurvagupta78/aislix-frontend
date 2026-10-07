import { describe, expect, it } from "vitest";

import { MAX_BIN_ISSUES, normalizeCode, parseRackCheckPayload, rackCheckIssues } from "@/lib/rack-check/rack-check-parse";

const bin = (status: string, code: string | null = null, note = "") => ({ code, status, note });

describe("parseRackCheckPayload", () => {
  it("counts bins and is all stocked when every visible bin is stocked", () => {
    const r = parseRackCheckPayload({
      rack_code: "d07",
      shelves: [
        { shelf: "h", bins: [bin("stocked"), bin("stocked")] },
        { shelf: "G", bins: [bin("stocked"), bin("not_visible")] },
      ],
      image_quality: "good",
      summary: "Rack is full.",
    });
    expect(r.status).toBe("good");
    expect(r.rackCodeRead).toBe("D07");
    expect(r.shelves[0]?.shelf).toBe("H");
    expect(r.counts).toEqual({ total: 4, empty: 0, low: 0, stocked: 3, messy: 0, notVisible: 1 });
    expect(rackCheckIssues(r, null)).toEqual([]);
  });

  it("needs a refill when any bin is empty and opens one fix per empty or messy bin", () => {
    const r = parseRackCheckPayload({
      shelves: [{ shelf: "G", bins: [bin("empty", "AMB-D07G1", "nothing left"), bin("low"), bin("messy")] }],
      image_quality: "good",
    });
    expect(r.status).toBe("needs_refill");
    const issues = rackCheckIssues(r, "D07");
    expect(issues.map((i) => i.title)).toEqual(["Refill empty bin AMB-D07G1", "Tidy messy bin Rack D07, shelf G, bin 3"]);
    expect(issues[0]).toMatchObject({ severity: "high", findingType: "out_of_stock", identifiable: true });
    expect(issues[1]).toMatchObject({ severity: "medium", findingType: "shelf_execution_issue" });
  });

  it("only needs attention for low bins and opens no fix for them", () => {
    const r = parseRackCheckPayload({ shelves: [{ bins: [bin("low"), bin("stocked")] }], image_quality: "good" });
    expect(r.status).toBe("attention");
    expect(rackCheckIssues(r, null)).toEqual([]);
  });

  it("never gives a verdict or opens fixes on a poor photo", () => {
    const r = parseRackCheckPayload({ shelves: [{ bins: [bin("empty"), bin("empty")] }], image_quality: "poor" });
    expect(r.status).toBe("unclear");
    expect(rackCheckIssues(r, "D07")).toEqual([]);
  });

  it("is unclear when no bin could be judged, and none found when there are no bins", () => {
    expect(parseRackCheckPayload({ shelves: [{ bins: [bin("not_visible")] }] }).status).toBe("unclear");
    expect(parseRackCheckPayload({ shelves: [] }).status).toBe("none_found");
    expect(parseRackCheckPayload("not json").status).toBe("none_found");
  });

  it("treats unknown statuses as not visible instead of guessing", () => {
    const r = parseRackCheckPayload({ shelves: [{ bins: [bin("half"), bin("full")] }], image_quality: "good" });
    expect(r.shelves[0]?.bins.map((b) => b.status)).toEqual(["not_visible", "stocked"]);
  });

  it("positions bins without a code or rack by shelf and bin, and marks them not identifiable", () => {
    const r = parseRackCheckPayload({ shelves: [{ shelf: null, bins: [bin("stocked"), bin("empty")] }], image_quality: "good" });
    const issues = rackCheckIssues(r, null);
    expect(issues[0]).toMatchObject({ title: "Refill empty bin shelf 1 from top, bin 2", identifiable: false });
  });

  it("collapses many problem bins into one rack-level fix", () => {
    const bins = Array.from({ length: 12 }, () => bin("empty"));
    const r = parseRackCheckPayload({
      shelves: [{ shelf: "A", bins }, { shelf: "B", bins: [bin("messy"), bin("empty")] }],
      image_quality: "good",
    });
    const issues = rackCheckIssues(r, "F02");
    expect(r.counts.empty + r.counts.messy).toBeGreaterThan(MAX_BIN_ISSUES);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.title).toBe("Refill and tidy rack F02 — 13 empty, 1 messy bins");
  });
});

describe("normalizeCode", () => {
  it("keeps real codes and drops unread ones", () => {
    expect(normalizeCode(" amb-d07g2 ")).toBe("AMB-D07G2");
    expect(normalizeCode("unknown")).toBeNull();
    expect(normalizeCode("AMB D07?")).toBeNull();
    expect(normalizeCode(null)).toBeNull();
  });
});
