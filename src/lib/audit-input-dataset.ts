import type { DraftRow } from "@/lib/planogram";
import type { InputSchema } from "@/lib/audit-builder/field-roles";

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
  inputSchema?: InputSchema;
};

/**
 * Stored form of a dataset: each row is a plain array of cell values in column order.
 * Keyed rows repeat every column id on every row, which turns a 5 MB file into ~35 MB of JSON.
 */
export type StoredAuditInputDataset = Omit<AuditInputDataset, "rows"> & {
  rows: AuditDataRow[];
  packed_rows?: string[][];
};

export function packDatasetForStorage(dataset: AuditInputDataset): StoredAuditInputDataset {
  const { rows, ...rest } = dataset;
  return {
    ...rest,
    rows: [],
    packed_rows: rows.map((row) => dataset.columns.map((c) => row.values[c.id] ?? "")),
  };
}

/** Reads a dataset saved in either the packed or the older keyed-rows form. */
export function readStoredDataset(raw: unknown): AuditInputDataset | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const stored = raw as StoredAuditInputDataset;
  if (!Array.isArray(stored.columns)) return undefined;
  if (!Array.isArray(stored.packed_rows)) return { ...stored, rows: stored.rows ?? [] };
  const { packed_rows, ...rest } = stored;
  return {
    ...rest,
    rows: packed_rows.map((cells, index) => ({
      id: `row-${index}`,
      values: Object.fromEntries(stored.columns.map((c, i) => [c.id, cells[i] ?? ""])),
    })),
  };
}

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

/** Re-infer every column's type from its current values (after manual edits). */
export function inferDatasetColumnTypes(dataset: AuditInputDataset): AuditInputDataset {
  return {
    ...dataset,
    columns: dataset.columns.map((column) => ({
      ...column,
      type: inferType(dataset.rows.map((row) => row.values[column.id] ?? "")),
    })),
  };
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

function matrixToDataset(matrix: string[][], filename: string): AuditInputDataset {
  if (matrix.length < 2) {
    throw new Error("Spreadsheet must contain a heading row and at least one data row.");
  }

  const headers = uniqueHeaderNames(
    (matrix[0] ?? []).map((cell) => (cell == null ? "" : String(cell))),
  );
  const body = matrix.slice(1);
  const columns: AuditDataColumn[] = headers.map((name, columnIndex) => ({
    id: crypto.randomUUID(),
    name,
    type: inferType(body.map((row) => String(row[columnIndex] ?? ""))),
  }));

  const rows: AuditDataRow[] = body.map((cells) => ({
    id: crypto.randomUUID(),
    values: Object.fromEntries(
      columns.map((column, columnIndex) => [column.id, String(cells[columnIndex] ?? "").trim()]),
    ),
  }));

  return { source: "csv", filename, columns, rows };
}

export async function parseAuditSpreadsheet(file: File): Promise<AuditInputDataset> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".csv") || file.type === "text/csv") {
    return parseAuditCsv(await file.text(), file.name);
  }

  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    const XLSX = await import("xlsx");
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]!];
    if (!sheet) throw new Error("Workbook has no sheets.");
    const matrix = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
      header: 1,
      defval: "",
      raw: false,
    });
    const normalized = matrix.map((row) =>
      (row ?? []).map((cell) => (cell == null ? "" : String(cell))),
    );
    return matrixToDataset(normalized, file.name);
  }

  throw new Error("Upload a CSV or XLSX file.");
}

export function parseAuditCsv(text: string, filename: string): AuditInputDataset {
  return matrixToDataset(parseCsvMatrix(text), filename);
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

const PRODUCT_ALIASES = [
  "product",
  "product_name",
  "item",
  "item_name",
  "description",
  "item_description",
  "product_description",
  "sku_name",
  "article_name",
];
const SKU_ALIASES = [
  "sku",
  "sku_id",
  "sku_code",
  "item_code",
  "barcode",
  "ean",
  "upc",
  "article",
  "article_code",
];
const EXPECTED_QTY_ALIASES = [
  "expected",
  "expected_qty",
  "expected_quantity",
  "quantity",
  "qty",
  "system_qty",
  "system_quantity",
  "book_qty",
  "on_hand",
  "stock",
];

/**
 * Digital count audits turn each CSV row into an expected product. Reject files that have
 * no product or SKU column (e.g. exported reports) instead of creating nonsense lines.
 */
export function digitalProductListIssue(dataset: AuditInputDataset): string | null {
  if (!dataset.columns.length || !dataset.rows.length) return null;
  const hasProduct = Boolean(findColumn(dataset.columns, PRODUCT_ALIASES));
  const hasSku = Boolean(findColumn(dataset.columns, SKU_ALIASES));
  if (hasProduct || hasSku) return null;
  const found = dataset.columns
    .slice(0, 4)
    .map((c) => c.name)
    .join(", ");
  return `This file has no Product Name or SKU column (found: ${found}). Upload a product list with one row per SKU — download the sample CSV for the format.`;
}

export function datasetToDraftRows(
  dataset: AuditInputDataset,
  context: { location: string; category: string },
): DraftRow[] {
  const productColumn = findColumn(dataset.columns, PRODUCT_ALIASES);
  const skuColumn = findColumn(dataset.columns, SKU_ALIASES);
  const quantityColumn = findColumn(dataset.columns, EXPECTED_QTY_ALIASES);
  const locationColumn = findColumn(dataset.columns, ["location", "shelf", "bin", "aisle", "bin_location"]);
  const categoryColumn = findColumn(dataset.columns, ["category"]);
  const brandColumn = findColumn(dataset.columns, ["brand"]);
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
      brand: value(brandColumn),
      product_name: value(productColumn) || value(firstTextColumn) || `Row ${index + 1}`,
      variant: "",
      expected_qty: Number.isFinite(quantity) ? quantity : 0,
      sku: value(skuColumn) || `ROW-${index + 1}`,
      shelf_position: "",
      match_key: "",
    };
  });
}
