import { Info } from "lucide-react";

import { EvidenceImage } from "@/components/audit-builder/AuditExecutionForm";
import { AISLIX_PALETTE, ACCENT_TINT, type AislixAccent } from "@/lib/ai-audit/kpi-palette";
import {
  EVIDENCE_STATUS_LABEL,
  evidenceCheck,
  verifyPair,
  type EvidenceStatus,
  type PairStatus,
} from "@/lib/audit-engine/execution-table";
import type { DigitalColumnsAudit, DigitalResultColumn, DigitalResultRow } from "@/lib/new-audit/digital-columns";
import { cn } from "@/lib/utils";

type Pair = { auditee: DigitalResultColumn; provided: DigitalResultColumn };

function verify(row: Record<string, string | null>, pair: Pair) {
  return verifyPair(row[pair.provided.key], row[pair.auditee.key]);
}

const PAIR_PILL: Record<PairStatus, { label: string; background: string; border: string }> = {
  match: { label: "Match", background: ACCENT_TINT.green, border: AISLIX_PALETTE.green },
  mismatch: { label: "Mismatch", background: AISLIX_PALETTE.pink, border: AISLIX_PALETTE.border },
  not_filled: { label: "Not filled", background: AISLIX_PALETTE.grey, border: AISLIX_PALETTE.border },
};

const EVIDENCE_PILL: Record<EvidenceStatus, { background: string; border: string; dashed?: boolean }> = {
  verified: { background: ACCENT_TINT.green, border: AISLIX_PALETTE.green },
  needs_review: { background: AISLIX_PALETTE.pink, border: AISLIX_PALETTE.border },
  missing: { background: AISLIX_PALETTE.pink, border: AISLIX_PALETTE.secondary, dashed: true },
  not_required: { background: AISLIX_PALETTE.grey, border: AISLIX_PALETTE.border },
};

const EVIDENCE_STATUSES = new Set<EvidenceStatus>(["verified", "needs_review", "missing", "not_required"]);

function rowEvidence(row: DigitalResultRow, audit: DigitalColumnsAudit, hasMismatch: boolean) {
  const [status, ...reasons] = row.evidence ?? [];
  if (status && EVIDENCE_STATUSES.has(status as EvidenceStatus)) {
    return { status: status as EvidenceStatus, reasons };
  }
  return evidenceCheck({ mode: audit.rowEvidence, photos: row.photos, minimumPhotos: 1, flags: [], hasMismatch });
}

function StatusPill({ label, background, border, dashed, title }: { label: string; background: string; border: string; dashed?: boolean; title?: string }) {
  return (
    <span
      title={title}
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-medium text-[#102A43]"
      style={{ background, border: `1px ${dashed ? "dashed" : "solid"} ${border}` }}
    >
      {label}
      {title ? <Info className="size-3 text-[#667085]" /> : null}
    </span>
  );
}

function formatDiff(value: number): string {
  const fixed = Math.abs(value) % 1 === 0 ? String(Math.abs(value)) : Math.abs(value).toFixed(2);
  return value > 0 ? `+${fixed}` : value < 0 ? `−${fixed}` : fixed;
}

function ResultKpi({
  label,
  value,
  context,
  info,
  accent,
}: {
  label: string;
  value: string;
  context: string;
  info: string;
  accent: AislixAccent;
}) {
  const unavailable = value === "N/A";
  return (
    <div
      className="rounded-2xl border border-[#D9E2E8] bg-white p-4 shadow-sm"
      style={{ borderLeft: `4px solid ${unavailable ? AISLIX_PALETTE.grey : AISLIX_PALETTE[accent]}` }}
    >
      <p className="flex items-center gap-1.5 text-xs font-medium text-[#102A43]">
        {label}
        <span title={info} aria-label={info}>
          <Info className="size-3.5 text-[#667085]" />
        </span>
      </p>
      <p className={cn("mt-2 text-2xl font-semibold tabular-nums", unavailable ? "text-[#667085]" : "text-[#102A43]")}>
        {value}
      </p>
      <p className="mt-1 text-[11px] text-[#667085]">{context}</p>
    </div>
  );
}

export function DigitalAuditColumnsResults({ audit }: { audit: DigitalColumnsAudit }) {
  const provided = audit.columns.filter((c) => c.role === "reference");
  const auditee = audit.columns.filter((c) => c.role === "auditor_input");
  const providedByKey = new Map(provided.map((c) => [c.key, c]));
  const pairs: Pair[] = auditee.flatMap((c) => {
    const target = c.compareWithKey ? providedByKey.get(c.compareWithKey) : undefined;
    return target ? [{ auditee: c, provided: target }] : [];
  });
  const showEvidence = audit.rowEvidence !== "off";
  const rows = audit.rows.map((r) => {
    const results = pairs.map((p) => verify(r.values, p));
    const hasMismatch = results.some((v) => v.status === "mismatch");
    return { ...r, results, hasMismatch, check: rowEvidence(r, audit, hasMismatch) };
  });

  const rowsWithDiff = rows.filter((r) => r.hasMismatch).length;
  const auditeeCells = rows.length * auditee.length;
  const filledCells = rows.reduce(
    (sum, r) => sum + auditee.filter((c) => r.values[c.key] !== null && r.values[c.key] !== undefined).length,
    0,
  );
  const fillPercent = auditeeCells ? Math.round((filledCells / auditeeCells) * 100) : null;
  const evidenceRows = rows.filter((r) => r.check.status !== "not_required");
  const verifiedRows = evidenceRows.filter((r) => r.check.status === "verified").length;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ResultKpi
          label="Rows audited"
          value={String(rows.length)}
          context={rows.length === 1 ? "1 row from the uploaded data." : `${rows.length} rows from the uploaded data.`}
          info="Every row in the data the manager uploaded."
          accent="purple"
        />
        <ResultKpi
          label="Provided columns"
          value={String(provided.length)}
          context="Columns supplied in the upload, shown read-only to the auditee."
          info="Columns marked Already provided when the audit was created."
          accent="blue"
        />
        <ResultKpi
          label="Rows with differences"
          value={pairs.length ? String(rowsWithDiff) : "N/A"}
          context={
            pairs.length
              ? "Rows where the auditee's value differs from the provided value."
              : "No auditee column was paired with a provided column."
          }
          info="A row counts when any paired column shows Mismatch."
          accent="pink"
        />
        {showEvidence ? (
          <ResultKpi
            label="Evidence verified"
            value={evidenceRows.length ? `${verifiedRows} / ${evidenceRows.length}` : "N/A"}
            context={
              evidenceRows.length
                ? "Rows whose photos passed the in-app checks."
                : "No row needed or had a photo."
            }
            info="Checked in the app: photo present, minimum count, quality and duplicates."
            accent="green"
          />
        ) : (
          <ResultKpi
            label="Auditee columns filled"
            value={fillPercent === null ? "N/A" : `${fillPercent}%`}
            context={
              fillPercent === null
                ? "This audit had no columns for the auditee to fill."
                : `${filledCells} of ${auditeeCells} cells filled by the auditee.`
            }
            info="Share of auditee cells that have a value."
            accent="green"
          />
        )}
      </div>

      <div className="rounded-2xl border border-[#D9E2E8] bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-[#102A43]">Audit items</h3>
            <p className="mt-0.5 text-xs text-[#667085]">
              Every column{audit.filename ? ` from ${audit.filename}` : ""}, with who supplied each value.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#667085]">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: ACCENT_TINT.blue, border: `1px solid ${AISLIX_PALETTE.blue}` }} />
              Already provided
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: ACCENT_TINT.purple, border: `1px solid ${AISLIX_PALETTE.purple}` }} />
              Filled by auditee
            </span>
            {pairs.length ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: AISLIX_PALETTE.grey, border: `1px solid ${AISLIX_PALETTE.border}` }} />
                Calculated by Aislix
              </span>
            ) : null}
          </div>
        </div>

        <div className="mt-3 max-h-[560px] overflow-auto rounded-xl border border-[#D9E2E8]">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="sticky top-0 z-10 text-xs text-[#102A43]">
              <tr>
                <th className="border-b border-[#D9E2E8] bg-white px-3 py-2" />
                {provided.length ? (
                  <th colSpan={provided.length} className="border-b border-[#D9E2E8] px-3 py-2 font-semibold" style={{ background: ACCENT_TINT.blue }}>
                    Already provided
                  </th>
                ) : null}
                {auditee.length ? (
                  <th colSpan={auditee.length} className="border-b border-l border-[#D9E2E8] px-3 py-2 font-semibold" style={{ background: ACCENT_TINT.purple }}>
                    Filled by auditee
                  </th>
                ) : null}
                {pairs.length ? (
                  <th colSpan={pairs.length * 2} className="border-b border-l border-[#D9E2E8] px-3 py-2 font-semibold" style={{ background: AISLIX_PALETTE.grey }}>
                    Calculated by Aislix
                  </th>
                ) : null}
                {showEvidence ? (
                  <th colSpan={2} className="border-b border-l border-[#D9E2E8] px-3 py-2 font-semibold" style={{ background: ACCENT_TINT.green }}>
                    Evidence
                  </th>
                ) : null}
              </tr>
              <tr className="bg-[#F4F7F9] text-left text-[10px] uppercase tracking-wide text-[#667085]">
                <th className="px-3 py-2 font-semibold">#</th>
                {provided.map((c) => (
                  <th key={c.key} className="px-3 py-2 font-semibold">{c.label}</th>
                ))}
                {auditee.map((c, i) => (
                  <th key={c.key} className={cn("px-3 py-2 font-semibold", i === 0 && "border-l border-[#D9E2E8]")}>{c.label}</th>
                ))}
                {pairs.map((p, i) => [
                  <th
                    key={`${p.auditee.key}-diff`}
                    className={cn("px-3 py-2 font-semibold", i === 0 && "border-l border-[#D9E2E8]")}
                    title={`${p.auditee.label} − ${p.provided.label}`}
                  >
                    {pairs.length === 1 ? "Difference" : `Difference (${p.auditee.label})`}
                  </th>,
                  <th key={`${p.auditee.key}-status`} className="px-3 py-2 font-semibold">
                    {pairs.length === 1 ? "Status" : `Status (${p.auditee.label})`}
                  </th>,
                ])}
                {showEvidence ? (
                  <>
                    <th className="border-l border-[#D9E2E8] px-3 py-2 font-semibold">Photos</th>
                    <th className="px-3 py-2 font-semibold">Evidence validation</th>
                  </>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.index} className="border-t border-[#D9E2E8]">
                  <td className="px-3 py-2 tabular-nums text-[#667085]">{row.index + 1}</td>
                  {provided.map((c) => (
                    <td key={c.key} className="px-3 py-2 text-[#102A43]" style={{ background: "#F7FBFD" }}>
                      {row.values[c.key] ?? <span className="text-[#667085]">—</span>}
                    </td>
                  ))}
                  {auditee.map((c, i) => {
                    const value = row.values[c.key];
                    return (
                      <td
                        key={c.key}
                        className={cn("px-3 py-2 text-[#102A43]", i === 0 && "border-l border-[#D9E2E8]")}
                        style={{ background: "#FAF8FE" }}
                      >
                        {value ?? (
                          <span className="inline-block rounded-md px-2 py-0.5 text-[11px] text-[#667085]" style={{ background: AISLIX_PALETTE.grey }}>
                            Not filled
                          </span>
                        )}
                      </td>
                    );
                  })}
                  {pairs.map((p, i) => {
                    const { difference: diff, status } = row.results[i]!;
                    return [
                      <td key={`${p.auditee.key}-diff`} className={cn("px-3 py-2 tabular-nums", i === 0 && "border-l border-[#D9E2E8]")}>
                        {diff === null ? (
                          <span className="text-[#667085]" title="Needs a number in both columns">N/A</span>
                        ) : (
                          <span className="text-[#102A43]">{formatDiff(diff)}</span>
                        )}
                      </td>,
                      <td key={`${p.auditee.key}-status`} className="px-3 py-2">
                        <StatusPill {...PAIR_PILL[status]} />
                      </td>,
                    ];
                  })}
                  {showEvidence ? (
                    <>
                      <td className="border-l border-[#D9E2E8] px-3 py-2">
                        {row.photos.length ? (
                          <div className="flex gap-1">
                            {row.photos.slice(0, 4).map((url) => (
                              <EvidenceImage key={url} stored={url} className="size-8 rounded border border-[#D9E2E8] object-cover" />
                            ))}
                          </div>
                        ) : (
                          <span className="text-[#667085]">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <StatusPill
                          label={EVIDENCE_STATUS_LABEL[row.check.status]}
                          {...EVIDENCE_PILL[row.check.status]}
                          title={row.check.reasons.length ? row.check.reasons.join("\n") : undefined}
                        />
                      </td>
                    </>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-[#667085]">
          {rows.length} row{rows.length === 1 ? "" : "s"}
          {pairs.length ? " · Difference = auditee value − provided value, shown only when both are numbers." : ""}
        </p>
      </div>
    </div>
  );
}
