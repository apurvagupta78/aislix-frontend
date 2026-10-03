/**
 * Turns the backend's per-page document tables into reference rows, checks them with
 * arithmetic (qty × rate = amount, line amounts vs printed total) and decides which pages
 * Luna should re-read.
 */

import {
  emptyReferenceMeta,
  LOW_CONFIDENCE,
  mapReferenceColumns,
  NON_ITEM_LINE,
  referenceRowsFromTable,
  type ReferenceDocumentState,
  type ReferenceField,
  type ReferenceRow,
} from "@/lib/ai-audit/reference-document";

export type PipelineTable = { headers: string[]; rows: string[][]; confidence: Array<number | null> | null };

export type PipelinePage = {
  page: number;
  source: "text" | "azure" | "mistral" | "none";
  tables: PipelineTable[];
  text_chars: number;
};

export type PipelineResult = {
  provider: "azure" | "mistral" | "none";
  pages_total: number;
  scanned_pages: number;
  document: {
    supplier_name?: string;
    buyer_or_store_name?: string;
    document_number?: string;
    document_date?: string;
    currency?: string;
    total_amount?: number;
    subtotal?: number;
    document_type?: string;
  };
  pages: PipelinePage[];
};

export type DocumentJobStatus = {
  job_id: string;
  status: "processing" | "completed" | "failed";
  stage: "download" | "text" | "ocr" | "done";
  pages_total: number | null;
  pages_done: number;
  ocr_pages: number;
  result?: PipelineResult;
  error?: string;
};

export type ColumnHint = Partial<Record<ReferenceField, string>>;

export type PageFlag = "unread" | "no_columns" | "math" | "low_confidence";

export type PageReading = {
  page: number;
  rows: ReferenceRow[];
  flag: PageFlag | null;
  mathFailures: number;
  printedTotals: number[];
};

const CANONICAL_HEADER: Record<ReferenceField, string> = {
  product: "Product",
  brand: "Brand",
  variant: "Variant",
  pack_size: "Pack size",
  qty: "Qty",
  unit: "Unit",
  price: "Price",
  location: "Location",
};
const AMOUNT_HEADER = /^(amount|line total|total|value|net amount|net value|taxable value|taxable amount|total amount)$/;
const RATE_HEADER = /^(rate|unit price|net rate|price|unit rate|selling price|sp|cost|unit cost)$/;
const TOTAL_LINE = /^\s*(sub\s*-?\s*total|grand\s*total|total|net\s*amount|net\s*total|invoice\s*total)\b/i;

function norm(value: string): string {
  return value
    .toLowerCase()
    .replace(/[₹$€£]/g, " ")
    .replace(/\b(rs|inr|usd)\b\.?/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function amountOf(value: string | undefined | null): number | null {
  if (!value) return null;
  const digits = String(value).replace(/[^\d.]/g, "");
  if (!digits || digits === ".") return null;
  const parsed = Number(digits);
  return Number.isFinite(parsed) ? parsed : null;
}

export function headerKey(headers: string[]): string {
  return headers.map(norm).join("|");
}

function hasItemColumns(headers: string[]): boolean {
  const { columns } = mapReferenceColumns(headers);
  return Boolean((columns.product || columns.brand) && (columns.qty || columns.price));
}

/** Distinct table layouts the header aliases could not map — candidates for one small AI mapping call each. */
export function tablesNeedingColumnHelp(result: PipelineResult, limit = 5): Array<{ headers: string[]; sample: string[][] }> {
  const seen = new Set<string>();
  const out: Array<{ headers: string[]; sample: string[][] }> = [];
  for (const page of result.pages) {
    for (const table of page.tables) {
      const key = headerKey(table.headers);
      if (seen.has(key) || !table.rows.length || hasItemColumns(table.headers)) continue;
      seen.add(key);
      out.push({ headers: table.headers, sample: table.rows.slice(0, 8) });
      if (out.length >= limit) return out;
    }
  }
  return out;
}

/** Rename hinted headers to the canonical names the alias mapper recognises. */
export function applyColumnHint(headers: string[], hint: ColumnHint | undefined): string[] {
  if (!hint) return headers;
  const canonical = new Set(Object.values(CANONICAL_HEADER).map((h) => h.toLowerCase()));
  const renamed = headers.map((h) => (canonical.has(h.toLowerCase()) ? `${h} (document)` : h));
  for (const [field, header] of Object.entries(hint) as Array<[ReferenceField, string]>) {
    const index = headers.indexOf(header);
    if (index >= 0) renamed[index] = CANONICAL_HEADER[field];
  }
  return renamed;
}

function readTable(table: PipelineTable, hint: ColumnHint | undefined) {
  const headers = applyColumnHint(table.headers, hint);
  const indexed = table.rows
    .map((cells, index) => ({ cells, index }))
    .filter(({ cells }) => cells.some((c) => c && c.trim()));
  const records = indexed.map(({ cells }) => Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? ""])));
  const { columns } = mapReferenceColumns(headers);
  const { rows } = referenceRowsFromTable(headers, records);
  const amountHeader = headers.find((h) => AMOUNT_HEADER.test(norm(h)) && h !== columns.price);
  const priceIsMrp = columns.price ? /\bmrp\b/.test(norm(columns.price)) : false;
  const rateHeader = priceIsMrp ? headers.find((h) => RATE_HEADER.test(norm(h)) && h !== columns.price) : undefined;

  const items: ReferenceRow[] = [];
  const printedTotals: number[] = [];
  let mathFailures = 0;
  rows.forEach((row, i) => {
    const record = records[i] ?? {};
    const label = row.product || row.brand || row.raw_text;
    if (TOTAL_LINE.test(label) || (!row.product && !row.brand && TOTAL_LINE.test(row.raw_text))) {
      const total = amountHeader ? amountOf(record[amountHeader]) : null;
      if (total !== null) printedTotals.push(total);
      return;
    }
    if (!row.product && !row.brand) return;
    if (NON_ITEM_LINE.test(label) || /^[\d\s.,/-]+$/.test(`${row.product}${row.brand}`)) return;

    const sourceIndex = indexed[i]?.index;
    const confidence = sourceIndex === undefined ? null : (table.confidence?.[sourceIndex] ?? null);
    const check = new Set(row.check_fields);
    if (confidence !== null && confidence < LOW_CONFIDENCE) {
      for (const field of ["product", "qty", "price"] as const) check.add(field);
    }
    const amount = amountHeader ? amountOf(record[amountHeader]) : null;
    const rate = rateHeader ? amountOf(record[rateHeader]) : priceIsMrp ? null : row.price;
    if (row.qty !== null && rate !== null && amount !== null && amount > 0) {
      if (Math.abs(row.qty * rate - amount) > Math.max(1, amount * 0.02)) {
        mathFailures += 1;
        check.add("qty");
        check.add("price");
      }
    }
    items.push({ ...row, confidence, check_fields: [...check] });
  });
  return { items, printedTotals, mathFailures, mapped: Boolean(columns.product || columns.brand) };
}

/** Read every page; flag pages Luna should re-read. */
export function readPipelinePages(result: PipelineResult, hints: Record<string, ColumnHint> = {}): PageReading[] {
  return result.pages.map((page) => {
    if (page.source === "none") return { page: page.page, rows: [], flag: "unread", mathFailures: 0, printedTotals: [] };
    const rows: ReferenceRow[] = [];
    const printedTotals: number[] = [];
    let mathFailures = 0;
    let unmappedRows = 0;
    for (const table of page.tables) {
      const read = readTable(table, hints[headerKey(table.headers)]);
      rows.push(...read.items);
      printedTotals.push(...read.printedTotals);
      mathFailures += read.mathFailures;
      if (!read.mapped) unmappedRows += table.rows.length;
    }
    const confidences = rows.map((r) => r.confidence).filter((c): c is number => c !== null);
    const avgConfidence = confidences.length ? confidences.reduce((a, b) => a + b, 0) / confidences.length : null;
    let flag: PageFlag | null = null;
    if (unmappedRows > 0 && rows.length === 0) flag = "no_columns";
    else if (mathFailures > 0 && (rows.length < 4 || mathFailures / rows.length >= 0.25)) flag = "math";
    else if (avgConfidence !== null && avgConfidence < LOW_CONFIDENCE) flag = "low_confidence";
    return { page: page.page, rows, flag, mathFailures, printedTotals };
  });
}

function lineAmount(row: ReferenceRow): number | null {
  for (const [header, value] of Object.entries(row.extra)) {
    if (AMOUNT_HEADER.test(norm(header))) return amountOf(value);
  }
  return null;
}

function pagesLabel(pages: number[]): string {
  const shown = pages.slice(0, 12).join(", ");
  return pages.length > 12 ? `${shown} and ${pages.length - 12} more` : shown;
}

/** Final reference state: pipeline rows, with Luna's reading replacing the pages it re-read. */
export function buildPipelineState(input: {
  result: PipelineResult;
  pages: PageReading[];
  lunaPages: Map<number, ReferenceDocumentState>;
  unreadPages: number[];
  filename: string;
}): ReferenceDocumentState {
  const { result, pages, lunaPages, unreadPages, filename } = input;
  const rows: ReferenceRow[] = [];
  const printedTotals: number[] = [];
  const warnings: string[] = [];
  let mathFailures = 0;
  let lunaMeta: ReferenceDocumentState["meta"] | null = null;

  for (const page of pages) {
    const luna = lunaPages.get(page.page);
    if (luna) {
      lunaMeta ??= luna.meta;
      rows.push(...luna.rows);
      continue;
    }
    rows.push(...page.rows);
    printedTotals.push(...page.printedTotals);
    mathFailures += page.mathFailures;
  }

  const extraColumns: string[] = [];
  const numbered = rows.map((row, index) => {
    for (const key of Object.keys(row.extra)) if (!extraColumns.includes(key)) extraColumns.push(key);
    return { ...row, line_no: index + 1 };
  });

  if (unreadPages.length) {
    warnings.push(`Page${unreadPages.length === 1 ? "" : "s"} ${pagesLabel(unreadPages)} could not be read — please check them against the document.`);
  }
  if (mathFailures) {
    warnings.push(`${mathFailures} line${mathFailures === 1 ? "" : "s"}: quantity × rate does not match the printed amount — please check price and quantity.`);
  }
  const amounts = numbered.map(lineAmount).filter((a): a is number => a !== null);
  const lineSum = amounts.reduce((a, b) => a + b, 0);
  const totals = [result.document.subtotal, result.document.total_amount, ...printedTotals].filter(
    (t): t is number => typeof t === "number" && t > 0,
  );
  if (amounts.length && totals.length && !totals.some((t) => Math.abs(t - lineSum) <= Math.max(1, t * 0.01))) {
    warnings.push(
      `Line amounts add up to ${lineSum.toFixed(2)} but the document total is ${Math.max(...totals).toFixed(2)} — some lines may be missing or misread.`,
    );
  }

  const unreadShare = result.pages_total ? unreadPages.length / result.pages_total : 0;
  const doc = result.document;
  return {
    meta: {
      ...emptyReferenceMeta("document", filename),
      document_type: doc.document_type ?? lunaMeta?.document_type ?? null,
      supplier_name: doc.supplier_name ?? lunaMeta?.supplier_name ?? null,
      buyer_or_store_name: doc.buyer_or_store_name ?? lunaMeta?.buyer_or_store_name ?? null,
      document_number: doc.document_number ?? lunaMeta?.document_number ?? null,
      document_date: doc.document_date ?? lunaMeta?.document_date ?? null,
      currency: doc.currency ?? lunaMeta?.currency ?? null,
      reading_quality: unreadShare > 0.2 ? "POOR" : unreadPages.length || mathFailures ? "LIMITED" : "GOOD",
      printed_line_count: numbered.length,
      total_quantity: numbered.reduce((sum, r) => sum + (r.qty ?? 0), 0) || null,
      extra_columns: extraColumns,
      // Luna sees one page at a time, so on multi-page files its notes describe a page crop, not the document.
      warnings: [...warnings, ...(result.pages_total <= 1 ? (lunaMeta?.warnings ?? []) : [])],
    },
    rows: numbered,
  };
}
