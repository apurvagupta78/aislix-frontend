import { useEffect, useRef, useState } from "react";
import { Download, FileSpreadsheet, FileText, Loader2, Plus, Trash2, Upload, X } from "lucide-react";
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
  addReferenceColumn,
  documentTypeLabel,
  emptyReferenceMeta,
  emptyReferenceRow,
  LOW_CONFIDENCE,
  referenceColumnLabel,
  referenceCsvHeaders,
  referenceRowsFromTable,
  referenceRowsToCsvCells,
  removeReferenceColumn,
  renameReferenceColumn,
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
  /** "manual": the user types the product list (no upload); edits apply immediately. */
  mode?: "upload" | "manual";
};

const SPREADSHEET_ACCEPT = ".csv,.xlsx,.xls,text/csv";

type Column = {
  field: ReferenceField;
  width: string;
  numeric?: boolean;
};

const COLUMNS: Column[] = [
  { field: "brand", width: "min-w-[110px]" },
  { field: "product", width: "min-w-[180px]" },
  { field: "variant", width: "min-w-[100px]" },
  { field: "pack_size", width: "min-w-[80px]" },
  { field: "qty", width: "min-w-[72px]", numeric: true },
  { field: "unit", width: "min-w-[84px]" },
  { field: "price", width: "min-w-[104px]", numeric: true },
  { field: "location", width: "min-w-[100px]" },
];

function cellValue(row: ReferenceRow, field: ReferenceField): string {
  const value = row[field];
  return value === null || value === undefined ? "" : String(value);
}

/** Column name typed in place; applied on blur / Enter so the column doesn't re-key mid-typing. */
function HeaderInput({
  value,
  onCommit,
  autoFocus,
}: {
  value: string;
  onCommit: (next: string) => boolean;
  autoFocus?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => setDraft(value), [value]);
  useEffect(() => {
    if (autoFocus) ref.current?.select();
  }, [autoFocus]);

  function commit() {
    if (draft.trim() === value) {
      setDraft(value);
      return;
    }
    if (!onCommit(draft)) setDraft(value);
  }

  return (
    <input
      ref={ref}
      aria-label={`Column name: ${value}`}
      title="Rename column"
      className="w-full min-w-0 rounded-md border border-transparent bg-transparent px-1 py-0.5 font-semibold text-[#667085] outline-none transition-colors hover:border-[#D9E2E8] focus:border-[#04203F] focus:bg-white focus:text-[#04203F]"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          setDraft(value);
          requestAnimationFrame(() => ref.current?.blur());
        }
      }}
    />
  );
}

export function ReferenceSourcePanel({
  value,
  onChange,
  category,
  subCategory,
  spreadsheetOnly = false,
  mode = "upload",
}: Props) {
  const manual = mode === "manual";
  const inputRef = useRef<HTMLInputElement>(null);
  const reader = useDocumentReader();
  const [busy, setBusy] = useState<null | "upload" | "read" | "csv">(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newHeader, setNewHeader] = useState<string | null>(null);

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
      saved: manual,
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
      saved: manual,
      rows: value.rows.map((row) => (row.id === id ? { ...row, extra: { ...row.extra, [header]: raw } } : row)),
    });
  }

  function renameColumn(column: { field: ReferenceField } | { extra: string }, name: string): boolean {
    if (!value) return false;
    const result = renameReferenceColumn(value, column, name);
    if ("error" in result) {
      toast.error(result.error);
      return false;
    }
    if (result.state !== value) onChange({ ...result.state, saved: manual });
    return true;
  }

  function addColumn() {
    const base = value ?? { meta: emptyReferenceMeta(manual ? "manual" : "csv", null), rows: [] };
    const { state, header } = addReferenceColumn(base);
    setNewHeader(header);
    onChange({ ...state, saved: manual });
  }

  function removeColumn(header: string) {
    if (!value) return;
    const filled = value.rows.some((row) => (row.extra?.[header] ?? "").trim());
    if (filled && !window.confirm(`Remove the "${header}" column and its values?`)) return;
    onChange({ ...removeReferenceColumn(value, header), saved: manual });
  }

  function removeRow(id: string) {
    if (!value) return;
    onChange({ ...value, saved: manual, rows: value.rows.filter((row) => row.id !== id) });
  }

  function addRow() {
    const base = value ?? { meta: emptyReferenceMeta(manual ? "manual" : "csv", null), rows: [] };
    const nextLine = Math.max(0, ...base.rows.map((r) => r.line_no)) + 1;
    onChange({ ...base, saved: manual, rows: [...base.rows, emptyReferenceRow(nextLine)] });
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
      referenceCsvHeaders(extraColumns, meta?.column_labels),
      referenceRowsToCsvCells(rows, extraColumns),
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border border-[#D9E2E8] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-[#04203F]">{manual ? "Your product list" : "Your document"}</h4>
          <p className="mt-0.5 text-xs text-[#667085]">
            {manual
              ? "Type the products that should be on the shelf. Only Product or Brand is needed — fill Qty, Price, Location or Promo to have AI check those too."
              : spreadsheetOnly
                ? "CSV or Excel export of an invoice, purchase order, pick list or price list. Invoice photos and PDFs are read in your free workspace."
                : "Photo or PDF of an invoice, purchase order, pick list, price list or handwritten list — or a CSV / Excel file."}
          </p>
        </div>
        <div className={cn("flex flex-wrap gap-2", manual && "hidden")}>
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

      {meta && rows.length && !manual ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-[#D9E2E8] bg-[#F4F7F9] px-4 py-3 text-xs text-[#667085]">
          <span className="inline-flex items-center gap-1.5 font-semibold text-[#04203F]">
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

      {rows.length || manual ? (
        <>
          <p className="text-xs text-[#667085]">
            <span
              className="mr-1.5 inline-block size-2.5 rounded-sm border align-middle"
              style={{ background: ACCENT_TINT.blue, borderColor: AISLIX_PALETTE.border }}
            />
            Every blue box is editable — click any cell to correct it. Click a column name to rename it.
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
              <thead className="sticky top-0 z-10 bg-white text-left text-xs text-[#667085]">
                <tr>
                  <th className="px-2 py-2 font-semibold">#</th>
                  {COLUMNS.map((c) => (
                    <th key={c.field} className={cn("px-1 py-1.5 font-semibold", c.width)}>
                      <HeaderInput
                        value={referenceColumnLabel(meta, c.field)}
                        onCommit={(name) => renameColumn({ field: c.field }, name)}
                      />
                    </th>
                  ))}
                  {extraColumns.map((header) => (
                    <th key={header} className="min-w-[120px] px-1 py-1.5 font-semibold">
                      <div className="flex items-center gap-0.5">
                        <HeaderInput
                          value={header}
                          autoFocus={header === newHeader}
                          onCommit={(name) => renameColumn({ extra: header }, name)}
                        />
                        <button
                          type="button"
                          aria-label={`Remove column ${header}`}
                          title="Remove column"
                          className="flex size-5 shrink-0 items-center justify-center rounded text-[#667085] transition-colors hover:bg-[#F4F7F9] hover:text-[#04203F]"
                          onClick={() => removeColumn(header)}
                        >
                          <X className="size-3" />
                        </button>
                      </div>
                    </th>
                  ))}
                  {manual ? null : <th className="px-2 py-2 font-semibold">As printed</th>}
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-[#D9E2E8] align-top">
                    <td className="px-2 py-1.5 tabular-nums text-[#667085]">{row.line_no}</td>
                    {COLUMNS.map((c) => {
                      const flagged = row.check_fields.includes(c.field);
                      const label = referenceColumnLabel(meta, c.field);
                      return (
                        <td key={c.field} className={cn("px-1 py-1", c.width)}>
                          <input
                            aria-label={`${label} line ${row.line_no}`}
                            title={flagged ? "AI was not sure about this value — please check" : `Edit ${label.toLowerCase()}`}
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
                    {manual ? null : (
                      <td className="max-w-[220px] px-2 py-1.5 text-[11px] text-[#667085]">
                        <span className="line-clamp-2" title={row.raw_text}>
                          {row.raw_text || "—"}
                        </span>
                        {row.confidence != null && row.confidence < LOW_CONFIDENCE ? (
                          <span className="text-[10px]">Read confidence {Math.round(row.confidence * 100)}%</span>
                        ) : null}
                      </td>
                    )}
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
            <div className="flex flex-wrap gap-1">
              <Button type="button" variant="ghost" size="sm" onClick={addRow}>
                <Plus className="size-3.5" /> Add line
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={addColumn}>
                <Plus className="size-3.5" /> Add column
              </Button>
            </div>
            <p className="text-[11px] text-[#667085]">
              {manual
                ? `${usable} product${usable === 1 ? "" : "s"} listed · each is checked on the shelf: is it there, how many, at what price, where, and any offer.`
                : "Each line is checked on the shelf: is it there, how many, at what price, in which bin."}
            </p>
          </div>
          {manual ? null : (
            <DocumentSaveBar
              unsaved={unsaved}
              unsavedText="You have unsaved changes. Save them to use these lines in the audit."
              savedText={`${usable} line${usable === 1 ? "" : "s"} saved for this audit.`}
              onSave={saveRows}
            />
          )}
        </>
      ) : !busy ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-[#D9E2E8] bg-[#F4F7F9] px-4 py-8 text-center text-xs text-[#667085] hover:border-[#9FB3C8]"
        >
          <Upload className="size-5 text-[#04203F]" />
          <span className="text-sm font-medium text-[#04203F]">
            {spreadsheetOnly ? "Choose a CSV or Excel file" : "Choose a photo, PDF or CSV"}
          </span>
          <span>Any columns work — every column and row is kept. Product, Qty, Price and Location are matched automatically.</span>
        </button>
      ) : null}
    </div>
  );
}
