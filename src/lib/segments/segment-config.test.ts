import { describe, expect, it } from "vitest";

import {
  buildSegmentKpis,
  normalizeSegmentId,
  SEGMENT_CONFIG,
  SEGMENT_IDS,
  segmentHeadline,
} from "@/lib/segments/segment-config";
import { resolveSegmentPeriod, type SegmentDashboard } from "@/lib/segments/segment-dashboard";

const MODEL_NAMES = /astra|luna|terra|gpt|openai|gemini|claude|anthropic/i;

function dashboard(overrides: Partial<SegmentDashboard["totals"]> = {}): SegmentDashboard {
  return {
    from: "2026-07-01T00:00:00Z",
    to: "2026-10-01T00:00:00Z",
    totals: {
      audits: 12,
      stores: 3,
      shelf_read_audits: 12,
      avg_osa: 91.5,
      avg_sos: null,
      avg_health: 78,
      avg_planogram: null,
      planogram_audits: 0,
      facings: 640,
      gaps: 14,
      low_stock: 30,
      misplaced: 0,
      at_risk_skus: null,
      value_gap_inr: null,
      priced_audits: 0,
      gps_audits: 4,
      sweep_audits: 2,
      ...overrides,
    },
    previous: { audits: 10, stores: 3, avg_osa: 88, gaps: 20, low_stock: 30 },
    trend: [],
    stores: [],
    brands: [],
    brand_audits: 0,
    actions: { open: 5, overdue: 2, critical_open: 1, created_in_period: 6, closed_in_period: 1 },
  };
}

describe("segment config", () => {
  it("covers all five customer segments", () => {
    expect(SEGMENT_IDS).toEqual(["supermarket", "darkstore", "fmcg", "distributor", "local"]);
    for (const id of SEGMENT_IDS) expect(SEGMENT_CONFIG[id].kpis.length).toBeGreaterThanOrEqual(4);
  });

  it("maps workspace business types onto a segment", () => {
    expect(normalizeSegmentId("warehouse")).toBe("darkstore");
    expect(normalizeSegmentId("kirana")).toBe("local");
    expect(normalizeSegmentId(null)).toBe("supermarket");
  });

  it("never puts the same accent on neighbouring KPI cards", () => {
    for (const id of SEGMENT_IDS) {
      const kpis = buildSegmentKpis(SEGMENT_CONFIG[id], dashboard());
      for (let i = 1; i < kpis.length; i++) expect(kpis[i]!.accent).not.toBe(kpis[i - 1]!.accent);
    }
  });

  it("shows N/A instead of zero when there are no AI audits", () => {
    for (const id of SEGMENT_IDS) {
      const kpis = buildSegmentKpis(SEGMENT_CONFIG[id], dashboard({ audits: 0, stores: 0, gaps: 0, low_stock: 0 }));
      for (const k of kpis.filter((k) => !k.id.endsWith("_actions"))) {
        expect(k.value).not.toBe("0");
      }
    }
  });

  it("never reports zero problems when the AI did not read the shelf", () => {
    const unread = dashboard({ shelf_read_audits: 0, gaps: null, low_stock: null, misplaced: null, facings: null });
    expect(segmentHeadline(SEGMENT_CONFIG.distributor, unread)).toBe(
      "12 AI audits across 3 outlets. Shelf counts are not available for these audits.",
    );
    const kpis = buildSegmentKpis(SEGMENT_CONFIG.distributor, unread);
    const gaps = kpis.find((k) => k.id === "gaps")!;
    expect(gaps.value).toBe("N/A");
    expect(gaps.context).toBe("Data unavailable for these audits");
  });

  it("keeps value at risk unavailable unless audits were priced", () => {
    const [, , , value] = buildSegmentKpis(SEGMENT_CONFIG.fmcg, dashboard());
    expect(value!.id).toBe("value_gap");
    expect(value!.value).toBe("N/A");
    const priced = buildSegmentKpis(SEGMENT_CONFIG.fmcg, dashboard({ value_gap_inr: 1250, priced_audits: 2 }));
    expect(priced[3]!.value).toBe("₹1,250");
  });

  it("reports deltas against the previous period with the right direction", () => {
    const [availability, gaps] = buildSegmentKpis(SEGMENT_CONFIG.supermarket, dashboard());
    expect(availability!.delta).toBeCloseTo(3.5);
    expect(gaps!.delta).toBe(-6);
    expect(gaps!.lowerIsBetter).toBe(true);
  });

  it("writes a plain headline and no model names", () => {
    expect(segmentHeadline(SEGMENT_CONFIG.distributor, dashboard())).toBe(
      "12 AI audits across 3 outlets found 14 empty gaps and 30 low-stock lines.",
    );
    expect(segmentHeadline(SEGMENT_CONFIG.local, dashboard({ audits: 0 }))).toBeNull();
    expect(segmentHeadline(SEGMENT_CONFIG.supermarket, dashboard({ audits: 1, stores: 1 }))).toBe(
      "1 AI audit across 1 store found 14 empty gaps and 30 low-stock lines.",
    );
    for (const id of SEGMENT_IDS) {
      const c = SEGMENT_CONFIG[id];
      const kpis = buildSegmentKpis(c, dashboard());
      const text = [c.label, c.question, c.value, c.brandsTitle, c.storesTitle, c.trend.title]
        .concat(kpis.flatMap((k) => [k.label, k.context]))
        .join(" ");
      expect(text).not.toMatch(MODEL_NAMES);
    }
  });
});

describe("segment period", () => {
  const now = new Date("2026-10-07T12:00:00Z");

  it("falls back to the last 90 days for all time", () => {
    const p = resolveSegmentPeriod({ datePreset: "all", dateFrom: "", dateTo: "" }, now);
    expect(p.label).toBe("Last 90 days");
    expect(now.getTime() - p.from.getTime()).toBe(90 * 86_400_000);
  });

  it("uses the selected range when the filter has one", () => {
    const p = resolveSegmentPeriod({ datePreset: "custom", dateFrom: "2026-09-01", dateTo: "2026-09-30" }, now);
    expect(p.label).toBe("Selected 30 days");
  });
});
