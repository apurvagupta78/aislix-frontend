import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ClassificationBadge, SeverityBadge } from "@/components/expiry-control/SeverityBadge";
import {
  checkReconciliation,
  expiryTransition,
  fetchAttempt,
  fetchObservations,
  type ExpiryInspectionAttempt,
} from "@/lib/expiry-control";

export function ReviewPanel({ attemptId }: { attemptId: string }) {
  const qc = useQueryClient();
  const attemptQuery = useQuery({ queryKey: ["expiry-attempt", attemptId], queryFn: () => fetchAttempt(attemptId) });
  const obsQuery = useQuery({ queryKey: ["expiry-observations", attemptId], queryFn: () => fetchObservations(attemptId) });

  const verifyMutation = useMutation({
    mutationFn: () => expiryTransition({ entityType: "attempt", entityId: attemptId, action: "verify_inspection" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expiry-review"] }),
  });

  const attempt = attemptQuery.data;
  const observations = obsQuery.data ?? [];
  const reconcile = attempt
    ? checkReconciliation({
        physicalCount: attempt.physical_count,
        sellable: attempt.sellable_count,
        remove: attempt.remove_count,
        unresolved: attempt.unresolved_count,
        observationsRecorded: attempt.observations_count,
      })
    : null;

  if (!attempt) return null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3 rounded-2xl border p-4">
        <h3 className="font-semibold">Inspection scope</h3>
        <p className="text-sm text-muted-foreground">SKU: {attempt.sku}</p>
        <p className="text-sm">Expected {attempt.expected_quantity} · Actual {attempt.actual_quantity ?? "—"}</p>
        <p className="text-xs text-muted-foreground">{attempt.coverage_statement ?? "Partial coverage — not store-wide."}</p>
        {reconcile ? (
          <p className={`text-sm ${reconcile.ok ? "text-emerald-700" : "text-destructive"}`}>{reconcile.equation}</p>
        ) : null}
        <div className="space-y-2">
          {observations.map((o) => (
            <div key={o.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
              <span>Packet {o.packet_ordinal}</span>
              <div className="flex items-center gap-2">
                <ClassificationBadge value={o.classification} />
                {o.duplicate_hash_flag ? <SeverityBadge severity="medium" /> : null}
                {o.ai_simulated ? <span className="text-xs text-amber-700">Simulated OCR</span> : null}
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => verifyMutation.mutate()} disabled={verifyMutation.isPending}>
            Verify inspection
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              observations[0] &&
              expiryTransition({ entityType: "observation", entityId: observations[0].id, action: "request_retake" })
            }
          >
            Request retake
          </Button>
        </div>
        {verifyMutation.isError ? (
          <p className="text-sm text-destructive">{(verifyMutation.error as Error).message}</p>
        ) : null}
      </div>
      <div className="rounded-2xl border bg-muted/20 p-4">
        <h3 className="font-semibold">Evidence</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Select a packet to view full-size evidence, AI reading, and metadata. Signed URLs require server authorization.
        </p>
        <AttemptSummary attempt={attempt} />
      </div>
    </div>
  );
}

function AttemptSummary({ attempt }: { attempt: ExpiryInspectionAttempt }) {
  return (
    <dl className="mt-4 space-y-2 text-sm">
      <div className="flex justify-between">
        <dt className="text-muted-foreground">Inspection</dt>
        <dd>{attempt.inspection_status}</dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-muted-foreground">Removal</dt>
        <dd>{attempt.removal_status}</dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-muted-foreground">Disposition</dt>
        <dd>{attempt.disposition_status}</dd>
      </div>
    </dl>
  );
}
