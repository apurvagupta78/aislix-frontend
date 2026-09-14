import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, Skeleton } from "@/components/States";
import { expiryTransition, fetchQuarantineTransfers } from "@/lib/expiry-control";
import { useState } from "react";

export const Route = createFileRoute("/expiry-control/quarantine")({
  head: () => ({ meta: [{ title: "Quarantine & Disposition — Expiry Control" }] }),
  component: QuarantinePage,
});

function QuarantinePage() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["expiry-quarantine"], queryFn: fetchQuarantineTransfers, retry: false });
  const [receiveQty, setReceiveQty] = useState<Record<string, string>>({});

  const receiptMutation = useMutation({
    mutationFn: ({ transferId, qty }: { transferId: string; qty: number }) =>
      expiryTransition({
        entityType: "transfer",
        entityId: transferId,
        action: "confirm_receipt",
        payload: { received_quantity: qty },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expiry-quarantine"] }),
  });

  const mismatchMutation = useMutation({
    mutationFn: (transferId: string) =>
      expiryTransition({
        entityType: "transfer",
        entityId: transferId,
        action: "report_mismatch",
        payload: { received_quantity: 0, mismatch_quantity: 1, mismatch_reason: "Quantity mismatch on receipt" },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expiry-quarantine"] }),
  });

  return (
    <AppShell
      title="Quarantine & Disposition"
      description="Confirm receipt, report mismatches, and track return/disposal. No return-to-shelf for expired stock."
    >
      {query.isLoading && <Skeleton className="h-48" />}
      {query.data?.length === 0 && (
        <EmptyState title="No quarantine transfers" description="Removed stock transfers appear here after auditor submission." />
      )}
      <div className="space-y-3">
        {(query.data ?? []).map((t) => (
          <div key={t.id} className="rounded-2xl border p-4 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium">{t.sku} × {t.quantity}</p>
                <p className="text-muted-foreground">
                  {t.container_code ?? "—"} · {t.quarantine_location ?? "—"} · {t.removal_reason}
                </p>
                <p className="text-xs">Status: {t.transfer_status}</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  className="w-24"
                  placeholder="Qty"
                  value={receiveQty[t.id] ?? String(t.quantity)}
                  onChange={(e) => setReceiveQty({ ...receiveQty, [t.id]: e.target.value })}
                />
                <Button
                  size="sm"
                  onClick={() =>
                    receiptMutation.mutate({ transferId: t.id, qty: Number(receiveQty[t.id] ?? t.quantity) })
                  }
                  disabled={t.transfer_status !== "reported"}
                >
                  Confirm receipt
                </Button>
                <Button size="sm" variant="outline" onClick={() => mismatchMutation.mutate(t.id)}>
                  Report mismatch
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    expiryTransition({ entityType: "transfer", entityId: t.id, action: "verify_removal" })
                  }
                >
                  Verify removal
                </Button>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              POS non-saleable marking: not configured — pending integration.
            </p>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
