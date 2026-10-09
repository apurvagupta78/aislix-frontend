import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AiPill } from "@/components/ai-audit/results/AiLocationSections";
import { supabase } from "@/integrations/supabase/client";
import type { NormalizedAstraAnalysis } from "@/lib/ai-audit/astra-response";
import {
  listScanFieldVerifications,
  saveRowVerifications,
  verificationMap,
  verifiedFieldValue,
  type FieldVerification,
  type VerificationChange,
  type VerificationFieldKey,
} from "@/lib/ai-audit/field-verifications";
import { AISLIX_PALETTE } from "@/lib/ai-audit/kpi-palette";
import { downloadSectionCsv } from "@/lib/ai-audit/section-csv";
import {
  RESULT_LABEL,
  VERIFY_FIELDS,
  aiAgrees,
  buildVerificationRows,
  fieldResult,
  formatFieldValue,
  verificationCsv,
  type FieldResult,
  type FieldValue,
  type InventoryRowLike,
  type VerificationRow,
} from "@/lib/ai-audit/verification-rows";
import { networkErrorMessage } from "@/lib/api-errors";
import { cn } from "@/lib/utils";

type Props = {
  scanId: string;
  analysis: NormalizedAstraAnalysis;
  inventory: InventoryRowLike[];
  canEdit?: boolean;
};

const INITIAL_ROWS = 25;

const RESULT_TONE: Record<FieldResult, "green" | "pink" | "blue" | "grey"> = {
  match: "green",
  mismatch: "pink",
  below: "pink",
  above: "blue",
  not_visible: "grey",
  na: "grey",
};

function ResultPill({ result }: { result: FieldResult }) {
  return <AiPill tone={RESULT_TONE[result]}>{RESULT_LABEL[result]}</AiPill>;
}

/**
 * Location / price / promotion check plus inline human verification of every AI field.
 * AI values stay unchanged; verified values feed corrective actions (manager approval).
 */
export function AiFieldVerificationPanel({ scanId, analysis, inventory, canEdit = true }: Props) {
  const queryClient = useQueryClient();
  const [showAll, setShowAll] = useState(false);
  const [openRow, setOpenRow] = useState<string | null>(null);
  const rows = useMemo(() => buildVerificationRows(analysis, inventory), [analysis, inventory]);
  const query = useQuery({
    queryKey: ["scan-field-verifications", scanId],
    queryFn: () => listScanFieldVerifications(scanId),
    enabled: Boolean(scanId),
  });
  const map = useMemo(() => verificationMap(query.data ?? []), [query.data]);

  const mutation = useMutation({
    mutationFn: saveRowVerifications,
    onSuccess: () => {
      toast.success("Verification saved. Any AI issue it disproves goes to the manager for approval.");
      void queryClient.invalidateQueries({ queryKey: ["scan-field-verifications", scanId] });
      void queryClient.invalidateQueries({ queryKey: ["corrective-actions"] });
    },
    onError: (error) => toast.error(networkErrorMessage(error, "Could not save verification.")),
  });

  if (!rows.length) return null;

  const verifiedOf = (row: VerificationRow, key: VerificationFieldKey): FieldValue =>
    verifiedFieldValue(map.get(`${row.rowKey}:${key}`));
  const verifiedCount = (query.data ?? []).filter((v) => verifiedFieldValue(v) != null).length;
  const visible = showAll ? rows : rows.slice(0, INITIAL_ROWS);
  const save = (row: VerificationRow, changes: VerificationChange[]) =>
    mutation.mutate({
      scanId,
      rowKey: row.rowKey,
      detectedProductId: row.detectedProductId,
      identity: row.identity,
      changes,
    });

  const downloadCsv = async () => {
    const ids = [...new Set((query.data ?? []).map((v) => v.verified_by).filter((id): id is string => Boolean(id)))];
    const names = new Map<string, string>();
    if (ids.length) {
      const { data } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
      for (const p of data ?? []) names.set(p.id, p.full_name || p.email || p.id);
    }
    const csv = verificationCsv(rows, map, names);
    downloadSectionCsv(scanId, "human-verification", csv.headers, csv.data);
  };

  return (
    <>
      <FieldCheckSummary rows={rows} verifiedOf={verifiedOf} />
      <div className="mt-6 rounded-xl border border-[#D9E2E8] bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-[#04203F]">Human verification</h3>
            <p className="text-xs tabular-nums text-[#667085]">
              {rows.length} product{rows.length === 1 ? "" : "s"} · {verifiedCount} field
              {verifiedCount === 1 ? "" : "s"} human confirmed
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={() => void downloadCsv()}>
            <Download className="size-3.5" /> Download CSV
          </Button>
        </div>
        <p className="mt-2 text-sm text-[#667085]">
          Check each product on the shelf. Enter what you see when it differs from the AI; leave a box empty
          to keep the AI value. If your check disproves an AI issue, its corrective action moves to
          “Resolved by verification” and waits for manager approval.
          {!canEdit ? " This audit is submitted, so verifications are read-only." : ""}
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-[#D9E2E8] text-xs text-[#667085]">
                <th className="py-2 pr-3 font-medium">Product</th>
                <th className="py-2 pr-3 font-medium">Expected facings</th>
                <th className="py-2 pr-3 font-medium">AI facings</th>
                <th className="py-2 pr-3 font-medium">Verified facings</th>
                <th className="py-2 pr-3 font-medium">Location · price · promotion</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const open = openRow === row.rowKey;
                const fieldsVerified = VERIFY_FIELDS.filter((f) => verifiedOf(row, f.key) != null).length;
                return (
                  <Fragment key={row.rowKey}>
                    <tr className="border-b border-[#EEF1F4] align-top">
                      <td className="py-2 pr-3">
                        <p className="font-medium text-[#04203F]">{row.label}</p>
                        <p className="text-xs text-[#667085]">
                          {row.planned ? (row.ai.present === 0 ? "Planned · AI did not find it" : "Planned") : "Not in plan"}
                          {fieldsVerified ? ` · ${fieldsVerified} verified` : ""}
                        </p>
                      </td>
                      <td className="py-2 pr-3 tabular-nums text-[#667085]">{row.expected.facings ?? "N/A"}</td>
                      <td className="py-2 pr-3 tabular-nums text-[#667085]">{row.ai.facings ?? "N/A"}</td>
                      <td className="py-2 pr-3">
                        <VerifyInput
                          kind="number"
                          canEdit={canEdit}
                          value={verifiedOf(row, "facings")}
                          saving={mutation.isPending && mutation.variables?.rowKey === row.rowKey}
                          onSave={(value) =>
                            save(row, [{ fieldKey: "facings", aiValue: row.ai.facings, verifiedValue: value }])
                          }
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <div className="flex flex-wrap gap-1">
                          {(["location", "price", "promotion"] as const).map((key) => {
                            const result = fieldResult(row, key, verifiedOf(row, key));
                            return result === "na" ? null : (
                              <AiPill key={key} tone={RESULT_TONE[result]}>
                                {key === "location" ? "Location" : key === "price" ? "Price" : "Promo"}: {RESULT_LABEL[result]}
                              </AiPill>
                            );
                          })}
                        </div>
                      </td>
                      <td className="py-2 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 rounded-lg text-xs"
                          aria-expanded={open}
                          onClick={() => setOpenRow(open ? null : row.rowKey)}
                        >
                          {canEdit ? "Verify all fields" : "All fields"}
                          <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
                        </Button>
                      </td>
                    </tr>
                    {open ? (
                      <tr className="border-b border-[#EEF1F4]">
                        <td colSpan={6} className="bg-[#F4F7F9] p-3">
                          <RowEditor
                            row={row}
                            verifications={map}
                            canEdit={canEdit}
                            saving={mutation.isPending && mutation.variables?.rowKey === row.rowKey}
                            onSave={(changes) => save(row, changes)}
                          />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        {rows.length > INITIAL_ROWS ? (
          <Button type="button" variant="ghost" size="sm" className="mt-3" onClick={() => setShowAll((v) => !v)}>
            {showAll ? `Show first ${INITIAL_ROWS}` : `Show all ${rows.length} products`}
          </Button>
        ) : null}
      </div>
    </>
  );
}

function RowEditor({
  row,
  verifications,
  canEdit,
  saving,
  onSave,
}: {
  row: VerificationRow;
  verifications: Map<string, FieldVerification>;
  canEdit: boolean;
  saving: boolean;
  onSave: (changes: VerificationChange[]) => void;
}) {
  const saved = useMemo(() => {
    const out = {} as Record<VerificationFieldKey, string>;
    for (const f of VERIFY_FIELDS) {
      const v = verifiedFieldValue(verifications.get(`${row.rowKey}:${f.key}`));
      out[f.key] = v == null ? "" : String(v);
    }
    return out;
  }, [row.rowKey, verifications]);
  const [draft, setDraft] = useState(saved);
  useEffect(() => setDraft(saved), [saved]);

  const parse = (key: VerificationFieldKey, text: string): FieldValue => {
    const t = text.trim();
    if (!t) return null;
    const kind = VERIFY_FIELDS.find((f) => f.key === key)!.kind;
    return kind === "text" ? t : Number(t);
  };
  const invalid = VERIFY_FIELDS.some((f) => {
    if (f.kind === "text") return false;
    const v = parse(f.key, draft[f.key]);
    return v != null && (!Number.isFinite(v) || Number(v) < 0);
  });
  const changes: VerificationChange[] = VERIFY_FIELDS.filter((f) => draft[f.key].trim() !== saved[f.key].trim()).map(
    (f) => ({ fieldKey: f.key, aiValue: row.ai[f.key], verifiedValue: parse(f.key, draft[f.key]) }),
  );

  return (
    <div>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="text-xs text-[#667085]">
            <th className="py-1.5 pr-3 font-medium">Field</th>
            <th className="py-1.5 pr-3 font-medium">Expected (plan)</th>
            <th className="py-1.5 pr-3 font-medium">AI detected</th>
            <th className="py-1.5 pr-3 font-medium">Verified by you</th>
            <th className="py-1.5 font-medium">Result</th>
          </tr>
        </thead>
        <tbody>
          {VERIFY_FIELDS.map((f) => {
            const verified = parse(f.key, saved[f.key]);
            const agrees = aiAgrees(f.key, row.ai[f.key], verified);
            return (
              <tr key={f.key} className="border-t border-[#D9E2E8]">
                <td className="py-1.5 pr-3 font-medium text-[#04203F]">{f.label}</td>
                <td className="py-1.5 pr-3 text-[#667085]">{formatFieldValue(f.key, row.expected[f.key]) || "N/A"}</td>
                <td className="py-1.5 pr-3 text-[#04203F]">
                  {formatFieldValue(f.key, row.ai[f.key]) || <span className="text-[#667085]">Not detected</span>}
                  {agrees === false ? (
                    <span className="ml-1.5 text-xs text-[#667085]">(corrected)</span>
                  ) : agrees ? (
                    <CheckCircle2 className="ml-1.5 inline size-3.5 text-[#79E2A8]" aria-label="Human confirmed" />
                  ) : null}
                </td>
                <td className="py-1.5 pr-3">
                  {!canEdit ? (
                    <span className="text-[#04203F]">{formatFieldValue(f.key, verified) || "—"}</span>
                  ) : f.kind === "bool" ? (
                    <select
                      className="h-8 rounded-lg border border-[#D9E2E8] bg-white px-2 text-sm"
                      value={draft[f.key]}
                      onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                    >
                      <option value="">Keep AI value</option>
                      <option value="1">Yes, on shelf</option>
                      <option value="0">No, not on shelf</option>
                    </select>
                  ) : (
                    <Input
                      type={f.kind === "number" ? "number" : "text"}
                      min={f.kind === "number" ? 0 : undefined}
                      inputMode={f.kind === "number" ? "decimal" : undefined}
                      className="h-8 w-44 rounded-lg bg-white"
                      placeholder={formatFieldValue(f.key, row.ai[f.key]) || "Enter what you see"}
                      value={draft[f.key]}
                      onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                    />
                  )}
                </td>
                <td className="py-1.5">
                  <ResultPill result={fieldResult(row, f.key, verified)} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {canEdit ? (
        <div className="mt-3 flex items-center justify-end gap-2">
          {invalid ? <span className="text-xs text-[#667085]">Numbers must be 0 or more.</span> : null}
          <Button
            type="button"
            size="sm"
            className="rounded-lg bg-[#04203F] text-white hover:bg-[#04203F]/90"
            disabled={saving || invalid || !changes.length}
            onClick={() => onSave(changes)}
          >
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : changes.length ? `Save ${changes.length} verification${changes.length === 1 ? "" : "s"}` : "Save verifications"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function VerifyInput({
  value,
  kind,
  canEdit,
  saving,
  onSave,
}: {
  value: FieldValue;
  kind: "number";
  canEdit: boolean;
  saving: boolean;
  onSave: (v: number | null) => void;
}) {
  const [draft, setDraft] = useState(value != null ? String(value) : "");
  useEffect(() => setDraft(value != null ? String(value) : ""), [value]);
  if (!canEdit) {
    return (
      <span className="inline-flex items-center gap-1 text-[#04203F]">
        {value != null ? <CheckCircle2 className="size-3.5 text-[#79E2A8]" /> : null}
        {value ?? "—"}
      </span>
    );
  }
  const trimmed = draft.trim();
  const parsed = trimmed === "" ? null : Number(trimmed);
  const invalid = parsed != null && (!Number.isFinite(parsed) || parsed < 0);
  const unchanged = parsed === (value == null ? null : Number(value));
  return (
    <div className="flex items-center gap-2">
      <Input
        type={kind}
        min={0}
        inputMode="numeric"
        aria-invalid={invalid}
        className="h-8 w-20 rounded-lg"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 rounded-lg"
        disabled={saving || invalid || unchanged}
        title={invalid ? "Enter 0 or more" : undefined}
        onClick={() => onSave(parsed)}
      >
        {saving ? <Loader2 className="size-3.5 animate-spin" /> : "Save"}
      </Button>
      {value != null && unchanged ? <CheckCircle2 className="size-3.5 text-[#79E2A8]" aria-label="Human confirmed" /> : null}
    </div>
  );
}

const CHECK_FIELDS: Array<{ key: VerificationFieldKey; title: string; question: string }> = [
  { key: "location", title: "Location", question: "Was the planned location label read on the shelf?" },
  { key: "price", title: "Price", question: "Does the shelf price match the plan?" },
  { key: "promotion", title: "Promotion", question: "Is the planned offer on the shelf?" },
];

/** Plan vs AI detected (or human verified) for location, price and promotion. */
function FieldCheckSummary({
  rows,
  verifiedOf,
}: {
  rows: VerificationRow[];
  verifiedOf: (row: VerificationRow, key: VerificationFieldKey) => FieldValue;
}) {
  const anyPlan = rows.some((r) => r.planned);
  return (
    <div className="mt-6 rounded-xl border border-[#D9E2E8] bg-white p-4">
      <h3 className="text-sm font-semibold text-[#04203F]">Location, price and promotion check</h3>
      <p className="mt-1 text-sm text-[#667085]">
        {anyPlan
          ? "What the planogram or document expected vs what the AI read from the photo. Only labels, prices and offers printed in the photo count as read."
          : "No planogram for this audit — showing what the AI could read from the photo."}
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {CHECK_FIELDS.map(({ key, title, question }) => {
          const results = rows.map((row) => ({ row, verified: verifiedOf(row, key), result: fieldResult(row, key, verifiedOf(row, key)) }));
          const planned = results.filter((r) => r.result !== "na");
          const tally = (result: FieldResult) => planned.filter((r) => r.result === result).length;
          const read = rows.filter((r) => r.ai[key] != null && r.ai[key] !== "").length;
          const issues = planned.filter((r) => r.result === "mismatch" || r.result === "not_visible").slice(0, 4);
          const dot =
            !planned.length ? AISLIX_PALETTE.grey : tally("mismatch") ? "#ECBDCC" : tally("not_visible") ? AISLIX_PALETTE.grey : AISLIX_PALETTE.green;
          return (
            <div key={key} className="rounded-lg border border-[#D9E2E8] bg-white p-3">
              <div className="flex items-center gap-2">
                <span className="size-1.5 rounded-full" style={{ background: dot }} aria-hidden />
                <p className="text-sm font-medium text-[#04203F]">{title}</p>
              </div>
              {planned.length ? (
                <>
                  <p className="mt-1 text-xs text-[#667085]">{question}</p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums text-[#04203F]">
                    {tally("match")}
                    <span className="text-sm font-normal text-[#667085]"> of {planned.length} match</span>
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {tally("mismatch") ? <AiPill tone="pink">{tally("mismatch")} different</AiPill> : null}
                    {tally("not_visible") ? <AiPill tone="grey">{tally("not_visible")} not visible in photo</AiPill> : null}
                  </div>
                  {issues.length ? (
                    <ul className="mt-3 space-y-1.5 text-xs">
                      {issues.map(({ row, verified, result }) => (
                        <li key={row.rowKey} className="text-[#667085]">
                          <span className="font-medium text-[#04203F]">{row.label}</span>
                          <br />
                          Plan {formatFieldValue(key, row.expected[key]) || "—"} ·{" "}
                          {verified != null ? "Verified" : "AI read"}{" "}
                          {formatFieldValue(key, verified ?? row.ai[key]) || (result === "not_visible" ? "nothing" : "—")}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </>
              ) : (
                <>
                  <p className="mt-1 text-xs text-[#667085]">Not in the plan for this audit.</p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums text-[#04203F]">
                    {read}
                    <span className="text-sm font-normal text-[#667085]"> of {rows.length} read from photo</span>
                  </p>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
