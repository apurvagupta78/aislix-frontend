import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
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
} from "@/components/new-audit/document-ui";
import { AISLIX_PALETTE, ACCENT_TINT } from "@/lib/ai-audit/kpi-palette";
import type { ColumnMapping } from "@/lib/audit-builder/field-roles";
import { downloadSectionCsv } from "@/lib/ai-audit/section-csv";
import {
  createAuditRow,
  inferDatasetColumnTypes,
  parseAuditSpreadsheet,
  type AuditInputDataset,
} from "@/lib/audit-input-dataset";
import { referenceStateToDataset } from "@/lib/new-audit/document-dataset";
import {
  syncDigitalMappings,
  type DigitalColumnRole,
  type DigitalRowEvidence,
} from "@/lib/new-audit/digital-columns";
import { readReferenceDocument } from "@/lib/reference-document.functions";
import { cn } from "@/lib/utils";

export type DigitalUploadValue = {
  dataset: AuditInputDataset;
  mappings: ColumnMapping[];
  saved: boolean;
  rowEvidence: DigitalRowEvidence;
};

const ROW_EVIDENCE_LABELS: Record<DigitalRowEvidence, string> = {
  required: "Required",
  on_mismatch: "Required on mismatches",
  optional: "Optional",
  off: "Off",
};

type Props = {
  value: DigitalUploadValue;
  onChange: (next: DigitalUploadValue) => void;
  error?: string | null;
};

const ROLE_STYLE: Record<DigitalColumnRole, { label: string; tint: string; border: string }> = {
  reference: { label: "Already provided", tint: ACCENT_TINT.blue, border: AISLIX_PALETTE.blue },
  auditor_input: { label: "Auditee fills", tint: ACCENT_TINT.purple, border: AISLIX_PALETTE.purple },
};

function roleOf(mapping: ColumnMapping | undefined): DigitalColumnRole {
  return mapping?.fieldRole === "auditor_input" ? "auditor_input" : "reference";
}

function RoleToggle({
  role,
  columnName,
  onChange,
}: {
  role: DigitalColumnRole;
  columnName: string;
  onChange: (role: DigitalColumnRole) => void;
}) {
  return (
    <div role="radiogroup" aria-label={`Who fills ${columnName}`} className="inline-flex rounded-md border border-[#D9E2E8] bg-white p-0.5">
      {(Object.keys(ROLE_STYLE) as DigitalColumnRole[]).map((r) => {
        const active = r === role;
        return (
          <button
            key={r}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(r)}
            className={cn(
              "whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-normal transition-colors",
              active ? "text-[#102A43]" : "text-[#667085] hover:text-[#102A43]",
            )}
            style={active ? { background: ROLE_STYLE[r].tint, boxShadow: `inset 0 0 0 1px ${ROLE_STYLE[r].border}` } : undefined}
          >
            {ROLE_STYLE[r].label}
          </button>
        );
      })}
    </div>
  );
}

export function DigitalAuditUploadPanel({ value, onChange, error }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const readDocument = useServerFn(readReferenceDocument);
  const [busy, setBusy] = useState<null | "upload" | "read" | "csv">(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const { dataset, mappings, saved, rowEvidence } = value;
  const columns = dataset.columns;
  const rows = dataset.rows;
  const hasData = dataset.source === "csv" && columns.length > 0;
  const byId = new Map(mappings.map((m) => [m.columnId, m]));
  const providedColumns = columns.filter((c) => roleOf(byId.get(c.id)) === "reference");
  const auditeeCount = columns.length - providedColumns.length;
  const isSheetFile = /\.(csv|xlsx?)$/i.test(dataset.filename ?? "");

  function emit(nextDataset: AuditInputDataset, nextMappings: ColumnMapping[], nextSaved = false) {
    onChange({
      dataset: nextDataset,
      mappings: syncDigitalMappings(nextDataset, nextMappings),
      saved: nextSaved,
      rowEvidence,
    });
  }

  async function handleFile(file: File) {
    setFileError(null);
    try {
      let next: AuditInputDataset;
      if (isSpreadsheet(file)) {
        setBusy("csv");
        next = await parseAuditSpreadsheet(file);
      } else {
        const state = await uploadAndReadDocument(file, readDocument, { onStage: setBusy });
        if (!state.rows.length) {
          throw new Error(
            state.meta.warnings[0] ?? "AI could not find any lines in this document. Try a clearer photo.",
          );
        }
        next = referenceStateToDataset(state);
      }
      if (!next.rows.length) throw new Error("No rows found in this file.");
      emit(next, [], true);
      toast.success(`${next.rows.length} rows loaded from ${file.name}`);
    } catch (e) {
      setFileError(e instanceof Error ? e.message : "Could not read this file.");
    } finally {
      setBusy(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function setRole(columnId: string, role: DigitalColumnRole) {
    emit(
      dataset,
      mappings.map((m) => (m.columnId === columnId ? { ...m, fieldRole: role } : m)),
    );
  }

  function setAllRoles(role: DigitalColumnRole) {
    emit(dataset, mappings.map((m) => ({ ...m, fieldRole: role })));
  }

  function setCompareWith(columnId: string, otherId: string) {
    emit(
      dataset,
      mappings.map((m) =>
        m.columnId === columnId ? { ...m, compareWithColumnId: otherId || undefined } : m,
      ),
    );
  }

  function renameColumn(columnId: string, name: string) {
    emit(
      { ...dataset, columns: columns.map((c) => (c.id === columnId ? { ...c, name } : c)) },
      mappings.map((m) => (m.columnId === columnId ? { ...m, columnName: name } : m)),
    );
  }

  function removeColumn(columnId: string) {
    emit(
      {
        ...dataset,
        columns: columns.filter((c) => c.id !== columnId),
        rows: rows.map((r) => {
          const { [columnId]: _removed, ...values } = r.values;
          return { ...r, values };
        }),
      },
      mappings.filter((m) => m.columnId !== columnId),
    );
  }

  function addColumn() {
    const existing = new Set(columns.map((c) => c.name.trim().toLowerCase()));
    let name = "New column";
    for (let n = 2; existing.has(name.toLowerCase()); n += 1) name = `New column ${n}`;
    const column = { id: crypto.randomUUID(), name, type: "text" as const };
    emit(
      {
        ...dataset,
        columns: [...columns, column],
        rows: rows.map((r) => ({ ...r, values: { ...r.values, [column.id]: "" } })),
      },
      [
        ...mappings,
        {
          columnId: column.id,
          columnName: name,
          dataType: "text",
          fieldRole: "auditor_input",
          aislixMapping: "custom",
          auditorFills: true,
          required: true,
          evidenceRequired: false,
        },
      ],
    );
  }

  function updateCell(rowId: string, columnId: string, raw: string) {
    emit(
      {
        ...dataset,
        rows: rows.map((r) => (r.id === rowId ? { ...r, values: { ...r.values, [columnId]: raw } } : r)),
      },
      mappings,
    );
  }

  function addRow() {
    emit({ ...dataset, rows: [...rows, createAuditRow(columns)] }, mappings);
  }

  function removeRow(rowId: string) {
    emit({ ...dataset, rows: rows.filter((r) => r.id !== rowId) }, mappings);
  }

  function save() {
    const typed = inferDatasetColumnTypes(dataset);
    const typedMappings = mappings.map((m) => ({
      ...m,
      dataType: typed.columns.find((c) => c.id === m.columnId)?.type ?? m.dataType,
    }));
    onChange({ dataset: typed, mappings: syncDigitalMappings(typed, typedMappings), saved: true, rowEvidence });
    toast.success(`${rows.length} row${rows.length === 1 ? "" : "s"} saved for this audit`);
  }

  function downloadCsv() {
    downloadSectionCsv(
      (dataset.filename ?? "audit-data").replace(/\.[^.]+$/, ""),
      "audit-data",
      columns.map((c) => c.name),
      rows.map((r) => columns.map((c) => r.values[c.id] ?? "")),
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border border-[#D9E2E8] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-[#102A43]">Your audit data</h4>
          <p className="mt-0.5 text-xs text-[#667085]">
            Photo or PDF of an invoice, stock list or price list — or a CSV / Excel file.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasData ? (
            <Button type="button" variant="outline" size="sm" onClick={downloadCsv}>
              <Download className="size-3.5" /> Download CSV
            </Button>
          ) : null}
          <Button
            type="button"
            variant={hasData ? "outline" : "brand"}
            size="sm"
            disabled={busy !== null}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
            {hasData ? "Replace file" : "Upload file"}
          </Button>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept={DOCUMENT_ACCEPT}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
        </div>
      </div>

      {busy ? <DocumentBusyBanner stage={busy} /> : null}
      {fileError ? <DocumentErrorBanner message={fileError} /> : null}

      {hasData ? (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-[#D9E2E8] bg-[#F4F7F9] px-4 py-3 text-xs text-[#667085]">
            <span className="inline-flex items-center gap-1.5 font-semibold text-[#102A43]">
              {isSheetFile ? <FileSpreadsheet className="size-4" /> : <FileText className="size-4" />}
              {isSheetFile ? "CSV / Excel" : "Document"}
            </span>
            {dataset.filename ? <span>{dataset.filename}</span> : null}
            <span>
              {rows.length} row{rows.length === 1 ? "" : "s"}
            </span>
            <span>
              {columns.length} column{columns.length === 1 ? "" : "s"} · {providedColumns.length} provided ·{" "}
              {auditeeCount} auditee fills
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-[#102A43]">Set all columns:</span>
              {(Object.keys(ROLE_STYLE) as DigitalColumnRole[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setAllRoles(r)}
                  className="rounded-md border px-2.5 py-1 text-xs font-medium text-[#102A43] hover:brightness-95"
                  style={{ background: ROLE_STYLE[r].tint, borderColor: ROLE_STYLE[r].border }}
                >
                  {ROLE_STYLE[r].label}
                </button>
              ))}
              <label className="ml-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[#102A43]">
                Photo evidence per row:
                <select
                  aria-label="Photo evidence per row"
                  className="rounded-md border border-[#D9E2E8] bg-white px-1.5 py-1 text-xs font-normal text-[#102A43]"
                  value={rowEvidence}
                  onChange={(event) =>
                    onChange({ ...value, rowEvidence: event.target.value as DigitalRowEvidence })
                  }
                >
                  {(Object.keys(ROW_EVIDENCE_LABELS) as DigitalRowEvidence[]).map((mode) => (
                    <option key={mode} value={mode}>
                      {ROW_EVIDENCE_LABELS[mode]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="text-xs text-[#667085]">
              <span
                className="mr-1 inline-block size-2.5 rounded-sm border align-middle"
                style={{ background: ROLE_STYLE.reference.tint, borderColor: ROLE_STYLE.reference.border }}
              />
              Already provided — the auditee sees it but can't change it.{" "}
              <span
                className="ml-2 mr-1 inline-block size-2.5 rounded-sm border align-middle"
                style={{ background: ROLE_STYLE.auditor_input.tint, borderColor: ROLE_STYLE.auditor_input.border }}
              />
              Auditee fills — entered during the audit.
            </p>
          </div>

          <div className="max-h-[460px] overflow-auto rounded-xl border border-[#D9E2E8]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10 bg-[#F4F7F9] text-left text-[10px] uppercase tracking-wide text-[#667085]">
                <tr>
                  <th className="px-2 py-2 align-top font-semibold">#</th>
                  {columns.map((column) => {
                    const mapping = byId.get(column.id);
                    const role = roleOf(mapping);
                    return (
                      <th key={column.id} className="min-w-[150px] px-1.5 py-2 align-top font-semibold">
                        <div className="flex items-center gap-1">
                          <input
                            aria-label={`Column name ${column.name}`}
                            title="Rename column"
                            className="w-full min-w-0 rounded border border-transparent bg-transparent px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#102A43] outline-none hover:border-[#D9E2E8] focus:border-[#7DB7D6] focus:bg-white"
                            value={column.name}
                            onChange={(event) => renameColumn(column.id, event.target.value)}
                          />
                          <button
                            type="button"
                            aria-label={`Remove column ${column.name}`}
                            title="Remove column"
                            className="shrink-0 rounded p-0.5 text-[#667085] hover:bg-white hover:text-[#102A43]"
                            onClick={() => removeColumn(column.id)}
                          >
                            <X className="size-3" />
                          </button>
                        </div>
                        <div className="mt-1.5">
                          <RoleToggle role={role} columnName={column.name} onChange={(r) => setRole(column.id, r)} />
                        </div>
                        {role === "auditor_input" ? (
                          <select
                            aria-label={`Compare ${column.name} with`}
                            className="mt-1.5 w-full rounded-md border border-[#D9E2E8] bg-white px-1 py-0.5 text-[10px] font-normal normal-case tracking-normal text-[#102A43]"
                            value={mapping?.compareWithColumnId ?? ""}
                            onChange={(event) => setCompareWith(column.id, event.target.value)}
                          >
                            <option value="">No comparison</option>
                            {providedColumns.map((p) => (
                              <option key={p.id} value={p.id}>
                                Compare with {p.name}
                              </option>
                            ))}
                          </select>
                        ) : null}
                      </th>
                    );
                  })}
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.id} className="border-t border-[#D9E2E8] align-top">
                    <td className="px-2 py-1.5 tabular-nums text-[#667085]">{index + 1}</td>
                    {columns.map((column) => {
                      const role = roleOf(byId.get(column.id));
                      return (
                        <td key={column.id} className="min-w-[150px] px-1 py-1">
                          <input
                            aria-label={`${column.name} row ${index + 1}`}
                            placeholder={role === "auditor_input" ? "Auditee fills" : undefined}
                            className={cn(CELL_INPUT, "placeholder:italic placeholder:text-[#98A2B3]")}
                            style={{
                              background: role === "auditor_input" ? ACCENT_TINT.grey : ACCENT_TINT.blue,
                              borderColor: AISLIX_PALETTE.border,
                            }}
                            value={row.values[column.id] ?? ""}
                            onChange={(event) => updateCell(row.id, column.id, event.target.value)}
                          />
                        </td>
                      );
                    })}
                    <td className="px-1 py-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        aria-label={`Remove row ${index + 1}`}
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

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={addRow}>
              <Plus className="size-3.5" /> Add line
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={addColumn}>
              <Plus className="size-3.5" /> Add column
            </Button>
            <p className="ml-auto text-[11px] text-[#667085]">
              Pair an auditee column with a provided one to see the difference on the results page.
            </p>
          </div>

          {error ? <DocumentErrorBanner message={error} /> : null}

          <DocumentSaveBar
            unsaved={!saved}
            unsavedText="You have unsaved changes. Save them to use this data in the audit."
            savedText={`${rows.length} row${rows.length === 1 ? "" : "s"} saved for this audit.`}
            onSave={save}
          />
        </>
      ) : !busy ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-[#D9E2E8] bg-[#F4F7F9] px-4 py-8 text-center text-xs text-[#667085] hover:border-[#7DB7D6]"
        >
          <Upload className="size-5 text-[#7DB7D6]" />
          <span className="text-sm font-medium text-[#102A43]">Choose a photo, PDF, CSV or Excel file</span>
          <span>
            Any columns work — every column and row is kept. Then mark each column as already provided or for
            the auditee to fill.
          </span>
        </button>
      ) : null}
    </div>
  );
}
