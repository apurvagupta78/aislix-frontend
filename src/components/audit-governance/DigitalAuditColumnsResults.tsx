import { Info } from "lucide-react";

import { AISLIX_PALETTE, ACCENT_TINT, type AislixAccent } from "@/lib/ai-audit/kpi-palette";
import { numericCell, type DigitalColumnsAudit, type DigitalResultColumn } from "@/lib/new-audit/digital-columns";
import { cn } from "@/lib/utils";

type Pair = { auditee: DigitalResultColumn; provided: DigitalResultColumn };

function difference(row: Record<string, string | null>, pair: Pair): number | null {
  const actual = numericCell(row[pair.auditee.key]);
  const expected = numericCell(row[pair.provided.key]);
  if (actual === null || expected === null) return null;
  return Math.round((actual - expected) * 100) / 100;
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
  const rows = audit.rows;

  const rowsWithDiff = rows.filter((r) => pairs.some((p) => (difference(r.values, p) ?? 0) !== 0)).length;
  const auditeeCells = rows.length * auditee.length;
  const filledCells = rows.reduce(
    (sum, r) => sum + auditee.filter((c) => r.values[c.key] !== null && r.values[c.key] !== undefined).length,
    0,
  );
  const fillPercent = auditeeCells ? Math.round((filledCells / auditeeCells) * 100) : null;

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
          info="Counted only for paired columns where both values are numbers."
          accent="pink"
        />
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
                  <th colSpan={pairs.length} className="border-b border-l border-[#D9E2E8] px-3 py-2 font-semibold" style={{ background: AISLIX_PALETTE.grey }}>
                    Calculated by Aislix
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
                {pairs.map((p, i) => (
                  <th
                    key={p.auditee.key}
                    className={cn("px-3 py-2 font-semibold", i === 0 && "border-l border-[#D9E2E8]")}
                    title={`${p.auditee.label} − ${p.provided.label}`}
                  >
                    {pairs.length === 1 ? "Difference" : `Difference (${p.auditee.label})`}
                  </th>
                ))}
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
                    const diff = difference(row.values, p);
                    return (
                      <td key={p.auditee.key} className={cn("px-3 py-2 tabular-nums", i === 0 && "border-l border-[#D9E2E8]")}>
                        {diff === null ? (
                          <span className="text-[#667085]" title="Needs a number in both columns">N/A</span>
                        ) : diff === 0 ? (
                          <span className="text-[#102A43]">0</span>
                        ) : (
                          <span className="inline-block rounded-md px-2 py-0.5 font-medium text-[#102A43]" style={{ background: AISLIX_PALETTE.pink }}>
                            {formatDiff(diff)}
                          </span>
                        )}
                      </td>
                    );
                  })}
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
