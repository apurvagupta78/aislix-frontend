import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ClassificationBadge, SeverityBadge } from "@/components/expiry-control/SeverityBadge";
import { SessionVideoReview } from "@/components/expiry-control/SessionVideoReview";
import {
  checkReconciliation,
  expiryTransition,
  fetchAttempt,
  fetchAttemptEvidence,
  fetchObservations,
  type ExpiryInspectionAttempt,
  type ExpiryPacketObservation,
} from "@/lib/expiry-control";

export function ReviewPanel({ attemptId }: { attemptId: string }) {
  const qc = useQueryClient();
  const [selectedObsId, setSelectedObsId] = useState<string | null>(null);

  const attemptQuery = useQuery({ queryKey: ["expiry-attempt", attemptId], queryFn: () => fetchAttempt(attemptId) });
  const obsQuery = useQuery({ queryKey: ["expiry-observations", attemptId], queryFn: () => fetchObservations(attemptId) });
  const evidenceQuery = useQuery({
    queryKey: ["expiry-evidence", attemptId],
    queryFn: () => fetchAttemptEvidence(attemptId),
    retry: false,
  });

  const verifyMutation = useMutation({
    mutationFn: () => expiryTransition({ entityType: "attempt", entityId: attemptId, action: "verify_inspection" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expiry-review"] }),
  });

  const attempt = attemptQuery.data;
  const observations = obsQuery.data ?? [];
  const evidence = evidenceQuery.data;

  const selectedObs = observations.find((o) => o.id === selectedObsId) ?? observations[0] ?? null;
  const selectedPhoto = useMemo(() => {
    if (!selectedObs || !evidence) return null;
    return (
      evidence.packetPhotos.find((p) => p.observationId === selectedObs.id) ??
      evidence.packetPhotos.find((p) => p.packetOrdinal === selectedObs.packet_ordinal) ??
      null
    );
  }, [selectedObs, evidence]);

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
            <ObservationRow
              key={o.id}
              observation={o}
              selected={selectedObs?.id === o.id}
              onSelect={() => setSelectedObsId(o.id)}
            />
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
      <div className="space-y-4 rounded-2xl border bg-muted/20 p-4">
        <h3 className="font-semibold">Evidence</h3>
        {evidenceQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading evidence…</p> : null}
        {evidence ? <SessionVideoReview evidence={evidence} /> : null}
        {selectedObs ? (
          <PacketEvidenceDetail observation={selectedObs} photoUrl={selectedPhoto?.asset.signedUrl ?? null} />
        ) : (
          <p className="text-sm text-muted-foreground">Select a packet to view close-up evidence and dates.</p>
        )}
        <AttemptSummary attempt={attempt} />
      </div>
    </div>
  );
}

function ObservationRow({
  observation,
  selected,
  onSelect,
}: {
  observation: ExpiryPacketObservation;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
        selected ? "border-brand bg-brand-soft/40" : "hover:bg-muted/40"
      }`}
    >
      <span>Packet {observation.packet_ordinal}</span>
      <div className="flex items-center gap-2">
        <ClassificationBadge value={observation.classification} />
        {observation.duplicate_hash_flag ? <SeverityBadge severity="medium" /> : null}
        {observation.ai_simulated ? <span className="text-xs text-amber-700">Simulated OCR</span> : null}
      </div>
    </button>
  );
}

function PacketEvidenceDetail({
  observation,
  photoUrl,
}: {
  observation: ExpiryPacketObservation;
  photoUrl: string | null;
}) {
  return (
    <div className="space-y-2 rounded-xl border bg-background p-3">
      <p className="text-sm font-medium">Packet {observation.packet_ordinal}</p>
      {photoUrl ? (
        <img src={photoUrl} alt={`Packet ${observation.packet_ordinal} expiry evidence`} className="max-h-64 w-full rounded-lg object-contain" />
      ) : (
        <p className="text-xs text-muted-foreground">No photo linked for this packet.</p>
      )}
      <dl className="grid grid-cols-2 gap-1 text-xs">
        <dt className="text-muted-foreground">AI suggested</dt>
        <dd>{observation.ai_suggested_date ?? "—"}</dd>
        <dt className="text-muted-foreground">Auditor confirmed</dt>
        <dd>{observation.human_confirmed_date ?? "—"}</dd>
        <dt className="text-muted-foreground">Classification</dt>
        <dd className="capitalize">{observation.classification.replace("_", " ")}</dd>
      </dl>
    </div>
  );
}

function AttemptSummary({ attempt }: { attempt: ExpiryInspectionAttempt }) {
  return (
    <dl className="space-y-2 text-sm">
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
      {attempt.assurance_fallback ? (
        <p className="text-xs text-amber-700">Lower-assurance fallback was used for this inspection.</p>
      ) : null}
    </dl>
  );
}
