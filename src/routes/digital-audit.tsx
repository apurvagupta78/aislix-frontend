import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Camera,
  CheckCircle2,
  CircleDashed,
  ClipboardList,
  Download,
  Loader2,
  MapPin,
  ScanBarcode,
  ShieldCheck,
  Upload,
  Video,
} from "lucide-react";
import { toast } from "sonner";

import { AuditProgressHeader } from "@/components/audit/AuditProgressHeader";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ErrorState, Skeleton } from "@/components/States";
import { toUserMessage } from "@/lib/api/errors";
import {
  computeLineVariance,
  downloadActualCountSheet,
  evidenceKey,
  importActualCountsFile,
  lineNeedsBarcode,
  lineNeedsSkuPhoto,
  RCA_OPTIONS,
  recordBarcodeConfirmation,
  startOrResumeDigitalAudit,
  submitDigitalAudit,
  updateDigitalAuditLine,
  uploadBinEvidence,
  validateDigitalAuditSubmit,
  lookupLineByBarcode,
  type DigitalAuditLine,
  type EvidenceRequirement,
  type RcaCode,
} from "@/lib/digital-audit";
import type { EvidenceProof } from "@/lib/audit-evidence-policy";
import { readDeviceLocation, watchDeviceLocation, type DeviceLocation } from "@/lib/device-location";
import { BarcodeScannerDialog } from "@/components/digital-audit/BarcodeScannerDialog";
import {
  cacheAuditSession,
  flushOfflineQueue,
  isOnline,
  listPendingCounts,
  queueLineUpdate,
  queuePhotoUpload,
} from "@/lib/audit-offline";

export const Route = createFileRoute("/digital-audit")({
  validateSearch: (search: Record<string, unknown>) => ({
    assignmentId:
      typeof search.assignmentId === "string" ? search.assignmentId : undefined,
  }),
  head: () => ({
    meta: [{ title: "Digital Audit — Aislix" }],
  }),
  component: DigitalAuditPage,
});

function DigitalAuditPage() {
  const { assignmentId } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadTarget = useRef<{ key: string; video: boolean } | null>(null);
  const csvRef = useRef<HTMLInputElement>(null);
  const [activeBin, setActiveBin] = useState<string | null>(null);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
  const [scanLineId, setScanLineId] = useState<string | null>(null);
  const [offline, setOffline] = useState(!isOnline());
  const [pendingCount, setPendingCount] = useState(0);
  const [geo, setGeo] = useState<DeviceLocation | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [geoPending, setGeoPending] = useState(false);
  const geoRef = useRef<DeviceLocation | null>(null);

  const applyLocation = (location: DeviceLocation) => {
    geoRef.current = location;
    setGeo(location);
    setGeoError(null);
  };

  const requestLocation = () => {
    setGeoPending(true);
    readDeviceLocation()
      .then(applyLocation)
      .catch((error: Error) => setGeoError(error.message))
      .finally(() => setGeoPending(false));
  };

  /** Fresh device GPS fix for each capture; falls back to a watched fix under 2 minutes old. */
  const captureLocation = async (): Promise<DeviceLocation | null> => {
    try {
      const location = await readDeviceLocation();
      applyLocation(location);
      return location;
    } catch (error) {
      const last = geoRef.current;
      if (last && Date.now() - new Date(last.capturedAt).getTime() < 120_000) return last;
      setGeoError((error as Error).message);
      return null;
    }
  };

  useEffect(() => {
    setGeoPending(true);
    return watchDeviceLocation(
      (location) => {
        applyLocation(location);
        setGeoPending(false);
      },
      (message) => {
        setGeoError(message);
        setGeoPending(false);
      },
    );
  }, []);

  const sessionQuery = useQuery({
    queryKey: ["digital-audit", assignmentId],
    queryFn: () => startOrResumeDigitalAudit(assignmentId!),
    enabled: Boolean(assignmentId),
    retry: false,
  });

  const session = sessionQuery.data;
  const linesByBin = useMemo(() => {
    const map = new Map<string, DigitalAuditLine[]>();
    for (const line of session?.lines ?? []) {
      const list = map.get(line.bin_key) ?? [];
      list.push(line);
      map.set(line.bin_key, list);
    }
    return map;
  }, [session?.lines]);

  useEffect(() => {
    if (!activeBin && session?.bins.length) setActiveBin(session.bins[0] ?? null);
  }, [session?.bins, activeBin]);

  useEffect(() => {
    const onOnline = () => {
      setOffline(false);
      if (!session?.scan_id) return;
      void flushOfflineQueue({
        updateLine: (input) => updateDigitalAuditLine(input),
        uploadPhoto: (input) => uploadBinEvidence(input),
      }).then(({ syncedLines, syncedPhotos }) => {
        if (syncedLines || syncedPhotos) {
          toast.success(`Synced ${syncedLines} line(s) and ${syncedPhotos} photo(s).`);
          void queryClient.invalidateQueries({ queryKey: ["digital-audit", assignmentId] });
        }
        void listPendingCounts().then((c: any) => setPendingCount(c.lines + c.photos));
      });
    };
    const onOffline = () => setOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    void listPendingCounts().then((c: any) => setPendingCount(c.lines + c.photos));
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [session?.scan_id, assignmentId, queryClient]);

  useEffect(() => {
    if (session && assignmentId) void cacheAuditSession(assignmentId, session);
  }, [session, assignmentId]);

  const saveLineMutation = useMutation({
    mutationFn: async (input: {
      lineId: string;
      actual_qty: number;
      rca_code?: RcaCode | null;
      rca_notes?: string | null;
    }) => {
      if (!isOnline()) {
        await queueLineUpdate({ ...input, assignmentId: assignmentId! });
        return;
      }
      await updateDigitalAuditLine(input);
    },
    onSuccess: async () => {
      const counts = await listPendingCounts();
      setPendingCount(counts.lines + counts.photos);
      if (!isOnline()) toast.message("Saved offline — will sync when back online.");
      void queryClient.invalidateQueries({ queryKey: ["digital-audit", assignmentId] });
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });

  const photoMutation = useMutation({
    mutationFn: async (input: { binKey: string; file: File; video?: boolean }) => {
      const location = await captureLocation();
      const coords = {
        lat: location?.lat ?? null,
        lng: location?.lng ?? null,
        accuracyM: location?.accuracyM ?? null,
      };
      if (!isOnline()) {
        if (input.video) throw new Error("Session video needs a connection. Upload it when back online.");
        await queuePhotoUpload({
          scanId: session!.scan_id,
          assignmentId: assignmentId!,
          binKey: input.binKey,
          file: input.file,
          ...coords,
        });
        return;
      }
      await uploadBinEvidence({
        scanId: session!.scan_id,
        binKey: input.binKey,
        file: input.file,
        ...coords,
        allowVideo: input.video,
      });
    },
    onSuccess: async (_data, input) => {
      const counts = await listPendingCounts();
      setPendingCount(counts.lines + counts.photos);
      toast.success(
        !isOnline() ? "Photo queued offline." : input.video ? "Session video saved." : "Photo saved.",
      );
      void queryClient.invalidateQueries({ queryKey: ["digital-audit", assignmentId] });
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });

  const barcodeMutation = useMutation({
    mutationFn: async (input: { lineId: string; code: string; method: "camera" | "manual" }) => {
      const location = await captureLocation();
      await recordBarcodeConfirmation({
        scanId: session!.scan_id,
        ...input,
        lat: location?.lat ?? null,
        lng: location?.lng ?? null,
      });
    },
    onSuccess: () => {
      toast.success("Barcode confirmed.");
      void queryClient.invalidateQueries({ queryKey: ["digital-audit", assignmentId] });
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });

  const csvMutation = useMutation({
    mutationFn: (file: File) => importActualCountsFile(session!.scan_id, file),
    onSuccess: (result) => {
      const notes: string[] = [];
      if (result.unmatched.length) {
        notes.push(
          `${result.unmatched.length} row(s) did not match an assigned SKU: ${result.unmatched.slice(0, 3).join(", ")}${result.unmatched.length > 3 ? "…" : ""}`,
        );
      }
      if (result.invalid.length) notes.push(`${result.invalid.length} row(s) had an invalid count.`);
      if (result.blankRows) notes.push(`${result.blankRows} row(s) left blank.`);
      if (result.remainingUncounted) {
        notes.push(`${result.remainingUncounted} SKU(s) still need a count.`);
      }
      const message = `Imported counts for ${result.updated} SKU line(s).`;
      if (notes.length) toast.warning(message, { description: notes.join(" "), duration: 8000 });
      else toast.success(message);
      void queryClient.invalidateQueries({ queryKey: ["digital-audit", assignmentId] });
    },
    onError: (e) => toast.error(toUserMessage(e), { duration: 8000 }),
  });

  const pickEvidence = (key: string, mode: EvidenceCaptureMode = "photo") => {
    const video = mode !== "photo";
    uploadTarget.current = { key, video };
    const input = fileRef.current;
    if (!input) return;
    // "video/*" + capture is what makes mobile browsers open the camera in video mode.
    input.accept =
      mode === "record" ? "video/*" : video ? "video/mp4,video/webm,video/quicktime" : "image/jpeg,image/png";
    if (mode === "upload_video") input.removeAttribute("capture");
    else input.setAttribute("capture", "environment");
    input.click();
  };

  const confirmBarcodeForLine = (line: DigitalAuditLine, code: string, method: "camera" | "manual") => {
    const matches = lookupLineByBarcode([line], code);
    if (!matches) {
      toast.error(`Scanned code ${code} does not match ${line.product_name}.`);
      return;
    }
    barcodeMutation.mutate({ lineId: line.id, code, method });
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      const location = await captureLocation();
      await submitDigitalAudit({
        scanId: session!.scan_id,
        assignmentId: assignmentId!,
        lat: location?.lat ?? null,
        lng: location?.lng ?? null,
        accuracyM: location?.accuracyM ?? null,
      });
    },
    onSuccess: () => {
      toast.success("Audit submitted for manager review.");
      void navigate({ to: "/my-scans" });
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });

  if (!assignmentId) {
    return (
      <AppShell title="Digital Audit">
        <ErrorState title="Missing assignment" description="Open this audit from My Audits." />
      </AppShell>
    );
  }

  if (sessionQuery.isLoading) {
    return (
      <AppShell title="Digital Audit">
        <Skeleton className="h-40 w-full" />
      </AppShell>
    );
  }

  if (sessionQuery.isError || !session) {
    return (
      <AppShell title="Digital Audit">
        <ErrorState
          title="Could not load audit"
          description={toUserMessage(sessionQuery.error)}
        />
      </AppShell>
    );
  }

  if (session.submission_status === "pending_review" || session.submission_status === "approved") {
    return (
      <AppShell title="Digital Audit">
        <div className="mx-auto max-w-lg py-12 text-center">
          <ClipboardList className="mx-auto size-10 text-brand" />
          <h2 className="mt-4 text-lg font-semibold">Audit submitted</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Status: {session.submission_status.replace("_", " ")}. Your manager will review the
            variance report.
          </p>
          <Button className="mt-6" onClick={() => void navigate({ to: "/my-scans" })}>
            Back to My Audits
          </Button>
        </div>
      </AppShell>
    );
  }

  const validation = validateDigitalAuditSubmit(session, { hasGps: Boolean(geo) });
  const evidenceKeys = new Set(session.evidence.map((e) => e.bin_key));
  const proofs = session.policy?.requiredProof ?? [];
  const needsAfter = proofs.includes("before_after");
  const activeLines = activeBin ? (linesByBin.get(activeBin) ?? []) : [];
  const binHasPhoto = activeBin ? evidenceKeys.has(activeBin) : false;
  const binHasAfter = activeBin ? evidenceKeys.has(evidenceKey.after(activeBin)) : false;
  const completedSkus = session.lines.filter((l) => l.actual_qty != null).length;
  const binsWithPhoto = session.bins.filter((bin) => evidenceKeys.has(bin)).length;
  const uploadingKey = photoMutation.isPending ? photoMutation.variables?.binKey : undefined;
  const barcodeLine = scanLineId ? session.lines.find((l) => l.id === scanLineId) : undefined;

  function handleBarcodeFound(code: string, method: "camera" | "manual") {
    const line = lookupLineByBarcode(session!.lines, code);
    if (!line) {
      toast.error("No matching SKU for that barcode.");
      return;
    }
    setActiveBin(line.bin_key);
    if (lineNeedsBarcode(session!, line) && line.barcode) {
      barcodeMutation.mutate({ lineId: line.id, code, method });
    } else {
      toast.success(`Found ${line.product_name}`);
    }
  }

  function handleBarcodeLookup() {
    handleBarcodeFound(barcodeInput.trim(), "manual");
  }

  return (
    <AppShell
      title="Digital Audit"
      description={`${session.store_name} · ${session?.lines.length} SKUs · ${session.bins.length} shelf/bin(s)`}
    >
      <div className="mx-auto max-w-3xl space-y-6 pb-28">
        <AuditProgressHeader
          storeName={session.store_name}
          totalSkus={session?.lines.length}
          completedSkus={completedSkus}
          binsWithPhoto={binsWithPhoto}
          totalBins={session.bins.length}
          offline={offline}
          pendingSync={pendingCount}
        />

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png"
          capture="environment"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            const target = uploadTarget.current;
            if (f && target) photoMutation.mutate({ binKey: target.key, file: f, video: target.video });
          }}
        />

        <RequiredEvidencePanel
          requirements={validation.requirements}
          requireRca={session.require_rca}
          policyLevel={session.policy?.level ?? null}
          geo={geo}
          geoError={geoError}
          geoPending={geoPending}
          onRetryGps={requestLocation}
          uploadingKey={uploadingKey}
          onCaptureProof={(proof, mode) => pickEvidence(evidenceKey.proof(proof), mode)}
        />

        <section className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold">Barcode lookup</h3>
          <div className="mt-3 flex gap-2">
            <Input
              placeholder="Scan or type barcode / SKU / item code"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleBarcodeLookup()}
            />
            <Button type="button" variant="outline" onClick={() => setScanOpen(true)}>
              <ScanBarcode className="size-4" />
            </Button>
            <Button type="button" variant="outline" onClick={handleBarcodeLookup}>
              Find
            </Button>
          </div>
        </section>

        <BarcodeScannerDialog
          open={scanOpen}
          onOpenChange={(open) => {
            setScanOpen(open);
            if (!open) setScanLineId(null);
          }}
          onScan={(code) => {
            setBarcodeInput(code);
            if (barcodeLine) confirmBarcodeForLine(barcodeLine, code, "camera");
            else handleBarcodeFound(code, "camera");
          }}
        />

        <section className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Import actual counts (CSV or Excel)</h3>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => downloadActualCountSheet(session)}
              >
                <Download className="size-4" /> Download count sheet
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => csvRef.current?.click()}
                disabled={csvMutation.isPending}
              >
                {csvMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Upload className="size-4" />
                )}
                Upload counts
              </Button>
            </div>
            <input
              ref={csvRef}
              type="file"
              accept=".csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) csvMutation.mutate(f);
              }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Download the count sheet, fill the <span className="font-medium">Actual Qty</span>{" "}
            column, and upload it. Rows match by SKU, Item Code, Barcode or Product Name; blank
            counts are skipped. Imported counts appear on each SKU below.
          </p>
        </section>

        <div className="flex flex-wrap gap-2">
          {session.bins.map((bin) => {
            const hasPhoto = evidenceKeys.has(bin);
            return (
              <Button
                key={bin}
                type="button"
                size="sm"
                variant={activeBin === bin ? "default" : "outline"}
                onClick={() => setActiveBin(bin)}
              >
                {bin === "default" ? "Shelf" : bin}
                {hasPhoto ? " ✓" : ""}
              </Button>
            );
          })}
        </div>

        {activeBin ? (
          <section className="space-y-4 rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-semibold">
                Shelf / bin: {activeBin === "default" ? "Main shelf" : activeBin}
              </h3>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={binHasPhoto ? "outline" : "default"}
                  size="sm"
                  onClick={() => pickEvidence(activeBin)}
                  disabled={photoMutation.isPending}
                >
                  {uploadingKey === activeBin ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Camera className="size-4" />
                  )}
                  {binHasPhoto ? "Replace shelf photo" : "Add shelf photo (required)"}
                </Button>
                {needsAfter ? (
                  <Button
                    type="button"
                    variant={binHasAfter ? "outline" : "default"}
                    size="sm"
                    onClick={() => pickEvidence(evidenceKey.after(activeBin))}
                    disabled={photoMutation.isPending}
                  >
                    {uploadingKey === evidenceKey.after(activeBin) ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Camera className="size-4" />
                    )}
                    {binHasAfter ? "Replace after photo" : "Add after photo (required)"}
                  </Button>
                ) : null}
              </div>
            </div>

            {binHasPhoto ? (
              <p className="text-xs text-success">Shelf photo attached for this bin.</p>
            ) : (
              <p className="text-xs text-[#667085]">Add a shelf photo before you can submit.</p>
            )}

            <div className="space-y-4">
              {activeLines.map((line) => (
                <LineEditor
                  key={`${line.id}:${line.actual_qty ?? ""}:${line.rca_code ?? ""}:${line.rca_notes ?? ""}`}
                  line={line}
                  requireRca={session.require_rca}
                  saving={saveLineMutation.isPending && saveLineMutation.variables?.lineId === line.id}
                  needsPhoto={lineNeedsSkuPhoto(session, line)}
                  hasPhoto={evidenceKeys.has(evidenceKey.sku(line.id))}
                  photoUploading={uploadingKey === evidenceKey.sku(line.id)}
                  onPhoto={() => pickEvidence(evidenceKey.sku(line.id))}
                  needsBarcode={lineNeedsBarcode(session, line)}
                  barcodeConfirmed={evidenceKeys.has(evidenceKey.barcode(line.id))}
                  onScanBarcode={() => {
                    setScanLineId(line.id);
                    setScanOpen(true);
                  }}
                  onSave={(actual, rca, notes) =>
                    saveLineMutation.mutate({
                      lineId: line.id,
                      actual_qty: actual,
                      rca_code: rca,
                      rca_notes: notes,
                    })
                  }
                />
              ))}
            </div>
          </section>
        ) : null}

        {!validation.ok ? (
          <div className="rounded-xl border border-[#D9E2E8] bg-white p-4 text-sm">
            <p className="font-semibold text-[#102A43]">Before you can submit:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[#667085] marker:text-[#9B86D9]">
              {validation.missingSkus.length > 0 && (
                <li>Missing counts: {validation.missingSkus.length} SKU(s)</li>
              )}
              {validation.missingBins.length > 0 && (
                <li>
                  Missing shelf photos:{" "}
                  {validation.missingBins.map((b) => (b === "default" ? "Main shelf" : b)).join(", ")}
                </li>
              )}
              {validation.missingRca.length > 0 && (
                <li>Reason required for {validation.missingRca.length} variance line(s)</li>
              )}
              {validation.missingOtherNotes.length > 0 && (
                <li>Notes required when the reason is Other: {validation.missingOtherNotes.join(", ")}</li>
              )}
              {validation.unmetRequirements.map((req) => (
                <li key={req.id}>
                  {req.label}: {req.done}/{req.total}
                  {req.missing.length ? ` — ${req.missing.slice(0, 3).join(", ")}${req.missing.length > 3 ? "…" : ""}` : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 p-4 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0">
          <Button
            className="w-full shadow-lg sm:shadow-none"
            size="lg"
            disabled={!validation.ok || submitMutation.isPending}
            onClick={() => submitMutation.mutate()}
          >
            {submitMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              "Submit audit for review"
            )}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}

type EvidenceCaptureMode = "photo" | "record" | "upload_video";

const PROOF_UPLOADS: EvidenceProof[] = ["live_session_video", "quarantine_contents", "sealed_container"];

function describeGps(geo: DeviceLocation | null, geoError: string | null, geoPending: boolean): string {
  if (geo) {
    const accuracy = geo.accuracyM != null ? ` (±${Math.round(geo.accuracyM)} m)` : "";
    return `Device GPS captured${accuracy}`;
  }
  if (geoPending) return "Reading device GPS…";
  return geoError ?? "Device GPS unavailable";
}

function RequiredEvidencePanel({
  requirements,
  requireRca,
  policyLevel,
  geo,
  geoError,
  geoPending,
  onRetryGps,
  uploadingKey,
  onCaptureProof,
}: {
  requirements: EvidenceRequirement[];
  requireRca: boolean;
  policyLevel: string | null;
  geo: DeviceLocation | null;
  geoError: string | null;
  geoPending: boolean;
  onRetryGps: () => void;
  uploadingKey?: string;
  onCaptureProof: (proof: EvidenceProof, mode: EvidenceCaptureMode) => void;
}) {
  const metCount = requirements.filter((r) => r.ok).length;
  const gpsRequired = requirements.some((r) => r.id === "gps");
  return (
    <section className="rounded-xl border border-[#D9E2E8] bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-[#7DB7D6]" />
          <h3 className="text-sm font-semibold text-[#102A43]">Required evidence</h3>
          {policyLevel ? (
            <Badge variant="outline" className="capitalize">
              {policyLevel} assurance
            </Badge>
          ) : null}
        </div>
        <span className="text-xs tabular-nums text-[#667085]">
          {metCount}/{requirements.length} complete
        </span>
      </div>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {requirements.map((req) => {
          const proof = req.id as EvidenceProof;
          const canUpload = PROOF_UPLOADS.includes(proof);
          const uploading = uploadingKey === evidenceKey.proof(proof);
          return (
            <li
              key={req.id}
              className={`flex items-start gap-2 rounded-lg border p-2.5 text-xs ${
                req.ok
                  ? "border-[#D9E2E8] bg-white"
                  : "border-[var(--aislix-warehouse-border)] bg-[var(--aislix-warehouse-bg)]"
              }`}
            >
              {req.ok ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#79E2A8]" />
              ) : (
                <CircleDashed className="mt-0.5 size-4 shrink-0 text-[#7DB7D6]" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-[#102A43]">{req.label}</p>
                  {req.total > 1 || req.id === "variance_photo" || req.id === "barcode" ? (
                    <span className="tabular-nums text-[#667085]">
                      {req.done}/{req.total}
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-[#667085]">
                  {req.id === "gps" ? describeGps(geo, geoError, geoPending) : req.hint}
                </p>
                {canUpload && proof === "live_session_video" ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={req.ok ? "ghost" : "outline"}
                      className="h-7 px-2 text-xs"
                      disabled={uploading}
                      onClick={() => onCaptureProof(proof, "record")}
                    >
                      {uploading ? <Loader2 className="size-3 animate-spin" /> : <Video className="size-3" />}
                      {req.ok ? "Re-record live video" : "Record live video"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      disabled={uploading}
                      onClick={() => onCaptureProof(proof, "upload_video")}
                    >
                      <Upload className="size-3" />
                      Upload video
                    </Button>
                  </div>
                ) : canUpload ? (
                  <Button
                    type="button"
                    size="sm"
                    variant={req.ok ? "ghost" : "outline"}
                    className="mt-2 h-7 px-2 text-xs"
                    disabled={uploading}
                    onClick={() => onCaptureProof(proof, "photo")}
                  >
                    {uploading ? <Loader2 className="size-3 animate-spin" /> : <Camera className="size-3" />}
                    {req.ok ? "Replace" : "Add photo"}
                  </Button>
                ) : null}
                {req.id === "gps" && !req.ok ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-2 h-7 px-2 text-xs"
                    disabled={geoPending}
                    onClick={onRetryGps}
                  >
                    {geoPending ? <Loader2 className="size-3 animate-spin" /> : <MapPin className="size-3" />}
                    Retry location
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#667085]">
        <Badge variant="outline">SKU counts required for every line</Badge>
        <Badge variant="outline">
          {requireRca ? "Reason required for every variance" : "Variance reason optional"}
        </Badge>
        {!gpsRequired ? (
          <Badge variant="outline" className="gap-1">
            <MapPin className="size-3" /> {geo ? describeGps(geo, geoError, geoPending) : "Device GPS unavailable (optional)"}
          </Badge>
        ) : null}
      </div>
    </section>
  );
}

function LineEditor({
  line,
  requireRca,
  saving,
  needsPhoto,
  hasPhoto,
  photoUploading,
  onPhoto,
  needsBarcode,
  barcodeConfirmed,
  onScanBarcode,
  onSave,
}: {
  line: DigitalAuditLine;
  requireRca: boolean;
  saving: boolean;
  needsPhoto: boolean;
  hasPhoto: boolean;
  photoUploading: boolean;
  onPhoto: () => void;
  needsBarcode: boolean;
  barcodeConfirmed: boolean;
  onScanBarcode: () => void;
  onSave: (actual: number, rca: RcaCode | null, notes: string) => void;
}) {
  const [actual, setActual] = useState(line.actual_qty?.toString() ?? "");
  const [rca, setRca] = useState<RcaCode | "">(line.rca_code ?? "");
  const [notes, setNotes] = useState(line.rca_notes ?? "");

  const preview = computeLineVariance(
    line.expected_qty,
    actual === "" ? null : Number(actual),
    line.mrp_inr,
  );
  const hasVariance = preview.variance_qty !== null && preview.variance_qty !== 0;
  const countValid = actual !== "" && Number.isFinite(Number(actual)) && Number(actual) >= 0;
  const dirty =
    actual !== (line.actual_qty?.toString() ?? "") ||
    rca !== (line.rca_code ?? "") ||
    notes !== (line.rca_notes ?? "");

  return (
    <div className="rounded-lg border border-border/80 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">{line.product_name}</p>
          <p className="text-xs text-muted-foreground">
            {line.sku ? `SKU ${line.sku}` : ""}
            {line.item_code ? ` · ${line.item_code}` : ""}
            {line.location ? ` · ${line.location}` : ""}
          </p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <p>Expected: {line.expected_qty}</p>
          {line.system_qty != null ? <p>System: {line.system_qty}</p> : null}
          {line.mrp_inr != null ? <p>MRP ₹{line.mrp_inr}</p> : null}
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="text-xs">Actual qty</Label>
          <Input
            type="number"
            min={0}
            inputMode="numeric"
            value={actual}
            onChange={(e) => setActual(e.target.value)}
          />
        </div>
        {hasVariance ? (
          <div>
            <Label className="text-xs">
              Reason for variance{requireRca ? "" : " (optional)"}
            </Label>
            <Select value={rca} onValueChange={(v) => setRca(v as RcaCode)}>
              <SelectTrigger>
                <SelectValue placeholder="Select reason" />
              </SelectTrigger>
              <SelectContent>
                {RCA_OPTIONS.map((opt) => (
                  <SelectItem key={opt.code} value={opt.code}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      {hasVariance ? (
        <div className="mt-2">
          <Label className="text-xs">Notes (optional)</Label>
          <Textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Additional context"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Variance: {preview.variance_qty}
            {preview.variance_pct != null ? ` (${preview.variance_pct.toFixed(1)}%)` : ""}
            {preview.variance_value_inr != null
              ? ` · ₹${preview.variance_value_inr.toFixed(2)}`
              : ""}
          </p>
        </div>
      ) : null}

      {needsPhoto || hasPhoto || needsBarcode ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {needsPhoto || hasPhoto ? (
            <Button
              type="button"
              size="sm"
              variant={hasPhoto ? "ghost" : "outline"}
              className="h-8 text-xs"
              disabled={photoUploading}
              onClick={onPhoto}
            >
              {photoUploading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : hasPhoto ? (
                <CheckCircle2 className="size-3.5 text-[#79E2A8]" />
              ) : (
                <Camera className="size-3.5" />
              )}
              {hasPhoto ? "SKU photo attached · Replace" : "Add SKU photo (required)"}
            </Button>
          ) : null}
          {needsBarcode ? (
            barcodeConfirmed ? (
              <Badge variant="outline" className="gap-1 text-xs">
                <CheckCircle2 className="size-3 text-[#79E2A8]" /> Barcode confirmed
              </Badge>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={onScanBarcode}
              >
                <ScanBarcode className="size-3.5" /> Scan barcode (required)
              </Button>
            )
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 flex items-center gap-3">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={saving || !countValid}
          onClick={() =>
            onSave(Number(actual), hasVariance ? (rca as RcaCode) || null : null, notes)
          }
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : null}
          Save line
        </Button>
        {line.actual_qty != null && !dirty ? (
          <span className="flex items-center gap-1 text-xs text-[#667085]">
            <CheckCircle2 className="size-3.5 text-[#79E2A8]" /> Saved: {line.actual_qty}
          </span>
        ) : dirty && line.actual_qty != null ? (
          <span className="text-xs text-[#667085]">Unsaved change (saved: {line.actual_qty})</span>
        ) : null}
        {actual !== "" && !countValid ? (
          <span className="text-xs text-[var(--aislix-primary)]">Enter a count of 0 or more.</span>
        ) : null}
      </div>
    </div>
  );
}
