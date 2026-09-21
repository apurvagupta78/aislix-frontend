import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
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

/**
 * Inline AI vs human verification for facings and visible units.
 * AI values stay visible; verified values become operational actuals.
 */
export function AiFieldVerificationPanel({ scanId, products, canEdit = true }: Props) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["scan-field-verifications", scanId],
    queryFn: () => listScanFieldVerifications(scanId),
    enabled: Boolean(scanId),
  });

  const map = verificationMap(query.data ?? []);
  const mutation = useMutation({
    mutationFn: upsertFieldVerification,
    onSuccess: () => {
      toast.success("Verification saved.");
      void queryClient.invalidateQueries({ queryKey: ["scan-field-verifications", scanId] });
    },
    onError: (error) => {
      toast.error(networkErrorMessage(error, "Could not save verification."));
    },
  });

  if (!products.length) return null;

  return (
    <div className="mt-6 rounded-xl border border-[#D9E2E8] bg-white p-4">
      <h3 className="text-sm font-semibold text-[#102A43]">Human verification</h3>
      <p className="mt-1 text-sm text-[#667085]">
        AI values stay unchanged. Enter the physically verified count when it differs.
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
            {products.slice(0, 40).map((p, index) => {
              const productId = p.id ?? `row-${index}`;
              const aiFacings = p.facings ?? null;
              const aiUnits = p.visible_units ?? p.quantity ?? null;
              const facingKey = `${productId}:facings`;
              const unitKey = `${productId}:visible_units`;
              const facingV = map.get(facingKey);
              const unitV = map.get(unitKey);
              const opsFacings = operationalActual(aiFacings, facingV?.verified_value);
              const opsUnits = operationalActual(aiUnits, unitV?.verified_value);
              const label = [p.brand, p.product ?? p.name].filter(Boolean).join(" · ") || "Product";

              return (
                <tr key={productId} className="border-b border-[#EEF1F4]">
                  <td className="py-2 pr-3 font-medium text-[#102A43]">{label}</td>
                  <td className="py-2 pr-3 text-[#667085]">{aiFacings ?? "—"}</td>
                  <td className="py-2 pr-3">
                    <VerifyCell
                      canEdit={canEdit}
                      value={facingV?.verified_value ?? null}
                      saving={mutation.isPending}
                      onSave={(verifiedValue) =>
                        mutation.mutate({
                          scanId,
                          detectedProductId: p.id ?? null,
                          fieldKey: "facings" satisfies VerificationFieldKey,
                          aiValue: aiFacings,
                          verifiedValue,
                        })
                      }
                    />
                  </td>
                  <td className="py-2 pr-3 text-[#667085]">{aiUnits ?? "—"}</td>
                  <td className="py-2 pr-3">
                    <VerifyCell
                      canEdit={canEdit}
                      value={unitV?.verified_value ?? null}
                      saving={mutation.isPending}
                      onSave={(verifiedValue) =>
                        mutation.mutate({
                          scanId,
                          detectedProductId: p.id ?? null,
                          fieldKey: "visible_units",
                          aiValue: aiUnits,
                          verifiedValue,
                        })
                      }
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
    return <span className="text-[#102A43]">{value ?? "—"}</span>;
  }
  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        min={0}
        className="h-8 w-20 rounded-lg"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 rounded-lg"
        disabled={saving}
        onClick={() => {
          const trimmed = draft.trim();
          onSave(trimmed === "" ? null : Number(trimmed));
        }}
      >
        Save
      </Button>
    </div>
  );
}
