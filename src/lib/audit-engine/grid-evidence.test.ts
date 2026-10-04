import { describe, expect, it } from "vitest";

import { rowEvidenceFromPolicy } from "@/lib/audit-evidence-policy";
import type { AuditInputDataset } from "@/lib/audit-input-dataset";
import {
  AUDIT_EVIDENCE_SECTION,
  SHELF_EVIDENCE_SECTION,
  barcodeMatches,
  distinctShelves,
  evaluateGridEvidence,
  shelfSlots,
  suggestBarcodeColumn,
  suggestShelfColumn,
  type GridEvidenceRow,
} from "@/lib/audit-engine/grid-evidence";

const dataset: AuditInputDataset = {
  source: "csv",
  filename: "stock.csv",
  columns: [
    { id: "c1", name: "Product", type: "text" },
    { id: "c2", name: "Aisle", type: "text" },
    { id: "c3", name: "EAN", type: "text" },
  ],
  rows: [
    { id: "r1", values: { c1: "Soap", c2: "A1", c3: "8901" } },
    { id: "r2", values: { c1: "Shampoo", c2: "a1 ", c3: "" } },
    { id: "r3", values: { c1: "Paste", c2: "B2", c3: "8903" } },
  ],
} as AuditInputDataset;

const rows: GridEvidenceRow[] = dataset.rows.map((_, index) => ({
  index,
  position: index,
  values: {},
  hasMismatch: index === 2,
  rowEvidenceStatus: "not_required",
}));

const byId = (list: ReturnType<typeof evaluateGridEvidence>) => new Map(list.map((r) => [r.id, r]));

describe("grid evidence", () => {
  it("derives the row photo rule from the selected proofs", () => {
    expect(rowEvidenceFromPolicy({ requiredProof: ["per_sku_photo", "variance_photo"] })).toBe("required");
    expect(rowEvidenceFromPolicy({ requiredProof: ["variance_photo"] })).toBe("on_mismatch");
    expect(rowEvidenceFromPolicy({ requiredProof: ["context_photo"] })).toBe("optional");
  });

  it("suggests shelf and barcode columns and groups shelves case-insensitively", () => {
    expect(suggestShelfColumn(dataset)).toBe("c2");
    expect(suggestBarcodeColumn(dataset)).toBe("c3");
    expect(distinctShelves(dataset, "c2")).toEqual(["A1", "B2"]);
    expect(shelfSlots(dataset, null)).toEqual([{ index: 0, name: "", label: "Whole audit area" }]);
  });

  it("requires one photo per shelf and both photos for before and after", () => {
    const responses = {
      [SHELF_EVIDENCE_SECTION]: {
        0: { shelf: "A1", shelf_photo: ["p1"], after_photo: ["p2"] },
        1: { shelf: "B2", shelf_photo: ["p3"] },
      },
    };
    const result = byId(
      evaluateGridEvidence({
        policy: { requiredProof: ["shelf_photo", "before_after"] },
        requireRca: false,
        dataset,
        columns: { shelfColumnId: "c2", barcodeColumnId: null },
        rows,
        responses,
      }),
    );
    expect(result.get("shelf_photo")).toMatchObject({ ok: true, done: 2, total: 2 });
    expect(result.get("before_after")).toMatchObject({ ok: false, done: 1, total: 2, missing: ["B2"] });
  });

  it("needs a barcode scan on every product row, with or without a barcode column", () => {
    const scanned = rows.map((r) => (r.index === 0 ? { ...r, values: { barcode_scan: "8901" } } : r));
    for (const barcodeColumnId of ["c3", null]) {
      const result = byId(
        evaluateGridEvidence({
          policy: { requiredProof: ["barcode"] },
          requireRca: false,
          dataset: barcodeColumnId ? dataset : null,
          columns: { shelfColumnId: null, barcodeColumnId },
          rows: scanned,
          responses: {},
        }),
      );
      expect(result.get("barcode")).toMatchObject({ ok: false, done: 1, total: 3, missing: ["Row 2", "Row 3"] });
    }
    expect(barcodeMatches("8901 ", "8901")).toBe(true);
  });

  it("applies Minimum Evidences to every photo requirement", () => {
    const responses = {
      [AUDIT_EVIDENCE_SECTION]: { 0: { context_photo: ["p1"], quarantine_contents: ["q1", "q2"], sealed_container: ["s1"] } },
      [SHELF_EVIDENCE_SECTION]: { 0: { shelf: "", shelf_photo: ["a", "b"], after_photo: ["c"] } },
    };
    const result = byId(
      evaluateGridEvidence({
        policy: {
          requiredProof: ["context_photo", "shelf_photo", "before_after", "quarantine_contents", "sealed_container"],
          minimumPhotos: 2,
        },
        requireRca: false,
        dataset: null,
        columns: { shelfColumnId: null, barcodeColumnId: null },
        rows: [],
        responses,
      }),
    );
    expect(result.get("context_photo")?.ok).toBe(false);
    expect(result.get("context_photo")?.hint).toContain("2 photos");
    expect(result.get("quarantine_contents")?.ok).toBe(true);
    expect(result.get("sealed_container")?.ok).toBe(false);
    expect(result.get("shelf_photo")?.ok).toBe(true);
    expect(result.get("before_after")?.ok).toBe(false);
  });

  it("requires audit-wide uploads, GPS and a reason (plus note for Other) on differences", () => {
    const responses = {
      [AUDIT_EVIDENCE_SECTION]: {
        0: { context_photo: ["p"], gps: JSON.stringify({ lat: 1, lng: 2, accuracyM: 5, capturedAt: "x" }) },
      },
    };
    const withReason = rows.map((r) => (r.hasMismatch ? { ...r, values: { variance_reason: "other" } } : r));
    const result = byId(
      evaluateGridEvidence({
        policy: { requiredProof: ["context_photo", "gps", "live_session_video", "device_metadata"] },
        requireRca: true,
        dataset,
        columns: { shelfColumnId: null, barcodeColumnId: null },
        rows: withReason,
        responses,
      }),
    );
    expect(result.get("context_photo")?.ok).toBe(true);
    expect(result.get("gps")?.ok).toBe(true);
    expect(result.get("live_session_video")?.ok).toBe(false);
    expect(result.get("device_metadata")?.ok).toBe(true);
    expect(result.get("variance_explanation")).toMatchObject({ ok: false, missing: ["Row 3"] });
  });
});
