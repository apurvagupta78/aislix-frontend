import { describe, expect, it } from "vitest";

import type { AuditInputDataset } from "@/lib/audit-input-dataset";
import {
  buildDigitalColumnsAudit,
  buildDigitalInputSchema,
  DIGITAL_CSV_TEMPLATE_SOURCE,
  numericCell,
  syncDigitalMappings,
} from "./digital-columns";

const dataset: AuditInputDataset = {
  source: "csv",
  filename: "activity.csv",
  columns: [
    { id: "d", name: "Description", type: "text" },
    { id: "a", name: "Amount", type: "number" },
    { id: "x", name: "Actual Amount", type: "text" },
    { id: "r", name: "Remarks", type: "text" },
  ],
  rows: [
    { id: "1", values: { d: "OPENAI", a: "1180.87", x: "", r: "" } },
    { id: "2", values: { d: "CURSOR", a: "573.43", x: "", r: "" } },
  ],
};

describe("syncDigitalMappings", () => {
  it("suggests provided for filled columns and auditee for empty / actual columns", () => {
    const roles = syncDigitalMappings(dataset).map((m) => [m.columnName, m.fieldRole]);
    expect(roles).toEqual([
      ["Description", "reference"],
      ["Amount", "reference"],
      ["Actual Amount", "auditor_input"],
      ["Remarks", "auditor_input"],
    ]);
  });

  it("keeps manager choices and drops pairings to non-provided columns", () => {
    const first = syncDigitalMappings(dataset).map((m) =>
      m.columnId === "x" ? { ...m, compareWithColumnId: "a" } : m.columnId === "r" ? { ...m, compareWithColumnId: "x" } : m,
    );
    const next = syncDigitalMappings(dataset, first);
    expect(next.find((m) => m.columnId === "x")?.compareWithColumnId).toBe("a");
    expect(next.find((m) => m.columnId === "r")?.compareWithColumnId).toBeUndefined();
    expect(next.find((m) => m.columnId === "x")?.required).toBe(true);
    expect(next.find((m) => m.columnId === "a")?.required).toBe(false);
  });
});

describe("buildDigitalInputSchema", () => {
  it("gives every column a unique field key", () => {
    const dup: AuditInputDataset = {
      ...dataset,
      columns: [
        { id: "p", name: "Product", type: "text" },
        { id: "q", name: "Unit Price", type: "text" },
        { id: "s", name: "Unit-Price", type: "text" },
      ],
      rows: [{ id: "1", values: { p: "Soap", q: "1", s: "2" } }],
    };
    const schema = buildDigitalInputSchema(dup, syncDigitalMappings(dup));
    expect(schema.templateFieldBindings?.map((b) => b.templateFieldKey)).toEqual([
      "item_name",
      "unit_price",
      "unit_price_2",
    ]);
  });
});

describe("buildDigitalColumnsAudit", () => {
  it("joins provided file values with saved auditee values", () => {
    const mappings = syncDigitalMappings(dataset).map((m) =>
      m.columnId === "x" ? { ...m, compareWithColumnId: "a" } : m,
    );
    const inputSchema = buildDigitalInputSchema(dataset, mappings);
    const snapshot = {
      purpose_config: { source: DIGITAL_CSV_TEMPLATE_SOURCE, inputSchema, input_dataset: dataset },
    };
    const audit = buildDigitalColumnsAudit(snapshot, [
      { section_key: "records", record_index: 0, field_key: "actual_amount", value: "1180.87" },
      { section_key: "records", record_index: 1, field_key: "remarks", value: "Partial refund" },
    ]);
    expect(audit?.columns.find((c) => c.key === "actual_amount")?.compareWithKey).toBe("amount");
    expect(audit?.rows[0]?.values).toMatchObject({ item_name: "OPENAI", actual_amount: "1180.87", remarks: null });
    expect(audit?.rows[1]?.values).toMatchObject({ actual_amount: null, remarks: "Partial refund" });
  });

  it("lists the rows the auditee added when the manager gave none", () => {
    const empty: AuditInputDataset = { ...dataset, source: "manual", filename: null, rows: [] };
    const mappings = syncDigitalMappings(empty).map((m) =>
      m.columnId === "d" ? { ...m, fieldRole: "reference" as const } : m,
    );
    const inputSchema = buildDigitalInputSchema(empty, mappings);
    const snapshot = {
      purpose_config: { source: DIGITAL_CSV_TEMPLATE_SOURCE, inputSchema, input_dataset: empty },
    };
    const audit = buildDigitalColumnsAudit(snapshot, [
      { section_key: "records", record_index: 0, field_key: "item_name", value: "Soap" },
      { section_key: "records", record_index: 0, field_key: "actual_amount", value: "12" },
      { section_key: "records", record_index: 1, field_key: "item_name", value: "Salt" },
      { section_key: "audit_evidence", record_index: 0, field_key: "context_photo", value: ["a.jpg"] },
    ]);
    expect(audit?.rows.map((r) => r.index)).toEqual([0, 1]);
    expect(audit?.rows[0]?.values).toMatchObject({ item_name: "Soap", actual_amount: "12" });
    expect(audit?.rows[1]?.values).toMatchObject({ item_name: "Salt", actual_amount: null });
  });

  it("returns null for scans that are not Digital Audit uploads", () => {
    expect(buildDigitalColumnsAudit({ purpose_config: {} }, [])).toBeNull();
    expect(buildDigitalColumnsAudit(null, [])).toBeNull();
  });
});

describe("numericCell", () => {
  it("reads currency and negatives, rejects text", () => {
    expect(numericCell("₹1,180.87")).toBe(1180.87);
    expect(numericCell("-676.75")).toBe(-676.75);
    expect(numericCell("Matches bill")).toBeNull();
    expect(numericCell("")).toBeNull();
  });
});
