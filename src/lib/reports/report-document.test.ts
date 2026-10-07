import { describe, expect, it } from "vitest";

import {
  buildClaimReport,
  buildExecReport,
  buildFieldReport,
  buildStoreReport,
  locationLabel,
  reportShareText,
  type ClaimPack,
  type FieldCoverage,
  type ReportDocument,
} from "@/lib/reports/report-document";
import { buildReportPrintHtml } from "@/lib/reports/report-export";
import type { SegmentDashboard } from "@/lib/segments/segment-dashboard";

const meta = { from: "2026-09-07T00:00:00Z", to: "2026-10-07T00:00:00Z", labeledDemo: false };

const emptyCoverage: FieldCoverage = {
  from: meta.from,
  to: meta.to,
  totals: {
    visits: 0,
    stores_visited: 0,
    reps: 0,
    gps_visits: 0,
    on_site: 0,
    off_site: 0,
    no_store_location: 0,
    unplanned_visits: 0,
    planned: 0,
    planned_done: 0,
    planned_missed: 0,
    planned_open: 0,
    stores_planned: 0,
    stores_planned_visited: 0,
  },
  reps: [],
  stores: [],
  daily: [],
};

function visit(overrides: Partial<ClaimPack["audits"][number]> = {}): ClaimPack["audits"][number] {
  return {
    scan_id: "s1",
    store_id: "st1",
    store_name: "Gate Store",
    store_code: "G1",
    city: "Bengaluru",
    address: "Bengaluru",
    created_at: "2026-10-06T09:56:58Z",
    captured_by: "Asha",
    audit_mode: "ai",
    category: "Soft drinks",
    lat: null,
    lng: null,
    accuracy_m: null,
    gps_source: null,
    distance_m: null,
    location_status: "no_gps",
    original_bucket: "scan-images",
    original_path: "org/s1/photo.jpg",
    annotated_path: null,
    photo_count: 1,
    shelf_read: true,
    osa: 77.3,
    gaps: 1,
    products: 120,
    top_brands: [{ brand: "Squirt", share: 21.7 }],
    ...overrides,
  };
}

function allText(doc: ReportDocument): string {
  return JSON.stringify(doc) + buildReportPrintHtml(doc) + reportShareText(doc, "https://aislix.com/report");
}

describe("report documents", () => {
  it("shows N/A, never zero, when there is no data", () => {
    const field = buildFieldReport("distributor", emptyCoverage, meta);
    expect(field.empty).toBe(true);
    expect(field.kpis.every((k) => k.value === "N/A" && k.unavailable)).toBe(true);

    const exec = buildExecReport("supermarket", null, meta);
    expect(exec.empty).toBe(true);
    expect(exec.kpis.map((k) => k.value)).not.toContain("0");
  });

  it("reports planned vs done and explains missing GPS", () => {
    const doc = buildFieldReport(
      "distributor",
      {
        ...emptyCoverage,
        totals: { ...emptyCoverage.totals, visits: 282, reps: 3, stores_visited: 2, planned: 107, planned_done: 27, planned_missed: 20, planned_open: 60, unplanned_visits: 212 },
      },
      meta,
    );
    const byLabel = Object.fromEntries(doc.kpis.map((k) => [k.label, k]));
    expect(byLabel["Planned visits done"]!.value).toBe("27 of 107");
    expect(byLabel["Planned visits done"]!.context).toBe("20 missed · 60 still open");
    expect(byLabel["Visits with location proof"]!.value).toBe("0 of 282");
    expect(byLabel["Visits with location proof"]!.context).toMatch(/guided sweeps/);
    expect(doc.headline).toContain("3 people across 2 outlets");
  });

  it("keeps neighbouring KPI accents different", () => {
    const doc = buildClaimReport("fmcg", { from: meta.from, to: meta.to, totals: { audits: 1, stores: 1, with_photo: 1, gps_audits: 0, on_site: 0, off_site: 0 }, audits: [visit()] }, meta);
    for (let i = 1; i < doc.kpis.length; i += 1) expect(doc.kpis[i]!.accent).not.toBe(doc.kpis[i - 1]!.accent);
  });

  it("builds claim evidence rows with GPS status and photos", () => {
    const doc = buildClaimReport(
      "fmcg",
      {
        from: meta.from,
        to: meta.to,
        totals: { audits: 2, stores: 1, with_photo: 1, gps_audits: 1, on_site: 1, off_site: 0 },
        audits: [
          visit({ lat: 12.97161, lng: 77.59456, distance_m: 42, location_status: "on_site" }),
          visit({ scan_id: "s2", original_path: null, photo_count: 0, shelf_read: false, osa: null, gaps: null }),
        ],
      },
      meta,
    );
    const [first, second] = doc.tables[0]!.rows;
    expect(first).toContain("At store (42 m)");
    expect(first).toContain("12.97161, 77.59456");
    expect(second).toContain("No photo");
    expect(second![4]).toBe("N/A");
    expect(doc.photos).toHaveLength(1);
  });

  it("labels each location status", () => {
    expect(locationLabel({ location_status: "no_gps", distance_m: null })).toBe("No GPS");
    expect(locationLabel({ location_status: "off_site", distance_m: 1250 })).toBe("Away from store (1,250 m)");
    expect(locationLabel({ location_status: "no_store_location", distance_m: null })).toMatch(/store location not set/);
  });

  it("marks demo data in every export", () => {
    const doc = buildStoreReport("local", null, "Demo Kirana", { ...meta, labeledDemo: true });
    expect(reportShareText(doc, "https://aislix.com/report")).toContain("(demo data)");
    expect(buildReportPrintHtml(doc)).toContain("Demo data");
  });

  it("escapes store names in the print view", () => {
    const doc = buildClaimReport(
      "fmcg",
      { from: meta.from, to: meta.to, totals: { audits: 1, stores: 1, with_photo: 1, gps_audits: 0, on_site: 0, off_site: 0 }, audits: [visit({ store_name: "<img src=x onerror=alert(1)>" })] },
      meta,
    );
    const html = buildReportPrintHtml(doc);
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x");
  });

  it("never names an AI model", () => {
    const data = {
      totals: { audits: 1, stores: 1, shelf_read_audits: 1, avg_osa: 88.5, gaps: 34 },
      previous: {},
      trend: [],
      stores: [],
      brands: [],
      brand_audits: 0,
      actions: { open: 1, overdue: 0, critical_open: 0, created_in_period: 1, closed_in_period: 0 },
    } as unknown as SegmentDashboard;
    const docs = [
      buildExecReport("supermarket", data, meta),
      buildStoreReport("darkstore", data, "Site 1", meta),
      buildFieldReport("distributor", emptyCoverage, meta),
    ];
    for (const doc of docs) expect(allText(doc)).not.toMatch(/astra|luna|terra|gpt|openai|gemini|claude|anthropic/i);
  });
});
