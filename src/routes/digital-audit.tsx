import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Camera,
  ClipboardList,
  Loader2,
  MapPin,
  ScanBarcode,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

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
  importActualCsv,
  loadDigitalAuditSession,
  RCA_OPTIONS,
  startOrResumeDigitalAudit,
  submitDigitalAudit,
  updateDigitalAuditLine,
  uploadBinEvidence,
  validateDigitalAuditSubmit,
  lookupLineByBarcode,
  type DigitalAuditLine,
  type RcaCode,
} from "@/lib/digital-audit";

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
  const csvRef = useRef<HTMLInputElement>(null);
  const [activeBin, setActiveBin] = useState<string | null>(null);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setGeo(null),
      { enableHighAccuracy: true, timeout: 15000 },
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

  const saveLineMutation = useMutation({
    mutationFn: (input: { lineId: string; actual_qty: number; rca_code?: RcaCode | null; rca_notes?: string | null }) =>
      updateDigitalAuditLine(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["digital-audit", assignmentId] }),
    onError: (e) => toast.error(toUserMessage(e)),
  });

  const photoMutation = useMutation({
    mutationFn: (input: { binKey: string; file: File }) =>
      uploadBinEvidence({
        scanId: session!.scan_id,
        binKey: input.binKey,
        file: input.file,
        lat: geo?.lat,
        lng: geo?.lng,
      }),
    onSuccess: () => {
      toast.success("Shelf photo saved.");
      void queryClient.invalidateQueries({ queryKey: ["digital-audit", assignmentId] });
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });

  const csvMutation = useMutation({
    mutationFn: async (file: File) => {
      const text = await file.text();
      return importActualCsv(session!.scan_id, text);
    },
    onSuccess: (count) => {
      toast.success(`Updated ${count} SKU line(s) from CSV.`);
      void queryClient.invalidateQueries({ queryKey: ["digital-audit", assignmentId] });
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });

  const submitMutation = useMutation({
    mutationFn: () =>
      submitDigitalAudit({
        scanId: session!.scan_id,
        assignmentId: assignmentId!,
        lat: geo?.lat,
        lng: geo?.lng,
      }),
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

  const validation = validateDigitalAuditSubmit(session);
  const activeLines = activeBin ? (linesByBin.get(activeBin) ?? []) : [];
  const binHasPhoto = session.evidence.some((e) => e.bin_key === activeBin);

  function handleBarcodeLookup() {
    const line = lookupLineByBarcode(session.lines, barcodeInput.trim());
    if (!line) {
      toast.error("No matching SKU for that barcode.");
      return;
    }
    setActiveBin(line.bin_key);
    toast.success(`Found ${line.product_name}`);
  }

  return (
    <AppShell
      title="Digital Audit"
      description={`${session.store_name} · ${session.lines.length} SKUs · ${session.bins.length} shelf/bin(s)`}
    >
      <div className="mx-auto max-w-3xl space-y-6 pb-24">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">Incomplete until all SKUs + bin photos</Badge>
          {geo ? (
            <Badge variant="outline" className="gap-1">
              <MapPin className="size-3" /> GPS captured
            </Badge>
          ) : (
            <Badge variant="outline" className="text-warning">
              GPS unavailable
            </Badge>
          )}
        </div>

        <section className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold">Barcode lookup</h3>
          <div className="mt-3 flex gap-2">
            <Input
              placeholder="Scan or type barcode / SKU / item code"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleBarcodeLookup()}
            />
            <Button type="button" variant="outline" onClick={handleBarcodeLookup}>
              <ScanBarcode className="size-4" />
            </Button>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Import actual counts (CSV)</h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => csvRef.current?.click()}
              disabled={csvMutation.isPending}
            >
              <Upload className="size-4" /> Upload CSV
            </Button>
            <input
              ref={csvRef}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) csvMutation.mutate(f);
              }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            CSV must include every assigned SKU. Columns: SKU, Item Code, Actual Qty, Location
            (optional).
          </p>
        </section>

        <div className="flex flex-wrap gap-2">
          {session.bins.map((bin) => {
            const hasPhoto = session.evidence.some((e) => e.bin_key === bin);
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
              <Button
                type="button"
                variant={binHasPhoto ? "outline" : "default"}
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={photoMutation.isPending}
              >
                {photoMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Camera className="size-4" />
                )}
                {binHasPhoto ? "Replace photo" : "Add shelf photo (required)"}
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png"
                capture="environment"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) photoMutation.mutate({ binKey: activeBin, file: f });
                }}
              />
            </div>

            {binHasPhoto ? (
              <p className="text-xs text-success">Photo evidence attached for this bin.</p>
            ) : (
              <p className="text-xs text-warning">Add a shelf photo before you can submit.</p>
            )}

            <div className="space-y-4">
              {activeLines.map((line) => (
                <LineEditor
                  key={line.id}
                  line={line}
                  saving={saveLineMutation.isPending}
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
          <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
            {validation.missingSkus.length > 0 && (
              <p>Missing counts: {validation.missingSkus.length} SKU(s)</p>
            )}
            {validation.missingBins.length > 0 && (
              <p>Missing bin photos: {validation.missingBins.join(", ")}</p>
            )}
            {validation.missingRca.length > 0 && (
              <p>RCA required for {validation.missingRca.length} variance line(s)</p>
            )}
          </div>
        ) : null}

        <Button
          className="w-full"
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
    </AppShell>
  );
}

function LineEditor({
  line,
  saving,
  onSave,
}: {
  line: DigitalAuditLine;
  saving: boolean;
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
            <Label className="text-xs">Reason for variance</Label>
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

      <Button
        type="button"
        size="sm"
        className="mt-3"
        variant="secondary"
        disabled={saving || actual === "" || Number.isNaN(Number(actual))}
        onClick={() =>
          onSave(Number(actual), hasVariance ? (rca as RcaCode) || null : null, notes)
        }
      >
        Save line
      </Button>
    </div>
  );
}
