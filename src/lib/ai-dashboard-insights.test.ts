import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/db/context", () => ({ getUser: vi.fn(), requireOrgId: vi.fn() }));
vi.mock("@/lib/demo-environment", () => ({ resolveDemoExperience: vi.fn() }));
vi.mock("@/lib/ai-audit/astra-response", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ai-audit/astra-response")>()),
  astraAnalysisFromScanResult: (r: { metrics: { analysis: unknown } }) => r.metrics.analysis,
}));

import type { AstraPlanogramProduct } from "@/lib/ai-audit/astra-response";
import type { LifecycleAction } from "@/lib/corrective-action-lifecycle";
import { teamUserIds } from "@/lib/ai-dashboard-scope";
import { filterAiActions } from "@/lib/ai-dashboard-actions";
import { slaCompliance } from "@/lib/corrective-action-insights";
import { summariseVariances, type VarianceScanInput } from "@/lib/ai-variance-summary";

describe("teamUserIds", () => {
  it("includes the manager and every indirect report, but not other teams", () => {
    const members = [
      { user_id: "lead", reports_to: null },
      { user_id: "sup", reports_to: "lead" },
      { user_id: "auditor", reports_to: "sup" },
      { user_id: "other", reports_to: "someone-else" },
    ];
    expect([...teamUserIds(members, "lead")].sort()).toEqual(["auditor", "lead", "sup"]);
    expect([...teamUserIds(members, "sup")].sort()).toEqual(["auditor", "sup"]);
  });
});

function action(over: Partial<LifecycleAction>): LifecycleAction {
  return {
    id: "a",
    finding_id: null,
    scan_id: null,
    store_id: "s1",
    org_id: "o",
    title: "Restock Lay's Classic",
    description: null,
    suggestion: "",
    issue_type: "oos",
    priority: "high",
    status: "open",
    assigned_to: "u1",
    assigned_name: "Asha",
    created_by: null,
    sla_hours: 24,
    due_at: null,
    created_at: "2026-10-05T10:00:00Z",
    start_at: null,
    resolved_at: null,
    resolution_notes: null,
    resolution_qty: null,
    verified_by: null,
    verified_at: null,
    rejection_reason: null,
    closed_at: null,
    resolved_by_verification: false,
    sku: null,
    code: null,
    source: "ai",
    action_type: null,
    root_cause: null,
    preventive_action: null,
    evidence_required: [],
    verification_method: null,
    verification_status: null,
    before_score: null,
    after_score: null,
    verification_scan_id: null,
    escalation_level: 0,
    escalated_at: null,
    submitted_at: null,
    store_name: "Store 1",
    ...over,
  };
}

describe("filterAiActions", () => {
  const all = { stores: null, people: null, from: null, to: null, sku: "" };

  it("keeps only AI actions", () => {
    const rows = [action({ id: "ai" }), action({ id: "digital", source: "digital" })];
    expect(filterAiActions(rows, all).map((a) => a.id)).toEqual(["ai"]);
  });

  it("applies store, people, date and SKU filters", () => {
    const rows = [
      action({ id: "keep" }),
      action({ id: "other-store", store_id: "s2" }),
      action({ id: "other-person", assigned_to: "u9" }),
      action({ id: "too-old", created_at: "2026-09-01T00:00:00Z" }),
      action({ id: "other-sku", title: "Fix price tag", sku: "BINGO-1" }),
    ];
    const kept = filterAiActions(rows, {
      stores: new Set(["s1"]),
      people: new Set(["u1"]),
      from: new Date("2026-10-01T00:00:00Z"),
      to: null,
      sku: "lay's",
    });
    expect(kept.map((a) => a.id)).toEqual(["keep"]);
  });
});

describe("slaCompliance", () => {
  it("counts fixed actions closed by their due date", () => {
    const rows = [
      action({ status: "closed", due_at: "2026-10-06T00:00:00Z", closed_at: "2026-10-05T12:00:00Z" }),
      action({ status: "verified", due_at: "2026-10-06T00:00:00Z", verified_at: "2026-10-07T00:00:00Z" }),
      action({ status: "open", due_at: "2026-10-06T00:00:00Z" }),
      action({ status: "closed", due_at: null, closed_at: "2026-10-05T12:00:00Z" }),
    ];
    expect(slaCompliance(rows)).toEqual({ met: 1, total: 2, pct: 50 });
  });

  it("returns N/A (null) when nothing with an SLA was fixed", () => {
    expect(slaCompliance([action({})]).pct).toBeNull();
  });
});

function planned(over: Partial<AstraPlanogramProduct>): AstraPlanogramProduct {
  return {
    location: "A-1",
    category: "Snacks",
    subcategory: "Chips",
    brand: "Lay's",
    brand_status: "MATCHED",
    product_name: "potato chips",
    product_status: "MATCHED",
    variant: "Classic Salted",
    variant_status: "MATCHED",
    sku: "LAYS-CL",
    sku_status: "",
    expected_facings: 6,
    actual_facings: 6,
    facing_variance: 0,
    facing_compliance_percent: 100,
    min_facings: 0,
    max_facings: 0,
    facing_range_status: "",
    expected_shelf_units: 0,
    actual_visible_units: 12,
    shelf_unit_variance: null,
    shelf_unit_compliance_percent: null,
    expected_shelf_position: "",
    actual_shelf_position: "",
    placement_status: "",
    expected_mrp_inr: 20,
    visible_price: "₹20",
    price_status: "MATCH",
    price_difference: 0,
    price_source: "SHELF_TAG",
    expected_location: "AMB-D0303",
    actual_location_label: "AMB-D0303",
    actual_location_label_status: "READ",
    actual_rack_marker: null,
    additional_location_labels: [],
    location_status: "CORRECT",
    avg_daily_sales: 0,
    estimated_visible_shelf_coverage_days: null,
    visible_unit_shortfall: null,
    potential_visible_unit_value_gap_inr: null,
    risk_status: "",
    overall_status: "",
    match_status: "MATCHED",
    confidence: 0.9,
    evidence_note: "",
    ...over,
  };
}

function scan(id: string, store: string, products: AstraPlanogramProduct[]): VarianceScanInput {
  return {
    scanId: id,
    date: "2026-10-08T10:00:00Z",
    store,
    city: "Delhi",
    team: "Asha's team",
    category: null,
    metrics: {
      analysis: {
        mode: "planogram",
        products,
        brand_analysis: [],
        category_analysis: [],
        subcategory_analysis: [],
        observed_unplanned_products: [],
        summary: {},
      },
    },
    inventory: [],
    verifications: [],
  };
}

describe("summariseVariances", () => {
  const scans = [
    scan("s1", "Store A", [planned({ actual_facings: 4, facing_variance: -2 })]),
    scan("s2", "Store B", [planned({ sku: "BINGO-1", brand: "Bingo", product_name: "Mad Angles", variant: "" })]),
  ];

  it("totals facings variances per field and groups by store", () => {
    const summary = summariseVariances(scans);
    expect(summary.auditsWithPlan).toBe(2);
    const facings = summary.fields.find((f) => f.key === "facings")!;
    expect(facings.checked).toBe(2);
    expect(facings.variances).toBe(1);
    const storeA = summary.groups.store.find((g) => g.label === "Store A")!;
    expect(storeA.variances).toBeGreaterThanOrEqual(1);
    const record = summary.records.find((r) => r.field === "facings")!;
    expect(record).toMatchObject({ scanId: "s1", store: "Store A", difference: -2 });
  });

  it("narrows to a SKU", () => {
    const summary = summariseVariances(scans, { sku: "bingo" });
    expect(summary.groups.sku.map((g) => g.label)).toEqual(["BINGO-1"]);
    expect(summary.fields.find((f) => f.key === "facings")!.variances).toBe(0);
  });

  it("skips audits without a plan", () => {
    const noPlan = { ...scan("s3", "Store C", []), metrics: null };
    expect(summariseVariances([noPlan]).auditsWithPlan).toBe(0);
  });
});
