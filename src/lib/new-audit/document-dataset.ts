import type { ReferenceDocumentState, ReferenceField } from "@/lib/ai-audit/reference-document";
import type { AuditDataColumn, AuditDataType, AuditInputDataset } from "@/lib/audit-input-dataset";

const STANDARD_COLUMNS: Array<{ field: ReferenceField; name: string; type: AuditDataType }> = [
  { field: "brand", name: "Brand", type: "text" },
  { field: "product", name: "Product", type: "text" },
  { field: "variant", name: "Variant", type: "text" },
  { field: "pack_size", name: "Pack", type: "text" },
  { field: "qty", name: "Qty", type: "number" },
  { field: "unit", name: "Unit", type: "text" },
  { field: "price", name: "Price", type: "number" },
  { field: "location", name: "Location", type: "text" },
];

function text(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

/**
 * Turn lines read from a photo / PDF into an editable dataset. Standard fields that are
 * empty on every line are dropped (Product is always kept); every extra printed column is kept.
 */
export function referenceStateToDataset(state: ReferenceDocumentState): AuditInputDataset {
  const rows = state.rows;
  const used = STANDARD_COLUMNS.filter(
    (c) => c.field === "product" || rows.some((row) => text(row[c.field]) !== ""),
  );
  const taken = new Set(used.map((c) => c.name.toLowerCase()));
  const extras = (state.meta.extra_columns ?? []).filter((name) => {
    const key = name.trim().toLowerCase();
    if (!key || taken.has(key)) return false;
    taken.add(key);
    return true;
  });

  const columns: AuditDataColumn[] = [
    ...used.map((c) => ({ id: crypto.randomUUID(), name: c.name, type: c.type })),
    ...extras.map((name) => ({ id: crypto.randomUUID(), name, type: "text" as const })),
  ];

  return {
    source: "csv",
    filename: state.meta.filename,
    columns,
    rows: rows.map((row) => ({
      id: crypto.randomUUID(),
      values: Object.fromEntries([
        ...used.map((c, i) => [columns[i]!.id, text(row[c.field])]),
        ...extras.map((name, i) => [columns[used.length + i]!.id, text(row.extra?.[name])]),
      ]),
    })),
  };
}
