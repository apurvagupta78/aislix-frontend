import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  listScanFieldVerifications,
  operationalActual,
  upsertFieldVerification,
  verificationMap,
  type VerificationFieldKey,
} from "@/lib/ai-audit/field-verifications";
import { networkErrorMessage } from "@/lib/api-errors";

type ProductRow = {
  id?: string;
  brand?: string;
  product?: string;
  name?: string;
  facings?: number | null;
  quantity?: number | null;
  visible_units?: number | null;
};

type Props = {
  scanId: string;
  products: ProductRow[];
  canEdit?: boolean;
};

const INITIAL_ROWS = 25;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Inline AI vs human verification for facings and visible units.
 * AI values stay visible; verified values become operational actuals.
 */
export function AiFieldVerificationPanel({ scanId, products, canEdit = true }: Props) {
  const queryClient = useQueryClient();
  const [showAll, setShowAll] = useState(false);
  const query = useQuery({
    queryKey: ["scan-field-verifications", scanId],
    queryFn: () => listScanFieldVerifications(scanId),
    enabled: Boolean(scanId),
  });

  const map = verificationMap(query.data ?? []);
  const mutation = useMutation({
    mutationFn: upsertFieldVerification,
    onSuccess: (_data, input) => {
      toast.success(input.verifiedValue == null ? "Verification cleared." : "Verification saved.");
      void queryClient.invalidateQueries({ queryKey: ["scan-field-verifications", scanId] });
    },
    onError: (error) => {
      toast.error(networkErrorMessage(error, "Could not save verification."));
    },
  });
  const savingKey = mutation.isPending && mutation.variables
    ? `${mutation.variables.detectedProductId}:${mutation.variables.fieldKey}`
    : null;

  if (!products.length) return null;

  const verifiedCount = (query.data ?? []).filter((v) => v.verified_value != null).length;
  const rows = showAll ? products : products.slice(0, INITIAL_ROWS);

  return (
    <div className="mt-6 rounded-xl border border-[#D9E2E8] bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-[#102A43]">Human verification</h3>
        <span className="text-xs tabular-nums text-[#667085]">
          {products.length} product{products.length === 1 ? "" : "s"} · {verifiedCount} field
          {verifiedCount === 1 ? "" : "s"} human confirmed
        </span>
      </div>
      <p className="mt-1 text-sm text-[#667085]">
        AI values stay unchanged. Enter the physically verified count when it differs; clear the
        box and save to fall back to the AI value.
        {!canEdit ? " This audit is submitted, so verifications are read-only." : ""}
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-[#D9E2E8] text-xs uppercase text-[#667085]">
              <th className="py-2 pr-3 font-medium">Product</th>
              <th className="py-2 pr-3 font-medium">AI facings</th>
              <th className="py-2 pr-3 font-medium">Verified facings</th>
              <th className="py-2 pr-3 font-medium">AI units</th>
              <th className="py-2 pr-3 font-medium">Verified units</th>
              <th className="py-2 font-medium">Ops actual</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p, index) => {
              const persistedId = p.id && UUID_RE.test(p.id) ? p.id : null;
              const rowKey = persistedId ?? `row-${index}`;
              const aiFacings = p.facings ?? null;
              const aiUnits = p.visible_units ?? p.quantity ?? null;
              const facingV = persistedId ? map.get(`${persistedId}:facings`) : undefined;
              const unitV = persistedId ? map.get(`${persistedId}:visible_units`) : undefined;
              const opsFacings = operationalActual(aiFacings, facingV?.verified_value);
              const opsUnits = operationalActual(aiUnits, unitV?.verified_value);
              const label = [p.brand, p.product ?? p.name].filter(Boolean).join(" · ") || "Product";
              const editable = canEdit && Boolean(persistedId);
              const save = (fieldKey: VerificationFieldKey, aiValue: number | null) =>
                (verifiedValue: number | null) =>
                  mutation.mutate({
                    scanId,
                    detectedProductId: persistedId,
                    fieldKey,
                    aiValue,
                    verifiedValue,
                  });

              return (
                <tr key={rowKey} className="border-b border-[#EEF1F4]">
                  <td className="py-2 pr-3 font-medium text-[#102A43]">
                    {label}
                    {canEdit && !persistedId ? (
                      <span className="block text-xs font-normal text-[#667085]">
                        Not linked to a detected product — cannot verify
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2 pr-3 text-[#667085]">{aiFacings ?? "N/A"}</td>
                  <td className="py-2 pr-3">
                    <VerifyCell
                      canEdit={editable}
                      value={facingV?.verified_value ?? null}
                      saving={savingKey === `${persistedId}:facings`}
                      onSave={save("facings", aiFacings)}
                    />
                  </td>
                  <td className="py-2 pr-3 text-[#667085]">{aiUnits ?? "N/A"}</td>
                  <td className="py-2 pr-3">
                    <VerifyCell
                      canEdit={editable}
                      value={unitV?.verified_value ?? null}
                      saving={savingKey === `${persistedId}:visible_units`}
                      onSave={save("visible_units", aiUnits)}
                    />
                  </td>
                  <td className="py-2 text-[#102A43]">
                    F {opsFacings ?? "N/A"} · U {opsUnits ?? "N/A"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {products.length > INITIAL_ROWS ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-3"
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll ? `Show first ${INITIAL_ROWS}` : `Show all ${products.length} products`}
        </Button>
      ) : null}
    </div>
  );
}

function VerifyCell({
  value,
  canEdit,
  saving,
  onSave,
}: {
  value: number | null;
  canEdit: boolean;
  saving: boolean;
  onSave: (v: number | null) => void;
}) {
  const [draft, setDraft] = useState(value != null ? String(value) : "");
  useEffect(() => {
    setDraft(value != null ? String(value) : "");
  }, [value]);
  if (!canEdit) {
    return (
      <span className="inline-flex items-center gap-1 text-[#102A43]">
        {value != null ? <CheckCircle2 className="size-3.5 text-[#79E2A8]" /> : null}
        {value ?? "—"}
      </span>
    );
  }
  const trimmed = draft.trim();
  const parsed = trimmed === "" ? null : Number(trimmed);
  const invalid = parsed != null && (!Number.isFinite(parsed) || parsed < 0);
  const unchanged = parsed === value;
  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        min={0}
        inputMode="numeric"
        aria-invalid={invalid}
        className={`h-8 w-20 rounded-lg ${invalid ? "border-destructive" : ""}`}
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
      {value != null && unchanged ? (
        <CheckCircle2 className="size-3.5 text-[#79E2A8]" aria-label="Human confirmed" />
      ) : null}
    </div>
  );
}
