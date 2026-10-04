import { useDeferredValue, useMemo, useRef, useState } from "react";
import {
  Download,
  FileSpreadsheet,
  FileText,
  LayoutTemplate,
  Loader2,
  Lock,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { TablePager, usePager } from "@/components/design-system/TablePager";
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
import { AISLIX_PALETTE, ACCENT_TINT } from "@/lib/ai-audit/kpi-palette";
import type { ColumnMapping } from "@/lib/audit-builder/field-roles";
import { downloadSectionCsv } from "@/lib/ai-audit/section-csv";
import {
  createAuditRow,
  inferDatasetColumnTypes,
  parseAuditSpreadsheet,
  type AuditDataColumn,
  type AuditInputDataset,
} from "@/lib/audit-input-dataset";
import { referenceStateToDataset } from "@/lib/new-audit/document-dataset";
import { syncDigitalMappings, type DigitalColumnRole } from "@/lib/new-audit/digital-columns";
import { fillTemplateDataset, isTemplateColumn } from "@/lib/new-audit/template-dataset";
import { cn } from "@/lib/utils";

export type DigitalUploadValue = {
  dataset: AuditInputDataset;
  mappings: ColumnMapping[];
  saved: boolean;
};

type Props = {
  value: DigitalUploadValue;
  onChange: (next: DigitalUploadValue) => void;
  error?: string | null;
  /** Columns come from a chosen template: template column names are locked and files fill those columns. */
  templateName?: string;
};

function rowHasValue(row: AuditInputDataset["rows"][number]): boolean {
  return Object.values(row.values).some((v) => (v ?? "").trim());
}

const ROLE_STYLE: Record<
  DigitalColumnRole,
  { label: string; short: string; hint: string; tint: string; border: string }
> = {
  reference: {
    label: "Already provided",
    short: "Provided",
    hint: "the auditee sees it but can't change it",
    tint: ACCENT_TINT.blue,
    border: AISLIX_PALETTE.blue,
  },
  auditor_input: {
    label: "Auditee fills",
    short: "Auditee fills",
    hint: "entered during the audit",
    tint: ACCENT_TINT.purple,
    border: AISLIX_PALETTE.purple,
  },
};

const ROLES = Object.keys(ROLE_STYLE) as DigitalColumnRole[];

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
    <div
      role="radiogroup"
      aria-label={`Who fills ${columnName}`}
      className="grid grid-cols-2 rounded-md border border-[#D9E2E8] bg-[#F4F7F9] p-0.5"
    >
      {ROLES.map((r) => {
        const active = r === role;
        return (
          <button
            key={r}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(r)}
            title={ROLE_STYLE[r].label}
            className={cn(
              "min-w-0 truncate rounded px-1.5 py-1 text-[11px] font-medium transition-colors",
              active ? "text-[#102A43]" : "text-[#667085] hover:text-[#102A43]",
            )}
            style={active ? { boxShadow: `inset 0 0 0 1px ${ROLE_STYLE[r].border}`, background: ROLE_STYLE[r].tint } : undefined}
          >
            {ROLE_STYLE[r].short}
          </button>
        );
      })}
    </div>
  );
}

function ColumnHeader({
  column,
  mapping,
  locked,
  added,
  providedColumns,
  onRename,
  onRemove,
  onRole,
  onCompare,
}: {
  column: AuditDataColumn;
  mapping: ColumnMapping | undefined;
  locked: boolean;
  added: boolean;
  providedColumns: AuditDataColumn[];
  onRename: (name: string) => void;
  onRemove: () => void;
  onRole: (role: DigitalColumnRole) => void;
  onCompare: (otherId: string) => void;
}) {
  const role = roleOf(mapping);
  return (
    <div className="space-y-1.5">
      <div className="flex min-w-0 items-center gap-1">
        {locked ? (
          <>
            <p className="min-w-0 flex-1 truncate px-1 py-0.5 text-xs font-semibold text-[#102A43]" title={column.name}>
              {column.name}
            </p>
            <Lock className="size-3 shrink-0 text-[#98A2B3]" aria-label="From the template" />
          </>
        ) : (
          <>
            <input
              aria-label={`Column name ${column.name}`}
              title="Rename column"
              className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-xs font-semibold text-[#102A43] outline-none hover:border-[#D9E2E8] focus:border-[#7DB7D6] focus:bg-white"
              value={column.name}
              onChange={(event) => onRename(event.target.value)}
            />
            {added ? (
              <span className="shrink-0 rounded bg-[#EEF1F4] px-1.5 py-0.5 text-[10px] font-medium text-[#667085]">
                Added
              </span>
            ) : null}
            <button
              type="button"
              aria-label={`Remove column ${column.name}`}
              title="Remove column"
              className="shrink-0 rounded p-0.5 text-[#667085] hover:bg-white hover:text-[#102A43]"
              onClick={onRemove}
            >
              <X className="size-3.5" />
            </button>
          </>
        )}
      </div>
      <RoleToggle role={role} columnName={column.name} onChange={onRole} />
      {role === "auditor_input" && providedColumns.length ? (
        <select
          aria-label={`Compare ${column.name} with`}
          className="w-full rounded-md border border-[#D9E2E8] bg-white px-1.5 py-1 text-[11px] text-[#102A43]"
          value={mapping?.compareWithColumnId ?? ""}
          onChange={(event) => onCompare(event.target.value)}
        >
          <option value="">No comparison</option>
          {providedColumns.map((p) => (
            <option key={p.id} value={p.id}>
              Compare with {p.name}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}

export function DigitalAuditUploadPanel({ value, onChange, error, templateName }: Props) {
  const isTemplate = Boolean(templateName);
  const inputRef = useRef<HTMLInputElement>(null);
  const reader = useDocumentReader();
  const [busy, setBusy] = useState<null | "upload" | "read" | "csv">(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [readWarnings, setReadWarnings] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  const { dataset, mappings, saved } = value;
  const columns = dataset.columns;
  const rows = dataset.rows;
  const hasData = isTemplate ? columns.length > 0 : dataset.source === "csv" && columns.length > 0;
  const byId = new Map(mappings.map((m) => [m.columnId, m]));
  const providedColumns = columns.filter((c) => roleOf(byId.get(c.id)) === "reference");
  const auditeeCount = columns.length - providedColumns.length;
  const isSheetFile = /\.(csv|xlsx?)$/i.test(dataset.filename ?? "");
  const noun = isTemplate ? "line" : "row";
  const plural = (n: number) => `${n.toLocaleString()} ${noun}${n === 1 ? "" : "s"}`;

  const visibleIndexes = useMemo(() => {
    if (!deferredQuery) return null;
    const hits: number[] = [];
    rows.forEach((row, index) => {
      if (columns.some((c) => (row.values[c.id] ?? "").toLowerCase().includes(deferredQuery))) hits.push(index);
    });
    return hits;
  }, [rows, columns, deferredQuery]);
  const pager = usePager(visibleIndexes ? visibleIndexes.length : rows.length);
  const pageIndexes = useMemo(() => {
    const out: number[] = [];
    for (let i = pager.start; i < pager.end; i += 1) out.push(visibleIndexes ? visibleIndexes[i]! : i);
    return out;
  }, [pager.start, pager.end, visibleIndexes]);

  function emit(nextDataset: AuditInputDataset, nextMappings: ColumnMapping[], nextSaved = false) {
    onChange({
      dataset: nextDataset,
      mappings: syncDigitalMappings(nextDataset, nextMappings),
      saved: nextSaved,
    });
  }

  async function handleFile(file: File) {
    setFileError(null);
    setReadWarnings([]);
    try {
      let next: AuditInputDataset;
      let warnings: string[] = [];
      if (isSpreadsheet(file)) {
        setBusy("csv");
        next = await parseAuditSpreadsheet(file);
      } else {
        const state = await uploadAndReadDocument(file, reader, { onStage: setBusy, onProgress: setProgress });
        if (!state.rows.length) {
          throw new Error(
            state.meta.warnings[0] ?? "AI could not find any lines in this document. Try a clearer photo.",
          );
        }
        next = referenceStateToDataset(state);
        warnings = state.meta.warnings;
      }
      if (!next.rows.length) throw new Error("No rows found in this file.");
      setQuery("");
      pager.setPage(0);
      if (isTemplate) {
        const filled = fillTemplateDataset(dataset, next);
        if (!filled.dataset.rows.length) throw new Error("No rows found in this file.");
        emit(filled.dataset, mappings, true);
        const notes = [...warnings];
        if (!filled.matched.length) {
          notes.push("None of the file's columns match the template's columns, so they were all added as new columns.");
        } else if (filled.added.length) {
          notes.push(`Added as new columns: ${filled.added.join(", ")}.`);
        }
        setReadWarnings(notes);
        toast.success(`${plural(filled.dataset.rows.length)} filled from ${file.name}`);
        return;
      }
      emit(next, [], true);
      setReadWarnings(warnings);
      toast.success(`${plural(next.rows.length)} loaded from ${file.name}`);
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
      mappings
        .filter((m) => m.columnId !== columnId)
        .map((m) => (m.compareWithColumnId === columnId ? { ...m, compareWithColumnId: undefined } : m)),
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
    setQuery("");
    emit({ ...dataset, rows: [...rows, createAuditRow(columns)] }, mappings);
    pager.setPage(Math.ceil((rows.length + 1) / pager.pageSize) - 1);
  }

  function removeRow(rowId: string) {
    emit({ ...dataset, rows: rows.filter((r) => r.id !== rowId) }, mappings);
  }

  function save() {
    const filled = { ...dataset, rows: rows.filter(rowHasValue) };
    const typed = isTemplate ? filled : inferDatasetColumnTypes(filled);
    const typedMappings = mappings.map((m) => ({
      ...m,
      dataType: typed.columns.find((c) => c.id === m.columnId)?.type ?? m.dataType,
    }));
    onChange({ dataset: typed, mappings: syncDigitalMappings(typed, typedMappings), saved: true });
    toast.success(`${plural(typed.rows.length)} saved for this audit`);
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
    <div className="min-w-0 space-y-4 rounded-2xl border border-[#D9E2E8] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-[#102A43]">
            {isTemplate ? "Template fields and lines" : "Your audit data"}
          </h4>
          <p className="mt-0.5 max-w-2xl text-xs text-[#667085]">
            {isTemplate
              ? `Columns start from “${templateName}” — add your own if you need more. Then list the lines to check, or fill them from a photo, PDF, CSV or Excel file.`
              : "Photo or PDF of an invoice, stock list or price list — or a CSV / Excel file."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasData && rows.length ? (
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
            {isTemplate ? "Fill from file" : hasData ? "Replace file" : "Upload file"}
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

      {busy ? <DocumentBusyBanner stage={busy} detail={progress} /> : null}
      {fileError ? <DocumentErrorBanner message={fileError} /> : null}
      {readWarnings.length && hasData ? (
        <ul className="list-disc space-y-0.5 pl-5 text-xs text-[#667085]">
          {readWarnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : null}

      {hasData ? (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-[#D9E2E8] bg-[#F4F7F9] px-4 py-2.5 text-xs text-[#667085]">
            <span className="inline-flex items-center gap-1.5 font-semibold text-[#102A43]">
              {isTemplate ? (
                <LayoutTemplate className="size-4" />
              ) : isSheetFile ? (
                <FileSpreadsheet className="size-4" />
              ) : (
                <FileText className="size-4" />
              )}
              {isTemplate ? "Template" : isSheetFile ? "CSV / Excel" : "Document"}
            </span>
            {dataset.filename ? <span className="min-w-0 truncate">{dataset.filename}</span> : null}
            <span>{plural(rows.length)}</span>
            <span>
              {columns.length} column{columns.length === 1 ? "" : "s"} · {providedColumns.length} provided ·{" "}
              {auditeeCount} auditee fills
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-[#102A43]">Set all columns:</span>
              {ROLES.map((r) => (
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
            </div>
            <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#667085]">
              {ROLES.map((r) => (
                <span key={r} className="inline-flex items-center gap-1.5">
                  <span
                    className="inline-block size-2.5 rounded-sm border"
                    style={{ background: ROLE_STYLE[r].tint, borderColor: ROLE_STYLE[r].border }}
                  />
                  {ROLE_STYLE[r].label} — {ROLE_STYLE[r].hint}
                </span>
              ))}
            </p>
          </div>

          <section className="min-w-0 rounded-xl border border-[#D9E2E8]">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D9E2E8] px-3 py-2">
              <p className="text-xs font-semibold text-[#102A43]">
                {isTemplate ? "Lines to check" : "Rows"}
                <span className="ml-1.5 font-normal text-[#667085]">({rows.length.toLocaleString()})</span>
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {rows.length ? (
                  <label className="relative">
                    <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-[#98A2B3]" />
                    <input
                      type="search"
                      aria-label={`Search ${noun}s`}
                      placeholder={`Search ${noun}s`}
                      className="h-7 w-48 rounded-md border border-[#D9E2E8] bg-white pl-7 pr-2 text-xs text-[#102A43] outline-none focus:border-[#7DB7D6]"
                      value={query}
                      onChange={(event) => {
                        setQuery(event.target.value);
                        pager.setPage(0);
                      }}
                    />
                  </label>
                ) : null}
                <Button type="button" variant="outline" size="sm" className="h-7" onClick={addColumn}>
                  <Plus className="size-3.5" /> Add column
                </Button>
                <Button type="button" variant="outline" size="sm" className="h-7" onClick={addRow}>
                  <Plus className="size-3.5" /> Add {noun}
                </Button>
              </div>
            </header>

            <div className="max-h-[600px] overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10 bg-[#F4F7F9] text-left">
                  <tr>
                    <th className="w-10 px-2 py-2 align-top text-[11px] font-semibold text-[#667085]">#</th>
                    {columns.map((column) => {
                      const fromTemplate = isTemplate && isTemplateColumn(column.id);
                      return (
                        <th key={column.id} className="min-w-[180px] px-1.5 py-2 align-top font-normal">
                          <ColumnHeader
                            column={column}
                            mapping={byId.get(column.id)}
                            locked={fromTemplate}
                            added={isTemplate && !fromTemplate}
                            providedColumns={providedColumns.filter((p) => p.id !== column.id)}
                            onRename={(name) => renameColumn(column.id, name)}
                            onRemove={() => removeColumn(column.id)}
                            onRole={(r) => setRole(column.id, r)}
                            onCompare={(otherId) => setCompareWith(column.id, otherId)}
                          />
                        </th>
                      );
                    })}
                    <th className="w-9 px-1 py-2" />
                  </tr>
                </thead>
                {rows.length ? (
                    <tbody>
                      {pageIndexes.map((index) => {
                        const row = rows[index]!;
                        return (
                          <tr key={row.id} className="border-t border-[#D9E2E8] align-top">
                            <td className="px-2 py-1.5 tabular-nums text-[#667085]">{(index + 1).toLocaleString()}</td>
                            {columns.map((column) => {
                              const role = roleOf(byId.get(column.id));
                              return (
                                <td key={column.id} className="min-w-[140px] px-1 py-1">
                                  <input
                                    aria-label={`${column.name} ${noun} ${index + 1}`}
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
                                aria-label={`Remove ${noun} ${index + 1}`}
                                onClick={() => removeRow(row.id)}
                              >
                                <Trash2 className="size-3.5 text-[#667085]" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                ) : null}
              </table>
            </div>
            {rows.length && visibleIndexes && !visibleIndexes.length ? (
              <p className="border-t border-[#D9E2E8] px-4 py-6 text-center text-xs text-[#667085]">
                No {noun}s match “{query.trim()}”.
              </p>
            ) : null}
            {rows.length ? (
              <TablePager pager={pager} noun={`${noun}s`} className="border-t border-[#D9E2E8]" />
            ) : (
              <div className="border-t border-[#D9E2E8] px-4 py-6 text-center text-xs text-[#667085]">
                <p className="text-sm font-medium text-[#102A43]">No {noun}s yet</p>
                <p className="mx-auto mt-1 max-w-md">
                  {isTemplate
                    ? "Add the products or items to check, fill them from a file, or leave this empty and the auditee adds lines during the audit."
                    : "Add a row to start."}
                </p>
              </div>
            )}
          </section>
          <p className="text-[11px] text-[#667085]">
            Compare an auditee column with a provided one to see the difference on the results page.
          </p>

          {error ? <DocumentErrorBanner message={error} /> : null}

          <DocumentSaveBar
            unsaved={!saved}
            unsavedText="You have unsaved changes. Save them to use this data in the audit."
            savedText={
              isTemplate && !rows.length
                ? "No lines added — the auditee adds lines during the audit."
                : `${plural(rows.length)} saved for this audit.`
            }
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
