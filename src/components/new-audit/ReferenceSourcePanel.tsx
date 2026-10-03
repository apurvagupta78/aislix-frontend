import { useRef, useState } from "react";
import { Download, FileSpreadsheet, FileText, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  CELL_INPUT,
  DOCUMENT_ACCEPT,
  DocumentBusyBanner,
  DocumentErrorBanner,
  DocumentSaveBar,
  isSpreadsheet,
  uploadAndReadDocument,
  useDocumentReader,
} from "@/components/new-audit/document-ui";
import { parseAuditSpreadsheet } from "@/lib/audit-input-dataset";
import { AISLIX_PALETTE, ACCENT_TINT } from "@/lib/ai-audit/kpi-palette";
import {
  documentTypeLabel,
  emptyReferenceMeta,
  emptyReferenceRow,
  LOW_CONFIDENCE,
  referenceCsvHeaders,
  referenceRowsFromTable,
  referenceRowsToCsvCells,
  usableReferenceRows,
  type ReferenceDocumentState,
  type ReferenceField,
  type ReferenceRow,
} from "@/lib/ai-audit/reference-document";
import { downloadSectionCsv } from "@/lib/ai-audit/section-csv";
import { cn } from "@/lib/utils";

type Props = {
  value: ReferenceDocumentState | undefined;
  onChange: (next: ReferenceDocumentState | undefined) => void;
  category?: string | null;
  subCategory?: string | null;
  /** Guests: AI document reading needs a workspace, so only CSV / Excel is parsed in the browser. */
  spreadsheetOnly?: boolean;
};

const SPREADSHEET_ACCEPT = ".csv,.xlsx,.xls,text/csv";

type Column = {
  field: ReferenceField;
  header: string;
  width: string;
  numeric?: boolean;
};

const COLUMNS: Column[] = [
  { field: "brand", header: "Brand", width: "min-w-[110px]" },
  { field: "product", header: "Product", width: "min-w-[180px]" },
  { field: "variant", header: "Variant", width: "min-w-[100px]" },
  { field: "pack_size", header: "Pack", width: "min-w-[80px]" },
  { field: "qty", header: "Qty", width: "w-[72px]", numeric: true },
  { field: "unit", header: "Unit", width: "min-w-[84px]" },
  { field: "price", header: "Price ₹", width: "min-w-[104px]", numeric: true },
  { field: "location", header: "Location", width: "min-w-[100px]" },
];

function cellValue(row: ReferenceRow, field: ReferenceField): string {
  const value = row[field];
  return value === null || value === undefined ? "" : String(value);
}

export function ReferenceSourcePanel({
  value,
  onChange,
  category,
  subCategory,
  spreadsheetOnly = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const reader = useDocumentReader();
  const [busy, setBusy] = useState<null | "upload" | "read" | "csv">(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rows = value?.rows ?? [];
  const meta = value?.meta;
  const extraColumns = meta?.extra_columns ?? [];
  const usable = usableReferenceRows(rows).length;
  const checkCount = rows.filter((row) => row.check_fields.length > 0).length;
  const unsaved = value?.saved === false;

  async function handleFile(file: File) {
    setError(null);
    try {
      if (isSpreadsheet(file)) {
        setBusy("csv");
        const dataset = await parseAuditSpreadsheet(file);
        const headers = dataset.columns.map((c) => c.name);
        const records = dataset.rows.map((row) =>
          Object.fromEntries(dataset.columns.map((c) => [c.name, row.values[c.id] ?? ""])),
        );
        const { rows: parsed, extraColumns: extra } = referenceRowsFromTable(headers, records);
        if (!parsed.length) throw new Error("No lines found in this file.");
        onChange({
          meta: { ...emptyReferenceMeta("csv", file.name), extra_columns: extra },
          rows: parsed,
          saved: true,
        });
        toast.success(`${parsed.length} lines loaded from ${file.name}`);
        return;
      }

      if (spreadsheetOnly) {
        throw new Error(
          "Upload a CSV or Excel file here. Reading invoice photos and PDFs is available in your free workspace.",
        );
      }

      const state = await uploadAndReadDocument(file, reader, {
        category,
        subCategory,
        onStage: setBusy,
        onProgress: setProgress,
      });
      if (!state.rows.length) {
        onChange({ ...state, saved: true });
        throw new Error(
          state.meta.warnings[0] ?? "AI could not find product lines in this document. Try a clearer photo.",
        );
      }
      onChange({ ...state, saved: true });
      toast.success(`AI read ${state.rows.length} lines`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read this file.");
    } finally {
      setBusy(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function updateRow(id: string, field: ReferenceField, raw: string) {
    if (!value) return;
    const column = COLUMNS.find((c) => c.field === field);
    const parsed = column?.numeric ? (raw.trim() === "" ? null : Number(raw.replace(/,/g, ""))) : raw;
    if (column?.numeric && parsed !== null && !Number.isFinite(parsed as number)) return;
    onChange({
      ...value,
      saved: false,
      rows: value.rows.map((row) =>
        row.id === id
          ? { ...row, [field]: parsed, check_fields: row.check_fields.filter((f) => f !== field) }
          : row,
      ),
    });
  }

  function updateExtra(id: string, header: string, raw: string) {
    if (!value) return;
    onChange({
      ...value,
      saved: false,
      rows: value.rows.map((row) => (row.id === id ? { ...row, extra: { ...row.extra, [header]: raw } } : row)),
    });
  }

  function removeRow(id: string) {
    if (!value) return;
    onChange({ ...value, saved: false, rows: value.rows.filter((row) => row.id !== id) });
  }

  function addRow() {
    const base = value ?? { meta: emptyReferenceMeta("csv", null), rows: [] };
    const nextLine = Math.max(0, ...base.rows.map((r) => r.line_no)) + 1;
    onChange({ ...base, saved: false, rows: [...base.rows, emptyReferenceRow(nextLine)] });
  }

  function saveRows() {
    if (!value) return;
    onChange({ ...value, saved: true });
    toast.success(`${usable} document line${usable === 1 ? "" : "s"} saved for this audit`);
  }

  function downloadCsv() {
    downloadSectionCsv(
      meta?.document_number || "reference",
      "document-lines",
      referenceCsvHeaders(extraColumns),
      referenceRowsToCsvCells(rows, extraColumns),
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border border-[#D9E2E8] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-[#102A43]">Your document</h4>
          <p className="mt-0.5 text-xs text-[#667085]">
            {spreadsheetOnly
              ? "CSV or Excel export of an invoice, purchase order, pick list or price list. Invoice photos and PDFs are read in your free workspace."
              : "Photo or PDF of an invoice, purchase order, pick list, price list or handwritten list — or a CSV / Excel file."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {rows.length ? (
            <Button type="button" variant="outline" size="sm" onClick={downloadCsv}>
              <Download className="size-3.5" /> Download CSV
            </Button>
          ) : null}
          <Button
            type="button"
            variant={rows.length ? "outline" : "brand"}
            size="sm"
            disabled={busy !== null}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
            {rows.length ? "Replace file" : spreadsheetOnly ? "Upload CSV or Excel" : "Upload document or CSV"}
          </Button>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept={spreadsheetOnly ? SPREADSHEET_ACCEPT : DOCUMENT_ACCEPT}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
        </div>
      </div>

      {busy ? <DocumentBusyBanner stage={busy} detail={progress} /> : null}

      {error ? <DocumentErrorBanner message={error} /> : null}

      {meta && rows.length ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-[#D9E2E8] bg-[#F4F7F9] px-4 py-3 text-xs text-[#667085]">
          <span className="inline-flex items-center gap-1.5 font-semibold text-[#102A43]">
            {meta.source === "csv" ? <FileSpreadsheet className="size-4" /> : <FileText className="size-4" />}
            {meta.source === "csv" ? "CSV / Excel" : documentTypeLabel(meta.document_type)}
          </span>
          {meta.filename ? <span>{meta.filename}</span> : null}
          {meta.supplier_name ? <span>Supplier: {meta.supplier_name}</span> : null}
          {meta.document_number ? <span>No. {meta.document_number}</span> : null}
          {meta.document_date ? <span>{meta.document_date}</span> : null}
          <span>
            {usable} line{usable === 1 ? "" : "s"}
            {meta.printed_line_count != null && meta.printed_line_count !== rows.length
              ? ` · document says ${meta.printed_line_count}`
              : ""}
          </span>
          {meta.reading_quality ? <span>Reading quality: {meta.reading_quality.toLowerCase()}</span> : null}
        </div>
      ) : null}

      {meta?.warnings.length && rows.length ? (
        <ul className="list-disc space-y-0.5 pl-5 text-xs text-[#667085]">
          {meta.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : null}

      {rows.length ? (
        <>
          <p className="text-xs text-[#667085]">
            <span
              className="mr-1.5 inline-block size-2.5 rounded-sm border align-middle"
              style={{ background: ACCENT_TINT.blue, borderColor: AISLIX_PALETTE.border }}
            />
            Every blue box is editable — click any cell to correct it.
            {checkCount ? (
              <>
                {" "}
                <span
                  className="mx-1.5 inline-block size-2.5 rounded-sm border align-middle"
                  style={{
                    background: ACCENT_TINT.blue,
                    borderColor: AISLIX_PALETTE.blue,
                    boxShadow: `0 0 0 1px ${AISLIX_PALETTE.blue}`,
                  }}
                />
                {checkCount} line{checkCount === 1 ? " has" : "s have"} values AI was not sure about (darker outline)
                — please check them.
              </>
            ) : null}
          </p>
          <div className="max-h-[420px] overflow-auto rounded-xl border border-[#D9E2E8]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10 bg-[#F4F7F9] text-left text-[10px] uppercase tracking-wide text-[#667085]">
                <tr>
                  <th className="px-2 py-2 font-semibold">#</th>
                  {COLUMNS.map((c) => (
                    <th key={c.field} className={cn("px-2 py-2 font-semibold", c.width)}>
                      {c.header}
                    </th>
                  ))}
                  {extraColumns.map((header) => (
                    <th key={header} className="min-w-[110px] px-2 py-2 font-semibold">
                      {header}
                    </th>
                  ))}
                  <th className="px-2 py-2 font-semibold">As printed</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-[#D9E2E8] align-top">
                    <td className="px-2 py-1.5 tabular-nums text-[#667085]">{row.line_no}</td>
                    {COLUMNS.map((c) => {
                      const flagged = row.check_fields.includes(c.field);
                      return (
                        <td key={c.field} className={cn("px-1 py-1", c.width)}>
                          <input
                            aria-label={`${c.header} line ${row.line_no}`}
                            title={flagged ? "AI was not sure about this value — please check" : `Edit ${c.header.toLowerCase()}`}
                            inputMode={c.numeric ? "decimal" : undefined}
                            className={cn(CELL_INPUT, c.numeric && "tabular-nums", flagged && "font-medium")}
                            style={{
                              background: ACCENT_TINT.blue,
                              borderColor: flagged ? AISLIX_PALETTE.blue : AISLIX_PALETTE.border,
                              boxShadow: flagged ? `0 0 0 1px ${AISLIX_PALETTE.blue}` : undefined,
                            }}
                            value={cellValue(row, c.field)}
                            onChange={(event) => updateRow(row.id, c.field, event.target.value)}
                          />
                        </td>
                      );
                    })}
                    {extraColumns.map((header) => (
                      <td key={header} className="min-w-[110px] px-1 py-1">
                        <input
                          aria-label={`${header} line ${row.line_no}`}
                          title={`Edit ${header}`}
                          className={CELL_INPUT}
                          style={{ background: ACCENT_TINT.blue, borderColor: AISLIX_PALETTE.border }}
                          value={row.extra?.[header] ?? ""}
                          onChange={(event) => updateExtra(row.id, header, event.target.value)}
                        />
                      </td>
                    ))}
                    <td className="max-w-[220px] px-2 py-1.5 text-[11px] text-[#667085]">
                      <span className="line-clamp-2" title={row.raw_text}>
                        {row.raw_text || "—"}
                      </span>
                      {row.confidence != null && row.confidence < LOW_CONFIDENCE ? (
                        <span className="text-[10px]">Read confidence {Math.round(row.confidence * 100)}%</span>
                      ) : null}
                    </td>
                    <td className="px-1 py-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        aria-label={`Remove line ${row.line_no}`}
                        onClick={() => removeRow(row.id)}
                      >
                        <Trash2 className="size-3.5 text-[#667085]" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={addRow}>
              <Plus className="size-3.5" /> Add line
            </Button>
            <p className="text-[11px] text-[#667085]">
              Each line is checked on the shelf: is it there, how many, at what price, in which bin.
            </p>
          </div>
          <DocumentSaveBar
            unsaved={unsaved}
            unsavedText="You have unsaved changes. Save them to use these lines in the audit."
            savedText={`${usable} line${usable === 1 ? "" : "s"} saved for this audit.`}
            onSave={saveRows}
          />
        </>
      ) : !busy ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-[#D9E2E8] bg-[#F4F7F9] px-4 py-8 text-center text-xs text-[#667085] hover:border-[#7DB7D6]"
        >
          <Upload className="size-5 text-[#7DB7D6]" />
          <span className="text-sm font-medium text-[#102A43]">Choose a photo, PDF or CSV</span>
          <span>Any columns work — every column and row is kept. Product, Qty, Price and Location are matched automatically.</span>
        </button>
      ) : null}
    </div>
  );
}
