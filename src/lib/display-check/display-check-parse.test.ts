import { describe, expect, it } from "vitest";

import { displayCheckIssues, parseDisplayCheckPayload } from "@/lib/display-check/display-check-parse";

const item = (over: Record<string, unknown> = {}) => ({
  type: "wobbler",
  brand: "Dove",
  condition: "good",
  placement: "eye_level",
  visible: true,
  notes: "Clean wobbler on the shelf edge.",
  confidence: 0.9,
  ...over,
});

describe("parseDisplayCheckPayload", () => {
  it("is good when every display is intact", () => {
    const r = parseDisplayCheckPayload({ items: [item()], image_quality: "good", summary: "One Dove wobbler." }, null);
    expect(r.status).toBe("good");
    expect(r.items[0]).toMatchObject({ type: "wobbler", brand: "Dove", condition: "good", placement: "eye_level" });
    expect(displayCheckIssues(r, null)).toEqual([]);
  });

  it("needs a fix when a display is damaged or empty, one fix per display", () => {
    const r = parseDisplayCheckPayload(
      { items: [item({ condition: "damaged" }), item({ type: "shelf strip", condition: "missing", brand: null })] },
      null,
    );
    expect(r.status).toBe("needs_fix");
    expect(r.items[1]?.type).toBe("shelf_strip");
    const issues = displayCheckIssues(r, null);
    expect(issues.map((i) => i.title)).toEqual(["Damaged display — Dove wobbler", "Empty display — shelf strip"]);
  });

  it("flags the expected brand as missing when only other brands are present", () => {
    const r = parseDisplayCheckPayload(
      { items: [item({ brand: "Pantene" })], expected_brand_present: false, image_quality: "good" },
      "Dove",
    );
    expect(r.status).toBe("missing");
    expect(displayCheckIssues(r, "Dove")[0]).toMatchObject({ title: "Display missing — Dove", severity: "high" });
  });

  it("matches the expected brand loosely and trusts what was seen over the AI flag", () => {
    const r = parseDisplayCheckPayload(
      { items: [item({ brand: "DOVE Hair" })], expected_brand_present: false, image_quality: "good" },
      "dove",
    );
    expect(r.status).toBe("good");
  });

  it("asks for a retake instead of raising a fix when the photo is unclear", () => {
    expect(parseDisplayCheckPayload({ items: [], image_quality: "poor" }, null).status).toBe("unclear");
    const r = parseDisplayCheckPayload({ items: [], expected_brand_present: null, image_quality: "poor" }, "Dove");
    expect(r.status).toBe("unclear");
    expect(displayCheckIssues(r, "Dove")).toEqual([]);
  });

  it("reports no displays when a clear photo has none", () => {
    expect(parseDisplayCheckPayload({ items: [], image_quality: "good" }, null).status).toBe("none_found");
  });

  it("drops unknown brands, clamps confidence and hides model names", () => {
    const r = parseDisplayCheckPayload(
      { items: [item({ brand: "Unknown", confidence: 3, notes: "Luna thinks this is fine." })], summary: "Astra saw one display." },
      null,
    );
    expect(r.items[0]?.brand).toBeNull();
    expect(r.items[0]?.confidence).toBe(1);
    expect(r.items[0]?.notes).not.toMatch(/luna/i);
    expect(r.summary).not.toMatch(/astra/i);
  });

  it("survives junk payloads", () => {
    const r = parseDisplayCheckPayload("not json", null);
    expect(r.items).toEqual([]);
    expect(r.status).toBe("none_found");
  });
});
