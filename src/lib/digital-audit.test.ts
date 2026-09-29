import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import {
  evidenceKey,
  parseDelimitedText,
  parseEvidenceKey,
  validateDigitalAuditSubmit,
  type AuditEvidence,
  type DigitalAuditLine,
  type DigitalAuditSession,
} from "@/lib/digital-audit";

function line(id: string, overrides: Partial<DigitalAuditLine> = {}): DigitalAuditLine {
  return {
    id,
    scan_id: "scan",
    match_key: null,
    sku: `SKU-${id}`,
    item_code: null,
    barcode: null,
    brand: null,
    product_name: `Product ${id}`,
    category: null,
    sub_category: null,
    location: "A1",
    bin_key: "A1",
    expected_qty: 5,
    system_qty: null,
    actual_qty: 5,
    mrp_inr: null,
    variance_qty: 0,
    variance_pct: 0,
    variance_value_inr: null,
    rca_code: null,
    rca_notes: null,
    planogram_item_id: null,
    ...overrides,
  };
}

function ev(key: string, storage = "path.jpg"): AuditEvidence {
  const parsed = parseEvidenceKey(key);
  return {
    id: key,
    bin_key: key,
    kind: parsed.kind,
    target: parsed.target,
    storage_path: storage,
    captured_at: new Date().toISOString(),
  };
}

function session(overrides: Partial<DigitalAuditSession> = {}): DigitalAuditSession {
  return {
    scan_id: "scan",
    assignment_id: "a",
    store_id: "s",
    store_name: "Store",
    submission_status: "incomplete",
    lines: [line("1")],
    evidence: [ev("A1")],
    bins: ["A1"],
    policy: null,
    require_rca: true,
    ...overrides,
  };
}

describe("parseDelimitedText", () => {
  it("strips BOM, handles quotes and embedded commas", () => {
    const rows = parseDelimitedText('\uFEFFSKU,Product Name,Actual Qty\r\nA1,"Chips, 50g",4\n"B""2",Soap,\n');
    expect(rows).toEqual([
      ["SKU", "Product Name", "Actual Qty"],
      ["A1", "Chips, 50g", "4"],
      ['B"2', "Soap", ""],
    ]);
  });

  it("detects semicolon and tab delimiters", () => {
    expect(parseDelimitedText("sku;actual\nX;3")[1]).toEqual(["X", "3"]);
    expect(parseDelimitedText("sku\tactual\nX\t3")[1]).toEqual(["X", "3"]);
  });
});

describe("validateDigitalAuditSubmit with evidence policy", () => {
  it("legacy assignments only need counts + shelf photos", () => {
    expect(validateDigitalAuditSubmit(session()).ok).toBe(true);
  });

  it("enforces every selected proof", () => {
    const s = session({
      policy: {
        level: "high",
        requiredProof: ["context_photo", "per_sku_photo", "barcode", "gps", "live_session_video"],
        captureSource: "either",
        minimumPhotos: 1,
        maximumEvidenceAgeMinutes: 15,
        qualityChecks: [],
        reviewMode: "manager",
      },
      lines: [line("1", { barcode: "890" })],
    });
    const result = validateDigitalAuditSubmit(s, { hasGps: false });
    expect(result.ok).toBe(false);
    expect(result.unmetRequirements.map((r) => r.id).sort()).toEqual(
      ["barcode", "gps", "live_session_video", "per_sku_photo"].sort(),
    );

    const done = validateDigitalAuditSubmit(
      {
        ...s,
        evidence: [
          ev("A1"),
          ev(evidenceKey.sku("1")),
          ev(evidenceKey.barcode("1"), ""),
          ev(evidenceKey.proof("live_session_video")),
        ],
      },
      { hasGps: true },
    );
    expect(done.ok).toBe(true);
  });

  it("variance photo only required on variance lines; RCA optional when disabled", () => {
    const s = session({
      require_rca: false,
      policy: {
        level: "standard",
        requiredProof: ["context_photo", "variance_photo", "device_metadata"],
        captureSource: "either",
        minimumPhotos: 1,
        maximumEvidenceAgeMinutes: 60,
        qualityChecks: [],
        reviewMode: "manager",
      },
      lines: [line("1"), line("2", { actual_qty: 2 })],
    });
    const result = validateDigitalAuditSubmit(s);
    expect(result.missingRca).toEqual([]);
    expect(result.unmetRequirements.map((r) => r.id)).toEqual(["variance_photo"]);
    expect(result.unmetRequirements[0]!.missing).toEqual(["Product 2"]);
  });
});
