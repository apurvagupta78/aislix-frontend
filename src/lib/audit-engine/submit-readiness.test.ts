import { describe, expect, it } from "vitest";

import type { CompletionResult, TemplateDefinition } from "@/lib/audit-builder/types";
import type { GridRequirement } from "./grid-evidence";
import {
  AuditSubmitError,
  computeSubmitReadiness,
  describeMissingCells,
  describeServerIssues,
  formatRows,
  friendlyLabel,
  remainingSummary,
  type ReadinessRow,
} from "./submit-readiness";

const definition = {
  sections: [
    { key: "details", title: "Details", order: 0, repeatable: false },
    { key: "records", title: "Records", order: 1, repeatable: true },
  ],
  fields: [
    { key: "store_manager", label: "Store manager", section: "details" },
    { key: "actual_amount", label: "ACTUAL AMOUNT", section: "records" },
    { key: "photo", label: "Photo", section: "records" },
  ],
} as unknown as TemplateDefinition;

function row(index: number, patch: Partial<ReadinessRow> = {}): ReadinessRow {
  return {
    index,
    position: index,
    photoNeeded: false,
    photoMissing: false,
    photoNeedsReview: false,
    reasonNeeded: false,
    reasonMissing: false,
    barcodeNeeded: false,
    barcodeMissing: false,
    ...patch,
  };
}

const missingAmount = (recordIndex: number) => ({
  sectionKey: "records",
  recordIndex,
  fieldKey: "actual_amount",
  label: `ACTUAL AMOUNT — record ${recordIndex + 1}`,
});

describe("formatRows / friendlyLabel", () => {
  it("compresses consecutive rows into ranges", () => {
    expect(formatRows([22, 23, 24, 25, 26])).toBe("rows 22–26");
    expect(formatRows([4])).toBe("row 4");
    expect(formatRows([3, 5, 6, 9, 10, 11])).toBe("rows 3, 5, 6, 9–11");
  });

  it("truncates long lists with a remaining count", () => {
    expect(formatRows([1, 3, 5, 7, 9, 11, 13, 15], 3)).toBe("rows 1, 3, 5 and 5 more");
  });

  it("turns spreadsheet headers into readable labels", () => {
    expect(friendlyLabel("ACTUAL AMOUNT")).toBe("Actual amount");
    expect(friendlyLabel("Shelf ID")).toBe("Shelf ID");
    expect(friendlyLabel("SKU")).toBe("SKU");
    expect(friendlyLabel("SKU CODE")).toBe("SKU code");
    expect(friendlyLabel("actual_amount")).toBe("actual amount");
  });
});

describe("computeSubmitReadiness", () => {
  it("blocks submit and explains empty required cells in plain English", () => {
    const rows = Array.from({ length: 26 }, (_, i) => row(i));
    const completion: CompletionResult = {
      percent: 81,
      complete: false,
      missing: [21, 22, 23, 24, 25].map(missingAmount),
      totalRequired: 26,
      filledRequired: 21,
    };
    const r = computeSubmitReadiness({ definition, sectionKey: "records", completion, rows, requirements: [], photoRule: "none" });
    expect(r.ready).toBe(false);
    expect(r.percent).toBe(80);
    expect(r.rowsComplete).toBe(21);
    expect(r.rowsTotal).toBe(26);
    expect(r.blockers).toHaveLength(1);
    expect(r.blockers[0]!.title).toBe("Enter “Actual amount”");
    expect(r.blockers[0]!.detail).toBe("5 rows are still empty: rows 22–26.");
    expect(r.blockers[0]!.rowIndexes).toEqual([21, 22, 23, 24, 25]);
    expect(remainingSummary(r.remaining)).toBe("5 cells left");
  });

  it("counts photos, reasons and audit evidence — not just cells", () => {
    const rows = [
      row(0),
      row(1, { photoNeeded: true, photoMissing: true, reasonNeeded: true, reasonMissing: true }),
      row(2, { photoNeeded: true, reasonNeeded: true }),
    ];
    const completion: CompletionResult = { percent: 100, complete: true, missing: [], totalRequired: 3, filledRequired: 3 };
    const requirements: GridRequirement[] = [
      { id: "context_photo", label: "Contextual shelf photo", hint: "One photo showing the whole area you audited.", done: 0, total: 1, ok: false, missing: ["Contextual shelf photo"] },
      { id: "variance_photo", label: "Photo for differences", hint: "", done: 1, total: 2, ok: false, missing: ["Row 2"] },
      { id: "device_metadata", label: "Device metadata", hint: "", done: 1, total: 1, ok: true, missing: [] },
    ];
    const r = computeSubmitReadiness({ definition, sectionKey: "records", completion, rows, requirements, photoRule: "on_difference" });
    // 3 cells + 2 photo rows + 2 reason rows + 1 context photo = 8; done = 3 + 1 + 1 + 0
    expect(r.total).toBe(8);
    expect(r.done).toBe(5);
    expect(r.percent).toBe(62);
    expect(r.rowsComplete).toBe(2);
    expect(r.blockers.map((b) => b.kind)).toEqual(["photos", "explanations", "evidence"]);
    expect(r.blockers[0]!.detail).toContain("Missing on row 2.");
    expect(r.blockers[2]!.title).toBe("Add the contextual shelf photo");
    expect(remainingSummary(r.remaining)).toBe("1 photo, 1 reason and 1 evidence item left");
  });

  it("never shows 100% while something still blocks submit", () => {
    const rows = Array.from({ length: 300 }, (_, i) => row(i, i === 0 ? { reasonNeeded: true, reasonMissing: true } : {}));
    const completion: CompletionResult = { percent: 100, complete: true, missing: [], totalRequired: 300, filledRequired: 300 };
    const r = computeSubmitReadiness({ definition, sectionKey: "records", completion, rows, requirements: [], photoRule: "none" });
    expect(r.percent).toBe(99);
    expect(r.ready).toBe(false);
  });

  it("does not double count a required photo field as a cell and a photo", () => {
    const rows = [row(0, { photoNeeded: true, photoMissing: true }), row(1, { photoNeeded: true })];
    const completion: CompletionResult = {
      percent: 75,
      complete: false,
      missing: [{ sectionKey: "records", recordIndex: 0, fieldKey: "photo", label: "Photo — record 1" }],
      totalRequired: 4,
      filledRequired: 3,
    };
    const r = computeSubmitReadiness({
      definition,
      sectionKey: "records",
      completion,
      rows,
      requirements: [],
      photoRule: "every_row",
      requiredPhotoFieldKey: "photo",
    });
    expect(r.total).toBe(4);
    expect(r.done).toBe(3);
    expect(r.blockers.map((b) => b.kind)).toEqual(["photos"]);
    expect(r.remaining.cells).toBe(0);
  });

  it("is ready at 100% when everything required is done; review flags are only a notice", () => {
    const rows = [row(0, { photoNeeded: true, photoNeedsReview: true })];
    const completion: CompletionResult = { percent: 100, complete: true, missing: [], totalRequired: 1, filledRequired: 1 };
    const r = computeSubmitReadiness({ definition, sectionKey: "records", completion, rows, requirements: [], photoRule: "every_row" });
    expect(r.ready).toBe(true);
    expect(r.percent).toBe(100);
    expect(r.reviewRowPositions).toEqual([1]);
    expect(remainingSummary(r.remaining)).toBeNull();
  });

  it("merges fields missing on the same rows and uses the table's column headers", () => {
    const completion: CompletionResult = {
      percent: 0,
      complete: false,
      missing: [
        missingAmount(0),
        { sectionKey: "records", recordIndex: 0, fieldKey: "photo", label: "Photo" },
      ],
      totalRequired: 2,
      filledRequired: 0,
    };
    const r = computeSubmitReadiness({
      definition,
      sectionKey: "records",
      completion,
      rows: [row(0)],
      requirements: [],
      photoRule: "none",
      columnLabels: new Map([["actual_amount", "Actual Qty"]]),
    });
    expect(r.blockers).toHaveLength(1);
    expect(r.blockers[0]).toMatchObject({ title: "Fill in “Actual Qty” and “Photo”", detail: "Row 1 is still empty." });
  });

  it("lists header fields separately from row cells", () => {
    const completion: CompletionResult = {
      percent: 50,
      complete: false,
      missing: [{ sectionKey: "details", recordIndex: 0, fieldKey: "store_manager", label: "Store manager" }],
      totalRequired: 2,
      filledRequired: 1,
    };
    const r = computeSubmitReadiness({ definition, sectionKey: "records", completion, rows: [row(0)], requirements: [], photoRule: "none" });
    expect(r.blockers[0]).toMatchObject({ kind: "header", title: "Fill in “Store manager”" });
    expect(r.rowsComplete).toBe(1);
  });
});

describe("server-side messages", () => {
  it("describes missing cells with the row numbers the auditor sees", () => {
    const records = [
      { sectionKey: "details", recordIndex: 0 },
      ...[0, 1, 2, 5, 9].map((recordIndex) => ({ sectionKey: "records", recordIndex })),
    ];
    expect(describeMissingCells(definition, [missingAmount(5), missingAmount(9)], records)).toEqual([
      "“Actual amount” is empty on rows 4, 5.",
    ]);
  });

  it("turns completion RPC issues into plain sentences", () => {
    expect(
      describeServerIssues({
        missingRcaCount: 2,
        missingEvidenceCount: 1,
        missingExpiryCoverageRecords: 0,
        issues: [
          { type: "variance_explanation", label: "Explanation for every difference", count: 2 },
          { type: "context_photo", label: "Contextual shelf photo", count: 1 },
        ],
      }),
    ).toEqual(["2 rows with a difference still need a reason.", "Contextual shelf photo is still missing."]);
  });

  it("keeps the title and items on AuditSubmitError", () => {
    const err = new AuditSubmitError("This audit isn't finished yet.", ["“Actual amount” is empty on rows 22–26."]);
    expect(err).toBeInstanceOf(Error);
    expect(err.title).toBe("This audit isn't finished yet.");
    expect(err.items).toHaveLength(1);
  });
});
