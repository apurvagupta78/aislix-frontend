import { describe, expect, it } from "vitest";

import { resolveAskAislixQueryFilters } from "./ask-aislix-filters";

const now = new Date(2026, 9, 7, 12);

describe("resolveAskAislixQueryFilters", () => {
  it("defaults to the last 90 days", () => {
    expect(resolveAskAislixQueryFilters(undefined, "Which stores need attention?", now).datePreset).toBe("90d");
  });

  it("applies the period chip", () => {
    expect(resolveAskAislixQueryFilters("7d", "Which stores need attention?", now).datePreset).toBe("7d");
    const q = resolveAskAislixQueryFilters("quarter", "Which stores need attention?", now);
    expect(q).toMatchObject({ datePreset: "custom", dateFrom: "2026-10-01" });
    expect(resolveAskAislixQueryFilters("ytd", "Open findings?", now).dateFrom).toBe("2026-01-01");
  });

  it("lets a timeframe in the question override the chip", () => {
    const q = resolveAskAislixQueryFilters("30d", "Which products were adjusted most often in the last 6 months?", now);
    expect(q).toMatchObject({ datePreset: "custom", dateFrom: "2026-04-10" });
    expect(resolveAskAislixQueryFilters("90d", "Variance over the last 30 days?", now).dateFrom).toBe("2026-09-07");
    expect(resolveAskAislixQueryFilters("90d", "Audits this month", now).dateFrom).toBe("2026-10-01");
    expect(resolveAskAislixQueryFilters("7d", "Findings since 2025", now).datePreset).toBe("all");
  });

  it("ignores the scope tag appended from the chips", () => {
    const q = resolveAskAislixQueryFilters("30d", "Open findings? (Scope: All stores, Last 30 days)", now);
    expect(q.datePreset).toBe("30d");
  });
});
