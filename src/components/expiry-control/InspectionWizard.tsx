import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, CheckCircle2, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ClassificationBadge } from "@/components/expiry-control/SeverityBadge";
import {
  checkReconciliation,
  classifyByPolicy,
  computeExpiryEvidenceCoverage,
  createQuarantineTransfer,
  expiryTransition,
  fetchAttempt,
  fetchObservations,
  linkEvidenceToObservation,
  makeIdempotencyKey,
  parseRetailDate,
  resolveExpiryRequiredUnits,
  uploadEvidence,
  uploadSessionVideo,
  type ExpiryInspectionAttempt,
} from "@/lib/expiry-control";
import { getExpiryOcrAdapter } from "@/lib/expiry-control/adapters/expiry-ocr";
import { checkEvidenceDuplicate } from "@/lib/expiry-control/adapters/duplicate-evidence";
import { MediaRecorderVideoSession } from "@/lib/expiry-control/adapters/video-continuity";
import { saveOfflineDraft } from "@/lib/expiry-control/offline-queue";
import { SessionVideoRecorder } from "@/components/expiry-control/SessionVideoRecorder";

const STEPS = ["Scope", "Areas", "Packets", "Reconcile", "Transfer"];

type Props = { attemptId: string; onDone?: () => void };

export function InspectionWizard({ attemptId, onDone }: Props) {
  const qc = useQueryClient();
  const [step, setStep] = useState(1);
  const [actualQty, setActualQty] = useState("");
  const [discrepancyReason, setDiscrepancyReason] = useState("");
  const [assuranceFallback, setAssuranceFallback] = useState(false);
  const [currentPacket, setCurrentPacket] = useState(1);
  const [ocrState, setOcrState] = useState<{ label?: string; date?: string; simulated?: boolean } | null>(null);
  const [hashUsed, setHashUsed] = useState<Set<string>>(new Set());
  const [transferForm, setTransferForm] = useState({
    containerCode: "",
    quarantineLocation: "Returns holding area",
    quantity: "2",
    removalReason: "expired",
  });
  const [submitMessage, setSubmitMessage] = useState("");
  const [videoError, setVideoError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [markerCount, setMarkerCount] = useState(0);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const videoSessionRef = useRef<MediaRecorderVideoSession | null>(null);
  const pendingEvidenceIdRef = useRef<string | null>(null);
  const sessionTimestampRef = useRef<number | null>(null);

  const attemptQuery = useQuery({
    queryKey: ["expiry-attempt", attemptId],
    queryFn: () => fetchAttempt(attemptId),
  });
  const obsQuery = useQuery({
    queryKey: ["expiry-observations", attemptId],
    queryFn: () => fetchObservations(attemptId),
  });

  const attempt = attemptQuery.data;
  const observations = obsQuery.data ?? [];
  const physicalCount = Number(actualQty || attempt?.physical_count || 0);

  const reconcile = useMemo(
    () =>
      checkReconciliation({
        physicalCount: physicalCount || null,
        sellable: attempt?.sellable_count ?? observations.filter((o) => o.classification === "sellable").length,
        remove: attempt?.remove_count ?? observations.filter((o) => ["expired", "near_expiry"].includes(o.classification)).length,
        unresolved: attempt?.unresolved_count ?? observations.filter((o) => o.classification === "unresolved").length,
        observationsRecorded: observations.length,
      }),
    [attempt, observations, physicalCount],
  );

  const startMutation = useMutation({
    mutationFn: () => expiryTransition({ entityType: "attempt", entityId: attemptId, action: "start" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expiry-attempt", attemptId] }),
  });

  const scopeMutation = useMutation({
    mutationFn: () =>
      expiryTransition({
        entityType: "attempt",
        entityId: attemptId,
        action: "confirm_scope",
        payload: {
          actual_quantity: Number(actualQty),
          physical_count: Number(actualQty),
          quantity_discrepancy_reason: discrepancyReason || null,
        },
      }),
    onSuccess: () => {
      setStep(2);
      qc.invalidateQueries({ queryKey: ["expiry-attempt", attemptId] });
    },
  });

  const recordObsMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      expiryTransition({
        entityType: "attempt",
        entityId: attemptId,
        action: "record_observation",
        payload,
        idempotencyKey: makeIdempotencyKey(`obs-${payload.packet_ordinal}`),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expiry-observations", attemptId] });
      qc.invalidateQueries({ queryKey: ["expiry-attempt", attemptId] });
    },
  });

  async function finalizeSessionVideo() {
    const session = videoSessionRef.current;
    if (!session?.isRecording) return;
    setUploadingVideo(true);
    try {
      const report = await session.stop();
      setRecording(false);
      videoSessionRef.current = null;
      if (report.videoBlob) {
        await uploadSessionVideo(report.videoBlob, attemptId, {
          markers: report.markers,
          durationMs: report.durationMs,
          missingSegments: report.missingSegments,
          interrupted: report.missingSegments > 0,
          mimeType: report.mimeType,
        });
      }
    } catch (e) {
      setVideoError(e instanceof Error ? e.message : "Video upload failed.");
    } finally {
      setUploadingVideo(false);
    }
  }

  const reconcileMutation = useMutation({
    mutationFn: async () => {
      await finalizeSessionVideo();
      await expiryTransition({ entityType: "attempt", entityId: attemptId, action: "reconcile" });
    },
    onSuccess: () => setStep(5),
  });

  useEffect(() => {
    return () => {
      void videoSessionRef.current?.stop().catch(() => undefined);
    };
  }, []);

  async function startVideoSession() {
    setVideoError(null);
    try {
      const session = new MediaRecorderVideoSession();
      await session.start();
      videoSessionRef.current = session;
      setRecording(true);
      setMarkerCount(0);
      await expiryTransition({
        entityType: "attempt",
        entityId: attemptId,
        action: "set_assurance_fallback",
        payload: { assurance_fallback: null },
      });
    } catch (e) {
      setVideoError(e instanceof Error ? e.message : "Could not start camera.");
    }
  }

  async function chooseLowerAssurance() {
    if (videoSessionRef.current?.isRecording) {
      await videoSessionRef.current.stop();
      videoSessionRef.current = null;
      setRecording(false);
    }
    setAssuranceFallback(true);
    await expiryTransition({
      entityType: "attempt",
      entityId: attemptId,
      action: "set_assurance_fallback",
      payload: { assurance_fallback: "lower_assurance_photos_only" },
    });
  }

  const submitMutation = useMutation({
    mutationFn: async () => {
      const obs = await fetchObservations(attemptId);
      const required = resolveExpiryRequiredUnits({
        physicalCount: attempt?.physical_count,
        actualQuantity: attempt?.actual_quantity,
      });
      const verifiedUnits = obs.filter(
        (o) =>
          !o.unreadable &&
          (o.human_confirmed_date || o.parsed_date || o.ai_suggested_date) &&
          !o.wrong_product,
      ).length;
      const coverage = computeExpiryEvidenceCoverage({
        requiredUnits: required,
        verifiedUnits,
      });
      await expiryTransition({
        entityType: "attempt",
        entityId: attemptId,
        action: "report_quarantine_transfer",
      });
      // Submit always allowed; <100% coverage → EVIDENCE INCOMPLETE path.
      await expiryTransition({
        entityType: "attempt",
        entityId: attemptId,
        action: coverage.complete ? "submit" : "submit_incomplete",
        payload: coverage.complete
          ? undefined
          : {
              reason: `${coverage.statusLabel} — coverage ${
                coverage.coveragePct != null ? `${coverage.coveragePct.toFixed(0)}%` : "N/A"
              }`,
              coverage_pct: coverage.coveragePct,
              required_units: coverage.requiredUnits,
              verified_units: coverage.verifiedUnits,
            },
      });
      return coverage;
    },
    onSuccess: (coverage) => {
      const pending = (attempt?.remove_count ?? 0) + (attempt?.unresolved_count ?? 0);
      if (!coverage.complete) {
        const pctLabel =
          coverage.coveragePct != null ? `${coverage.coveragePct.toFixed(0)}%` : "N/A";
        setSubmitMessage(
          `${coverage.statusLabel} — submitted at ${pctLabel} coverage. ${pending} units awaiting quarantine receipt.`,
        );
      } else {
        setSubmitMessage(`Inspection submitted — ${pending} units awaiting quarantine receipt.`);
      }
      onDone?.();
    },
  });

  async function handleCapture() {
    const file = fileRef.current?.files?.[0];
    if (!file || !attempt) return;
    const dup = await checkEvidenceDuplicate(file, hashUsed);
    if (dup.status === "duplicate_slot") {
      alert(dup.message);
      return;
    }
    setHashUsed(new Set([...hashUsed, dup.hash]));
    const session = videoSessionRef.current;
    if (session?.isRecording) {
      session.markPacket(currentPacket);
      setMarkerCount((c) => c + 1);
      sessionTimestampRef.current = Date.now();
    }
    try {
      const { evidenceId } = await uploadEvidence(file, attemptId, {
        linkType: "packet_date",
        sessionTimestampMs: sessionTimestampRef.current ?? undefined,
      });
      pendingEvidenceIdRef.current = evidenceId;
    } catch {
      await saveOfflineDraft({
        key: `obs-${currentPacket}`,
        attemptId,
        payload: { packet: currentPacket },
        savedAt: new Date().toISOString(),
      });
    }
    const ocr = getExpiryOcrAdapter();
    const result = await ocr.readDate({ imageBlob: file });
    setOcrState({ label: result.label, date: result.suggestedDate ?? undefined, simulated: result.simulated });
  }

  async function confirmReading(kind: "confirm" | "unreadable" | "wrong") {
    if (!attempt) return;
    const parsed = ocrState?.date ? parseRetailDate(ocrState.date) : { ok: false as const, reason: "No date" };
    const confirmedDate = parsed.ok ? parsed.date : null;
    const classification =
      kind === "unreadable" || kind === "wrong"
        ? "unresolved"
        : classifyByPolicy({
            confirmedDate,
            dateType: "expiry",
            unreadable: kind === "unreadable",
            nearExpiryDays: 7,
          });

    await recordObsMutation.mutateAsync({
      packet_ordinal: currentPacket,
      sku: attempt.sku,
      raw_date_text: ocrState?.date ?? "",
      parsed_date: confirmedDate,
      ai_suggested_date: ocrState?.date ?? null,
      ai_confidence: ocrState?.simulated ? 0.75 : null,
      ai_simulated: ocrState?.simulated ?? false,
      human_confirmed_date: kind === "confirm" ? confirmedDate : null,
      classification,
      placement: classification === "sellable" ? "sellable" : classification === "unresolved" ? "unresolved" : "remove",
      unreadable: kind === "unreadable",
      wrong_product: kind === "wrong",
      file_hash: null,
    });
    const obs = await fetchObservations(attemptId);
    const saved = obs.find((o) => o.packet_ordinal === currentPacket);
    if (saved && pendingEvidenceIdRef.current) {
      await linkEvidenceToObservation(pendingEvidenceIdRef.current, saved.id, attemptId);
      pendingEvidenceIdRef.current = null;
    }
    setOcrState(null);
    if (fileRef.current) fileRef.current.value = "";
    if (currentPacket < physicalCount) setCurrentPacket((p) => p + 1);
    else setStep(4);
  }

  async function handleTransfer() {
    if (!attempt) return;
    await createQuarantineTransfer({
      attemptId,
      storeId: attempt.store_id,
      containerCode: transferForm.containerCode,
      quarantineLocation: transferForm.quarantineLocation,
      sku: attempt.sku,
      quantity: Number(transferForm.quantity),
      removalReason: transferForm.removalReason,
    });
    await submitMutation.mutateAsync();
  }

  if (attemptQuery.isLoading) return <p className="text-sm text-muted-foreground">Loading inspection…</p>;
  if (!attempt) return <p className="text-sm text-destructive">Inspection not found.</p>;

  return (
    <div className="space-y-4">
      <div className="flex gap-1">
        {STEPS.map((label, i) => (
          <div
            key={label}
            className={`flex-1 rounded-lg border px-2 py-1 text-center text-xs ${
              step === i + 1 ? "border-brand bg-brand-soft font-semibold" : "border-border text-muted-foreground"
            }`}
          >
            {label}
          </div>
        ))}
      </div>

      {step === 1 && (
        <ScopeStep
          attempt={attempt}
          actualQty={actualQty}
          setActualQty={setActualQty}
          discrepancyReason={discrepancyReason}
          setDiscrepancyReason={setDiscrepancyReason}
          onStart={() => startMutation.mutate()}
          onNext={() => scopeMutation.mutate()}
        />
      )}

      {step === 2 && (
        <div className="space-y-3 rounded-2xl border p-4">
          <p className="text-sm font-medium">Prepare inspection areas</p>
          <p className="text-xs text-muted-foreground">
            Move each packet only once from Unchecked to its final area. Keep inspected packets separate.
          </p>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-lg border bg-muted/40 p-3">Unchecked</div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">Sellable</div>
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">Remove / hold</div>
          </div>
          {(attempt.assurance_level === "high" || recording) && !assuranceFallback ? (
            <div className="space-y-2">
              <Alert>
                <AlertDescription>
                  Record the inspection session — manager can watch the video later in Review Queue. Start recording
                  before inspecting packets, or choose explicit lower-assurance fallback (requires review).
                </AlertDescription>
              </Alert>
              {recording ? (
                <SessionVideoRecorder
                  session={videoSessionRef.current}
                  recording={recording}
                  markerCount={markerCount}
                />
              ) : (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => void startVideoSession()}>
                    Start session recording
                  </Button>
                  {attempt.assurance_level === "high" ? (
                    <Button size="sm" variant="outline" onClick={() => void chooseLowerAssurance()}>
                      Lower-assurance fallback
                    </Button>
                  ) : null}
                </div>
              )}
              {videoError ? <p className="text-xs text-destructive">{videoError}</p> : null}
            </div>
          ) : assuranceFallback ? (
            <p className="text-xs text-amber-700">Lower-assurance — photos only; extra manager review required.</p>
          ) : (
            <Button size="sm" variant="outline" onClick={() => void startVideoSession()}>
              Optional: record session video
            </Button>
          )}
          <Button
            className="w-full"
            disabled={attempt.assurance_level === "high" && !assuranceFallback && !recording}
            onClick={() => setStep(3)}
          >
            Continue to packets
          </Button>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3 rounded-2xl border p-4">
          {recording ? (
            <SessionVideoRecorder session={videoSessionRef.current} recording={recording} markerCount={markerCount} />
          ) : null}
          <p className="text-sm font-semibold">
            Packet {currentPacket} of {physicalCount || "?"}
          </p>
          <div className="flex gap-3 text-xs">
            <span>Sellable: {attempt.sellable_count}</span>
            <span>Remove: {attempt.remove_count}</span>
            <span>Unresolved: {attempt.unresolved_count}</span>
          </div>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" />
          <Button className="w-full gap-2" size="lg" onClick={() => fileRef.current?.click()}>
            <Camera className="h-5 w-5" /> Capture expiry
          </Button>
          {ocrState ? (
            <div className="space-y-2 rounded-xl border bg-muted/30 p-3">
              <p className="text-sm">
                AI suggested <strong>{ocrState.date ?? "—"}</strong>. Check the printed marking before confirming.
              </p>
              {ocrState.simulated ? (
                <p className="text-xs font-medium text-amber-700">Simulated — development only</p>
              ) : null}
              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" onClick={() => confirmReading("confirm")}>
                  Confirm reading
                </Button>
                <Button size="sm" variant="outline" onClick={() => confirmReading("unreadable")}>
                  Mark unreadable
                </Button>
                <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
                  Retake
                </Button>
                <Button size="sm" variant="destructive" onClick={() => confirmReading("wrong")}>
                  Wrong product
                </Button>
              </div>
            </div>
          ) : null}
          {observations.length > 0 ? (
            <div className="space-y-1">
              {observations.map((o) => (
                <div key={o.id} className="flex items-center justify-between text-xs">
                  <span>Packet {o.packet_ordinal}</span>
                  <ClassificationBadge value={o.classification} />
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}

      {step === 4 && (
        <div className="space-y-3 rounded-2xl border p-4">
          <p className="font-medium">Reconcile quantities</p>
          <p className="text-sm tabular-nums">{reconcile.equation}</p>
          {!reconcile.ok ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{reconcile.reason}</AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>All units accounted for.</AlertDescription>
            </Alert>
          )}
          <div className="flex gap-2">
            <Button
              className="flex-1"
              disabled={!reconcile.ok || uploadingVideo}
              onClick={() => reconcileMutation.mutate()}
            >
              {uploadingVideo ? "Uploading session video…" : "Continue to transfer"}
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() =>
                expiryTransition({
                  entityType: "attempt",
                  entityId: attemptId,
                  action: "submit_incomplete",
                  payload: { reason: "Quantity mismatch — escalated" },
                }).then(onDone)
              }
            >
              Submit incomplete
            </Button>
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="space-y-3 rounded-2xl border p-4">
          <p className="font-medium">Transfer removed / held stock</p>
          <div className="space-y-2">
            <Label>Container / bag ID</Label>
            <Input
              value={transferForm.containerCode}
              onChange={(e) => setTransferForm({ ...transferForm, containerCode: e.target.value })}
              placeholder="Q-BAG-001"
            />
            <Label>Quarantine location</Label>
            <Input
              value={transferForm.quarantineLocation}
              onChange={(e) => setTransferForm({ ...transferForm, quarantineLocation: e.target.value })}
            />
            <Label>Quantity to transfer</Label>
            <Input
              value={transferForm.quantity}
              onChange={(e) => setTransferForm({ ...transferForm, quantity: e.target.value })}
            />
          </div>
          <Button className="w-full" disabled={!transferForm.containerCode} onClick={handleTransfer}>
            Submit inspection
          </Button>
          {submitMessage ? <p className="text-sm font-medium text-amber-800">{submitMessage}</p> : null}
          <p className="text-xs text-muted-foreground">
            POS blocking: not configured — inventory non-saleable marking requires separate integration.
          </p>
        </div>
      )}

      <div className="sticky bottom-0 border-t bg-background/95 py-3 backdrop-blur">
        <p className="text-center text-xs text-muted-foreground">
          Coverage: point-in-time only — {attempt.store_fully_checked ? "locations verified" : attempt.coverage_statement ?? "partial location coverage"}
        </p>
      </div>
    </div>
  );
}

function ScopeStep({
  attempt,
  actualQty,
  setActualQty,
  discrepancyReason,
  setDiscrepancyReason,
  onStart,
  onNext,
}: {
  attempt: ExpiryInspectionAttempt;
  actualQty: string;
  setActualQty: (v: string) => void;
  discrepancyReason: string;
  setDiscrepancyReason: (v: string) => void;
  onStart: () => void;
  onNext: () => void;
}) {
  const mismatch = actualQty && Number(actualQty) !== attempt.expected_quantity;
  return (
    <div className="space-y-3 rounded-2xl border p-4">
      <div className="grid gap-2 text-sm">
        <p>
          <span className="text-muted-foreground">SKU:</span> {attempt.sku || "—"}
        </p>
        <p>
          <span className="text-muted-foreground">Expected qty:</span> {attempt.expected_quantity}
        </p>
      </div>
      <div className="space-y-1">
        <Label>Actual physical quantity</Label>
        <Input inputMode="numeric" value={actualQty} onChange={(e) => setActualQty(e.target.value)} />
      </div>
      {mismatch ? (
        <div className="space-y-1">
          <Label>Quantity discrepancy reason</Label>
          <Textarea value={discrepancyReason} onChange={(e) => setDiscrepancyReason(e.target.value)} />
        </div>
      ) : null}
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onStart}>
          Start
        </Button>
        <Button className="flex-1" disabled={!actualQty} onClick={onNext}>
          Confirm scope
        </Button>
      </div>
    </div>
  );
}
