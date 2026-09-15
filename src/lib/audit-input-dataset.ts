import type { DraftRow } from "@/lib/planogram";

export type AuditDataType = "text" | "integer" | "number" | "boolean" | "date" | "datetime";

export type AuditDataColumn = {
  id: string;
  name: string;
  type: AuditDataType;
};

export type AuditDataRow = {
  id: string;
  values: Record<string, string>;
};

export type AuditInputDataset = {
  source: "csv" | "manual";
  filename: string | null;
  columns: AuditDataColumn[];
  rows: AuditDataRow[];
};

export const AUDIT_DATA_TYPES: Array<{ value: AuditDataType; label: string }> = [
  { value: "text", label: "Text / String" },
  { value: "integer", label: "Integer" },
  { value: "number", label: "Number / Decimal" },
  { value: "boolean", label: "Boolean" },
  { value: "date", label: "Date" },
  { value: "datetime", label: "Date & time" },
];

export function createAuditColumn(index: number): AuditDataColumn {
  return {
    id: crypto.randomUUID(),
    name: `Column ${index}`,
    type: "text",
  };
}

export function createAuditRow(columns: AuditDataColumn[]): AuditDataRow {
  return {
    id: crypto.randomUUID(),
    values: Object.fromEntries(columns.map((column) => [column.id, ""])),
  };
}

export function createManualAuditDataset(): AuditInputDataset {
  const columns = [createAuditColumn(1)];
  return {
    source: "manual",
    filename: null,
    columns,
    rows: [createAuditRow(columns)],
  };
}

function parseCsvMatrix(text: string): string[][] {
  const matrix: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]!;
    const next = text[index + 1];

    if (character === '"') {
      if (quoted && next === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (character === "," && !quoted) {
      row.push(value.trim());
      value = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(value.trim());
      if (row.some((cell) => cell.length > 0)) matrix.push(row);
      row = [];
      value = "";
      continue;
    }

    value += character;
  }

  row.push(value.trim());
  if (row.some((cell) => cell.length > 0)) matrix.push(row);
  return matrix;
}

function inferType(values: string[]): AuditDataType {
  const populated = values.map((value) => value.trim()).filter(Boolean);
  if (!populated.length) return "text";
  if (populated.every((value) => /^(true|false|yes|no)$/i.test(value))) return "boolean";
  if (populated.every((value) => /^-?\d+$/.test(value))) return "integer";
  if (populated.every((value) => /^-?(?:\d+\.?\d*|\.\d+)$/.test(value))) return "number";
  if (populated.every((value) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value))) {
    return "datetime";
  }
  if (
    populated.every((value) => /^(?:\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})$/.test(value))
  ) {
    return "date";
  }
  return "text";
}

function uniqueHeaderNames(headers: string[]): string[] {
  const used = new Map<string, number>();
  return headers.map((header, index) => {
    const base = header.trim() || `Column ${index + 1}`;
    const normalized = base.toLowerCase();
    const count = used.get(normalized) ?? 0;
    used.set(normalized, count + 1);
    return count === 0 ? base : `${base} (${count + 1})`;
  });
}

export function parseAuditCsv(text: string, filename: string): AuditInputDataset {
  const matrix = parseCsvMatrix(text);
  if (matrix.length < 2)
    throw new Error("CSV must contain a heading row and at least one data row.");

  const headers = uniqueHeaderNames(matrix[0] ?? []);
  const body = matrix.slice(1);
  const columns: AuditDataColumn[] = headers.map((name, columnIndex) => ({
    id: crypto.randomUUID(),
    name,
    type: inferType(body.map((row) => row[columnIndex] ?? "")),
  }));

  const rows: AuditDataRow[] = body.map((cells) => ({
    id: crypto.randomUUID(),
    values: Object.fromEntries(
      columns.map((column, columnIndex) => [column.id, cells[columnIndex] ?? ""]),
    ),
  }));

  return { source: "csv", filename, columns, rows };
}

export function validateAuditDataset(
  dataset: AuditInputDataset,
  options: { manualColumnLimit?: number } = {},
): string | null {
  if (!dataset.columns.length) return "Add at least one column.";
  if (dataset.source === "manual" && dataset.columns.length > (options.manualColumnLimit ?? 10)) {
    return `Manual entry supports up to ${options.manualColumnLimit ?? 10} columns.`;
  }
  const names = dataset.columns.map((column) => column.name.trim().toLowerCase());
  if (names.some((name) => !name)) return "Every column needs a name.";
  if (new Set(names).size !== names.length) return "Column names must be unique.";
  if (!dataset.rows.length) return "Add at least one data row.";

  for (const row of dataset.rows) {
    for (const column of dataset.columns) {
      const value = row.values[column.id]?.trim() ?? "";
      if (!value) continue;
      if (column.type === "integer" && !/^-?\d+$/.test(value)) {
        return `${column.name} must contain whole numbers.`;
      }
      if (column.type === "number" && !Number.isFinite(Number(value))) {
        return `${column.name} must contain numbers.`;
      }
      if (column.type === "boolean" && !/^(true|false|yes|no|1|0)$/i.test(value)) {
        return `${column.name} must contain true/false, yes/no or 1/0.`;
      }
    }
  }
  return null;
}

function normalizeHeading(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_");
}

function findColumn(columns: AuditDataColumn[], aliases: string[]): AuditDataColumn | undefined {
  return columns.find((column) => aliases.includes(normalizeHeading(column.name)));
}

export function datasetToDraftRows(
  dataset: AuditInputDataset,
  context: { location: string; category: string },
): DraftRow[] {
  const productColumn = findColumn(dataset.columns, [
    "product",
    "product_name",
    "item",
    "item_name",
    "description",
  ]);
  const skuColumn = findColumn(dataset.columns, ["sku", "sku_id", "item_code", "barcode"]);
  const quantityColumn = findColumn(dataset.columns, [
    "expected",
    "expected_qty",
    "expected_quantity",
    "quantity",
    "qty",
  ]);
  const locationColumn = findColumn(dataset.columns, ["location", "shelf", "bin"]);
  const categoryColumn = findColumn(dataset.columns, ["category"]);
  const firstTextColumn =
    dataset.columns.find((column) => column.type === "text") ?? dataset.columns[0];

  return dataset.rows.map((row, index) => {
    const value = (column?: AuditDataColumn) =>
      column ? (row.values[column.id] ?? "").trim() : "";
    const quantity = Number(value(quantityColumn));
    return {
      key: row.id,
      location: value(locationColumn) || context.location,
      category: value(categoryColumn) || context.category,
      sub_category: "",
      brand: "",
      product_name: value(productColumn) || value(firstTextColumn) || `Row ${index + 1}`,
      variant: "",
      expected_qty: Number.isFinite(quantity) ? quantity : 0,
      sku: value(skuColumn) || `ROW-${index + 1}`,
      shelf_position: "",
      match_key: "",
    };
  });
}
