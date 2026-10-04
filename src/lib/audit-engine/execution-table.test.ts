import { describe, expect, it } from "vitest";

import type { AuditInputDataset } from "@/lib/audit-input-dataset";
import type { TemplateDefinition, TemplateField } from "@/lib/audit-builder/types";
import {
  buildDigitalInputSchema,
  buildDigitalTemplateDefinition,
  syncDigitalMappings,
} from "@/lib/new-audit/digital-columns";
import {
  activeEvidenceFlags,
  auditDisplayId,
  buildExecutionColumns,
  buildFillCsv,
  encodeEvidenceFlag,
  evidenceCheck,
  parseDateCell,
  resolveRowEvidence,
  timeLeft,
  validateFilledUpload,
  verifyPair,
  withNumericPairs,
  type ExecutionRecord,
} from "./execution-table";

const dataset: AuditInputDataset = {
  source: "csv",
  filename: "stock.csv",
  columns: [
    { id: "p", name: "Product", type: "text" },
    { id: "q", name: "Qty", type: "integer" },
    { id: "a", name: "Actual Qty", type: "integer" },
    { id: "r", name: "Remarks", type: "text" },
  ],
  rows: [
    { id: "1", values: { p: "Butter", q: "24", a: "", r: "" } },
    { id: "2", values: { p: "Salt", q: "40", a: "", r: "" } },
  ],
};

function digitalSetup(rowEvidence: "required" | "on_mismatch" | "optional" | "off" = "optional") {
  const mappings = syncDigitalMappings(dataset).map((m) =>
    m.columnId === "a" ? { ...m, compareWithColumnId: "q" } : m.columnId === "r" ? { ...m, required: false } : m,
  );
  const inputSchema = buildDigitalInputSchema(dataset, mappings);
  const definition = buildDigitalTemplateDefinition(inputSchema, dataset, {
    name: "Stock",
    operatingModel: undefined,
    rowEvidence,
  });
  return { inputSchema, definition, columns: buildExecutionColumns(definition, inputSchema) };
}

const records: ExecutionRecord[] = [
  { index: 0, values: { item_name: "Butter", qty: "24" } },
  { index: 1, values: { item_name: "Salt", qty: "40" } },
];

function upload(headers: string[], rows: string[][]): AuditInputDataset {
  const columns = headers.map((name, i) => ({ id: `c${i}`, name, type: "text" as const }));
  return {
    source: "csv",
    filename: "filled.csv",
    columns,
    rows: rows.map((cells, r) => ({
      id: `r${r}`,
      values: Object.fromEntries(columns.map((c, i) => [c.id, cells[i] ?? ""])),
    })),
  };
}

describe("buildExecutionColumns", () => {
  it("marks provided, fill and evidence columns and the verification pair", () => {
    const { columns } = digitalSetup();
    expect(columns.map((c) => [c.key, c.role, c.kind])).toEqual([
      ["item_name", "provided", "text"],
      ["qty", "provided", "text"],
      ["actual_qty", "fill", "number"],
      ["remarks", "fill", "text"],
      ["evidence_photo", "evidence", "image"],
    ]);
    expect(columns.find((c) => c.key === "actual_qty")?.compareWithKey).toBe("qty");
  });

  it("adds no photo column when row evidence is off", () => {
    const { columns } = digitalSetup("off");
    expect(columns.some((c) => c.kind === "image")).toBe(false);
  });
});

describe("verifyPair", () => {
  it("returns a numeric difference and status", () => {
    expect(verifyPair("40", 36)).toEqual({ difference: -4, status: "mismatch" });
    expect(verifyPair("24", "24")).toEqual({ difference: 0, status: "match" });
    expect(verifyPair("24", "")).toEqual({ difference: null, status: "not_filled" });
  });

  it("compares text case-insensitively", () => {
    expect(verifyPair("Pass", "pass")).toEqual({ difference: null, status: "match" });
    expect(verifyPair("Pass", "Fail")).toEqual({ difference: null, status: "mismatch" });
  });
});

describe("buildFillCsv", () => {
  it("adds Row # and leaves photo columns out", () => {
    const { columns } = digitalSetup();
    const csv = buildFillCsv(columns, records);
    expect(csv.headers).toEqual(["Row #", "Product", "Qty", "Actual Qty", "Remarks"]);
    expect(csv.rows[1]).toEqual(["2", "Salt", "40", "", ""]);
  });
});

describe("validateFilledUpload", () => {
  it("imports valid cells, flags bad numbers and ignores provided edits", () => {
    const { columns } = digitalSetup();
    const file = upload(
      ["Row #", "Product", "Qty", "Actual Qty", "Remarks"],
      [
        ["2", "Salt", "45", "36", "Torn packs"],
        ["1", "Butter", "24", "twelve", ""],
      ],
    );
    const result = validateFilledUpload(file, columns, records, { hasProvidedData: true });
    expect(result.matchedBy).toBe("row_number");
    expect(result.updates).toEqual([
      { recordIndex: 1, fieldKey: "actual_qty", value: 36 },
      { recordIndex: 1, fieldKey: "remarks", value: "Torn packs" },
    ]);
    expect(result.issues).toEqual([
      { row: 1, column: "Actual Qty", value: "twelve", reason: '"twelve" is not a number' },
    ]);
    expect(result.ignoredProvidedEdits).toEqual([{ row: 2, column: "Qty" }]);
  });

  it("falls back to row order and strips spreadsheet apostrophes", () => {
    const { columns } = digitalSetup();
    const file = upload(["Product", "actual qty"], [["Butter", "'-3"], ["Salt", "40"]]);
    const result = validateFilledUpload(file, columns, records, { hasProvidedData: true });
    expect(result.matchedBy).toBe("order");
    expect(result.updates.map((u) => [u.recordIndex, u.value])).toEqual([
      [0, -3],
      [1, 40],
    ]);
    expect(result.missingColumns).toEqual(["Remarks"]);
  });

  it("ignores extra rows when the audit has provided data, adds them otherwise", () => {
    const { columns } = digitalSetup();
    const file = upload(["Row #", "Actual Qty"], [["3", "5"]]);
    expect(validateFilledUpload(file, columns, records, { hasProvidedData: true }).ignoredExtraRows).toEqual([3]);
    const added = validateFilledUpload(file, columns, records, { hasProvidedData: false });
    expect(added.newRecordIndexes).toEqual([2]);
    expect(added.updates).toEqual([{ recordIndex: 2, fieldKey: "actual_qty", value: 5 }]);
  });

  it("treats a text column paired with numbers as a number and ignores spacing in provided text", () => {
    const { columns } = digitalSetup();
    const textual = columns.map((c) => (c.key === "actual_qty" ? { ...c, kind: "text" as const } : c));
    const spaced: ExecutionRecord[] = [{ index: 0, values: { item_name: "Amul  Butter   500g", qty: "24" } }];
    const typed = withNumericPairs(textual, spaced);
    expect(typed.find((c) => c.key === "actual_qty")?.kind).toBe("number");
    const file = upload(["Row #", "Product", "Actual Qty"], [["1", "Amul Butter 500g", "abc"]]);
    const result = validateFilledUpload(file, typed, spaced, { hasProvidedData: true });
    expect(result.ignoredProvidedEdits).toEqual([]);
    expect(result.issues[0]?.reason).toBe('"abc" is not a number');
  });

  it("checks dropdown, reason and date values", () => {
    const fields: TemplateField[] = [
      { id: "1", key: "qc", type: "qc_status", label: "QC", section: "records", order: 0, required: false, config: {}, fieldRole: "auditor_input" },
      { id: "2", key: "rca", type: "rca", label: "Reason", section: "records", order: 1, required: false, config: {}, fieldRole: "auditor_input" },
      { id: "3", key: "exp", type: "expiry_date", label: "Expiry", section: "records", order: 2, required: false, config: {}, fieldRole: "auditor_input" },
    ];
    const definition = {
      sections: [{ key: "records", title: "Records", order: 0, repeatable: true }],
      fields,
    } as unknown as TemplateDefinition;
    const columns = buildExecutionColumns(definition);
    const file = upload(["QC", "Reason", "Expiry"], [["pass", "Damaged", "31/12/2026"], ["Maybe", "Aliens", "31/02/2026"]]);
    const result = validateFilledUpload(file, columns, [{ index: 0, values: {} }, { index: 1, values: {} }], {
      hasProvidedData: true,
    });
    expect(result.updates).toEqual([
      { recordIndex: 0, fieldKey: "qc", value: "Pass" },
      { recordIndex: 0, fieldKey: "rca", value: "damaged" },
      { recordIndex: 0, fieldKey: "exp", value: "2026-12-31" },
    ]);
    expect(result.issues.map((i) => i.column)).toEqual(["QC", "Reason", "Expiry"]);
  });
});

describe("evidenceCheck", () => {
  const base = { photos: [] as string[], minimumPhotos: 1, flags: [] as string[], hasMismatch: false };

  it("handles every mode", () => {
    expect(evidenceCheck({ ...base, mode: "off" }).status).toBe("not_required");
    expect(evidenceCheck({ ...base, mode: "required" }).status).toBe("missing");
    expect(evidenceCheck({ ...base, mode: "optional" }).status).toBe("not_required");
    expect(evidenceCheck({ ...base, mode: "on_mismatch" }).status).toBe("not_required");
    expect(evidenceCheck({ ...base, mode: "on_mismatch", hasMismatch: true }).status).toBe("missing");
  });

  it("verifies clean photos and flags problems", () => {
    expect(evidenceCheck({ ...base, mode: "required", photos: ["a"] })).toEqual({ status: "verified", reasons: [] });
    expect(evidenceCheck({ ...base, mode: "required", photos: ["a"], flags: ["Photo too dark"] }).status).toBe(
      "needs_review",
    );
  });

  it("treats fewer photos than the minimum as missing when a photo is needed", () => {
    expect(evidenceCheck({ ...base, mode: "required", photos: ["a"], minimumPhotos: 2 })).toEqual({
      status: "missing",
      reasons: ["1 of 2 photos"],
    });
    expect(evidenceCheck({ ...base, mode: "on_mismatch", hasMismatch: true, photos: ["a"], minimumPhotos: 3 }).status).toBe(
      "missing",
    );
    expect(evidenceCheck({ ...base, mode: "optional", photos: ["a"], minimumPhotos: 2 })).toEqual({ status: "verified", reasons: [] });
    expect(evidenceCheck({ ...base, mode: "required", photos: ["a", "b"], minimumPhotos: 2 }).status).toBe("verified");
  });

  it("keeps flags only for photos still attached", () => {
    const flags = [encodeEvidenceFlag("ref://a", "Duplicate photo"), encodeEvidenceFlag("ref://b", "Blurry")];
    expect(activeEvidenceFlags(flags, ["ref://a"])).toEqual(["Duplicate photo"]);
  });
});

describe("resolveRowEvidence", () => {
  it("uses the manager setting, then the evidence policy", () => {
    const { definition } = digitalSetup("optional");
    expect(resolveRowEvidence({ definition, purposeConfig: { rowEvidence: "on_mismatch" }, evidencePolicy: null }).mode).toBe(
      "on_mismatch",
    );
    expect(
      resolveRowEvidence({ definition, purposeConfig: {}, evidencePolicy: { requiredProof: ["per_sku_photo"] } }).mode,
    ).toBe("required");
    expect(resolveRowEvidence({ definition: digitalSetup("off").definition, purposeConfig: {}, evidencePolicy: null }).mode).toBe(
      "off",
    );
  });
});

describe("header helpers", () => {
  it("formats the audit id and time left", () => {
    expect(auditDisplayId("967e3ebf-a75a-46c7-bc9b-1374952278c7")).toBe("AUD-967E3EBF");
    const now = Date.UTC(2026, 9, 3, 12, 0);
    expect(timeLeft(new Date(now + (2 * 24 + 3) * 3_600_000).toISOString(), now)).toEqual({
      label: "2d 3h left",
      overdue: false,
    });
    expect(timeLeft(new Date(now - 5 * 3_600_000).toISOString(), now)).toEqual({ label: "Overdue by 5h 0m", overdue: true });
    expect(timeLeft(null, now)).toBeNull();
  });

  it("parses ISO and day-first dates", () => {
    expect(parseDateCell("2026-10-05")).toBe("2026-10-05");
    expect(parseDateCell("5/10/26")).toBe("2026-10-05");
    expect(parseDateCell("31/02/2026")).toBeNull();
  });
});
