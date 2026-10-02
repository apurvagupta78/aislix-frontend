import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Download, FileSpreadsheet, FileText, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { parseAuditSpreadsheet } from "@/lib/audit-input-dataset";
import { requireOrgId } from "@/lib/db/context";
import { AISLIX_PALETTE, ACCENT_TINT } from "@/lib/ai-audit/kpi-palette";
import {
  documentTypeLabel,
  emptyReferenceMeta,
  emptyReferenceRow,
  LOW_CONFIDENCE,
  REFERENCE_CSV_HEADERS,
  referenceRowsFromTable,
  referenceRowsToCsvCells,
  usableReferenceRows,
  type ReferenceDocumentState,
  type ReferenceField,
  type ReferenceRow,
} from "@/lib/ai-audit/reference-document";
import { downloadSectionCsv } from "@/lib/ai-audit/section-csv";
import { readReferenceDocument, REFERENCE_DOCUMENT_BUCKET } from "@/lib/reference-document.functions";
import { cn } from "@/lib/utils";

const DOCUMENT_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_IMAGE_EDGE = 2400;
const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

type Props = {
  value: ReferenceDocumentState | undefined;
  onChange: (next: ReferenceDocumentState | undefined) => void;
  category?: string | null;
  subCategory?: string | null;
};

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

function isSpreadsheet(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith(".csv") || name.endsWith(".xlsx") || name.endsWith(".xls") || file.type === "text/csv";
}

/** Phone photos are downsized before upload; the reader handles text well at this size. */
async function prepareImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size <= 3 * 1024 * 1024) return file;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
  if (!blob) return file;
  return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
}

function cellValue(row: ReferenceRow, field: ReferenceField): string {
  const value = row[field];
  return value === null || value === undefined ? "" : String(value);
}

export function ReferenceSourcePanel({ value, onChange, category, subCategory }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const readDocument = useServerFn(readReferenceDocument);
  const [busy, setBusy] = useState<null | "upload" | "read" | "csv">(null);
  const [error, setError] = useState<string | null>(null);

  const rows = value?.rows ?? [];
  const meta = value?.meta;
  const usable = usableReferenceRows(rows).length;
  const checkCount = rows.filter((row) => row.check_fields.length > 0).length;

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
        const { rows: parsed, missingColumns } = referenceRowsFromTable(headers, records);
        if (missingColumns.length) {
          throw new Error("Add a Product (or Brand) column to your file. Qty, Price and Location are optional.");
        }
        if (!parsed.length) throw new Error("No product lines found in this file.");
        onChange({ meta: emptyReferenceMeta("csv", file.name), rows: parsed });
        toast.success(`${parsed.length} lines loaded from ${file.name}`);
        return;
      }

      if (!DOCUMENT_TYPES.includes(file.type)) {
        throw new Error("Upload a photo (JPG, PNG, WebP), a PDF, or a CSV / Excel file.");
      }
      setBusy("upload");
      const prepared = await prepareImage(file);
      if (prepared.size > MAX_UPLOAD_BYTES) throw new Error("File is larger than 12 MB.");
      const orgId = await requireOrgId();
      const ext = prepared.name.includes(".") ? prepared.name.split(".").pop() : "jpg";
      const storagePath = `${orgId}/reference-documents/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from(REFERENCE_DOCUMENT_BUCKET)
        .upload(storagePath, prepared, { contentType: prepared.type, upsert: false });
      if (uploadError) throw new Error("Could not upload the document. Please try again.");

      setBusy("read");
      const state = await readDocument({
        data: {
          storagePath,
          mimeType: prepared.type,
          filename: file.name,
          category,
          subCategories: subCategory ? [subCategory] : [],
        },
      });
      if (!state.rows.length) {
        onChange(state);
        throw new Error(
          state.meta.warnings[0] ?? "AI could not find product lines in this document. Try a clearer photo.",
        );
      }
      onChange(state);
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
    const parsed = column?.numeric ? (raw.trim() === "" ? null : Number(raw)) : raw;
    if (column?.numeric && parsed !== null && !Number.isFinite(parsed as number)) return;
    onChange({
      ...value,
      rows: value.rows.map((row) =>
        row.id === id
          ? { ...row, [field]: parsed, check_fields: row.check_fields.filter((f) => f !== field) }
          : row,
      ),
    });
  }

  function removeRow(id: string) {
    if (!value) return;
    onChange({ ...value, rows: value.rows.filter((row) => row.id !== id) });
  }

  function addRow() {
    const base = value ?? { meta: emptyReferenceMeta("csv", null), rows: [] };
    const nextLine = Math.max(0, ...base.rows.map((r) => r.line_no)) + 1;
    onChange({ ...base, rows: [...base.rows, emptyReferenceRow(nextLine)] });
  }

  function downloadCsv() {
    downloadSectionCsv(
      meta?.document_number || "reference",
      "document-lines",
      [...REFERENCE_CSV_HEADERS],
      referenceRowsToCsvCells(rows),
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border border-[#D9E2E8] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-[#102A43]">Your document</h4>
          <p className="mt-0.5 text-xs text-[#667085]">
            Photo or PDF of an invoice, purchase order, pick list, price list or handwritten list — or a
            CSV / Excel file.
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
            {rows.length ? "Replace file" : "Upload document or CSV"}
          </Button>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept="image/jpeg,image/png,image/webp,application/pdf,.csv,.xlsx,.xls,text/csv"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
        </div>
      </div>

      {busy ? (
        <div
          className="flex items-center gap-3 rounded-xl border px-4 py-3 text-sm text-[#102A43]"
          style={{ background: ACCENT_TINT.blue, borderColor: AISLIX_PALETTE.blue }}
          role="status"
        >
          <Loader2 className="size-4 animate-spin" />
          {busy === "upload"
            ? "Uploading document…"
            : busy === "read"
              ? "AI is reading every line of your document — this can take up to a minute."
              : "Reading your file…"}
        </div>
      ) : null}

      {error ? (
        <p
          className="rounded-xl border px-4 py-3 text-sm text-[#102A43]"
          style={{ background: AISLIX_PALETTE.pink, borderColor: "#F6CFDC" }}
          role="alert"
        >
          {error}
        </p>
      ) : null}

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
                            placeholder={flagged ? "Check" : undefined}
                            inputMode={c.numeric ? "decimal" : undefined}
                            className={cn(
                              "w-full rounded-md border px-1.5 py-1 text-xs text-[#102A43] outline-none transition-shadow placeholder:text-[#667085] focus:bg-white focus:shadow-[0_0_0_2px_#7DB7D6]",
                              c.numeric && "tabular-nums",
                              flagged && "font-medium",
                            )}
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
        </>
      ) : !busy ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-[#D9E2E8] bg-[#F4F7F9] px-4 py-8 text-center text-xs text-[#667085] hover:border-[#7DB7D6]"
        >
          <Upload className="size-5 text-[#7DB7D6]" />
          <span className="text-sm font-medium text-[#102A43]">Choose a photo, PDF or CSV</span>
          <span>Columns we look for in CSV: Product, Brand, Variant, Pack, Qty, Unit, Price, Location</span>
        </button>
      ) : null}
    </div>
  );
}
