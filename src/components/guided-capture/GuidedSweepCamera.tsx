import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, Flashlight, Loader2, MoveRight, RotateCcw, ScanLine, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AISLIX_PALETTE, ACCENT_TINT } from "@/lib/ai-audit/kpi-palette";
import { readDeviceLocation } from "@/lib/device-location";
import {
  SWEEP_ANALYSIS_WIDTH,
  createSweepTracker,
  estimateShift,
  frameIssue,
  intensityProfile,
  meanLuminance,
  sharpness,
  sweepIssueMessage,
  sweepScript,
  sweepWarnings,
  toGray,
  type SweepCaptureMeta,
  type SweepTracker,
  type SweepUpdate,
} from "@/lib/guided-capture";
import type { AuditRoleTab } from "@/lib/role-audit-ui";

export type GuidedSweepResult = { files: File[]; meta: SweepCaptureMeta };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role?: AuditRoleTab | null;
  /** Photos still allowed in this audit. */
  maxPhotos: number;
  onComplete: (result: GuidedSweepResult) => void;
};

type Phase = "aim" | "sweeping" | "finishing" | "review";

const SAMPLE_MS = 100;
const JPEG_QUALITY = 0.9;

function grabFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement): Promise<Blob | null> {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
}

export function GuidedSweepCamera({ open, onOpenChange, role, maxPhotos, onComplete }: Props) {
  const script = sweepScript(role);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const smallCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fullCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const trackerRef = useRef<SweepTracker | null>(null);
  const blobsRef = useRef(new Map<number, Promise<Blob | null>>());
  const committedRef = useRef<number[]>([]);
  const pendingIdRef = useRef<number | null>(null);
  const phaseRef = useRef<Phase>("aim");
  const startedAtRef = useRef<number | null>(null);
  const gpsRef = useRef<SweepCaptureMeta["gps"]>(null);
  const thumbsRef = useRef<string[]>([]);

  const [phase, setPhaseState] = useState<Phase>("aim");
  const [ready, setReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [update, setUpdate] = useState<SweepUpdate | null>(null);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [result, setResult] = useState<GuidedSweepResult | null>(null);

  const limit = Math.max(1, maxPhotos);

  const setPhase = (next: Phase) => {
    phaseRef.current = next;
    setPhaseState(next);
  };

  const clearCapture = useCallback(() => {
    thumbsRef.current.forEach((url) => URL.revokeObjectURL(url));
    thumbsRef.current = [];
    setThumbs([]);
    blobsRef.current.clear();
    committedRef.current = [];
    pendingIdRef.current = null;
    trackerRef.current = null;
    startedAtRef.current = null;
    setUpdate(null);
    setResult(null);
  }, []);

  const addThumb = useCallback((id: number) => {
    void blobsRef.current.get(id)?.then((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      thumbsRef.current = [...thumbsRef.current, url];
      setThumbs(thumbsRef.current);
    });
  }, []);

  const finish = useCallback(async () => {
    const tracker = trackerRef.current;
    if (!tracker || phaseRef.current !== "sweeping") return;
    setPhase("finishing");
    const end = tracker.finish();
    if (end.commit != null) {
      committedRef.current.push(end.commit);
      addThumb(end.commit);
    }
    const blobs = await Promise.all(committedRef.current.map((id) => blobsRef.current.get(id) ?? null));
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const files = blobs
      .filter((b): b is Blob => Boolean(b))
      .map((b, i) => new File([b], `aislix-sweep-${stamp}-${i + 1}.jpg`, { type: "image/jpeg" }));
    const video = videoRef.current;
    const meta: SweepCaptureMeta = {
      mode: "guided_sweep",
      axis: tracker.axis,
      direction: tracker.direction,
      tiles: end.tiles.map(({ position, sharpness: s, luminance, issue }) => ({
        position: Math.round(position * 100) / 100,
        sharpness: Math.round(s),
        luminance: Math.round(luminance),
        issue,
      })),
      tracking_gaps: end.trackingGaps,
      uncovered_fraction: Math.round(end.uncoveredFraction * 100) / 100,
      duration_s: startedAtRef.current ? Math.round((Date.now() - startedAtRef.current) / 1000) : 0,
      frame_width: video?.videoWidth || null,
      frame_height: video?.videoHeight || null,
      gps: gpsRef.current,
    };
    setResult({ files, meta });
    setPhase("review");
  }, [addThumb]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setPhase("aim");
    setReady(false);
    setCameraError(null);
    setHint(null);
    setTorchOn(false);
    clearCapture();
    smallCanvasRef.current ??= document.createElement("canvas");
    fullCanvasRef.current ??= document.createElement("canvas");

    readDeviceLocation()
      .then((loc) => {
        gpsRef.current = { lat: loc.lat, lng: loc.lng, accuracy_m: loc.accuracyM, captured_at: loc.capturedAt };
      })
      .catch(() => {
        gpsRef.current = null;
      });

    void (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("This browser can't open the camera inside Aislix. Use Chrome or Safari on your phone.");
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const track = stream.getVideoTracks()[0];
        const caps = (track?.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean };
        setTorchAvailable(Boolean(caps.torch));
        const el = videoRef.current;
        if (!el) return;
        el.srcObject = stream;
        await el.play().catch(() => undefined);
        setReady(true);
      } catch (e) {
        const name = e instanceof DOMException ? e.name : "";
        setCameraError(
          name === "NotAllowedError"
            ? "Camera access was blocked. Allow the camera for aislix.com in your browser settings, then try again."
            : e instanceof Error
              ? e.message
              : "Could not open the camera.",
        );
      }
    })();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      thumbsRef.current.forEach((url) => URL.revokeObjectURL(url));
      thumbsRef.current = [];
    };
  }, [open, clearCapture]);

  useEffect(() => {
    if (!open || !ready) return;
    const timer = window.setInterval(() => {
      const video = videoRef.current;
      const small = smallCanvasRef.current;
      const full = fullCanvasRef.current;
      if (!video?.videoWidth || !small || !full) return;
      const current = phaseRef.current;
      if (current === "finishing" || current === "review") return;

      const w = SWEEP_ANALYSIS_WIDTH;
      const h = Math.max(1, Math.round((video.videoHeight * w) / video.videoWidth));
      small.width = w;
      small.height = h;
      const ctx = small.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, w, h);
      const gray = toGray(ctx.getImageData(0, 0, w, h).data, w, h);
      const lum = meanLuminance(gray);
      const sharp = sharpness(gray);

      if (current === "aim") {
        setHint(sweepIssueMessage(frameIssue(lum, sharp)));
        return;
      }
      const tracker = trackerRef.current;
      if (!tracker) return;
      const u = tracker.push({
        width: w,
        height: h,
        luminance: lum,
        sharpness: sharp,
        profileX: intensityProfile(gray, "x"),
        profileY: intensityProfile(gray, "y"),
      });
      if (u.takeCandidate != null) {
        const previous = pendingIdRef.current;
        if (previous != null && !committedRef.current.includes(previous)) blobsRef.current.delete(previous);
        pendingIdRef.current = u.takeCandidate;
        blobsRef.current.set(u.takeCandidate, grabFrame(video, full));
      }
      if (u.commit != null) {
        committedRef.current.push(u.commit);
        if (pendingIdRef.current === u.commit) pendingIdRef.current = null;
        addThumb(u.commit);
      }
      setUpdate(u);
      setHint(sweepIssueMessage(u.issue));
      if (u.done) void finish();
    }, SAMPLE_MS);
    return () => window.clearInterval(timer);
  }, [open, ready, addThumb, finish]);

  function startSweep() {
    clearCapture();
    trackerRef.current = createSweepTracker(estimateShift, { maxTiles: limit });
    startedAtRef.current = Date.now();
    setPhase("sweeping");
  }

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setTorchOn(next);
    } catch {
      setTorchAvailable(false);
    }
  }

  function confirmPhotos() {
    if (!result?.files.length) return;
    onComplete(result);
    onOpenChange(false);
  }

  const warnings = result ? sweepWarnings(result.meta) : [];
  const photosTaken = update?.tiles ?? 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && (phase === "sweeping" || phase === "finishing")) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#04203F]">
            <ScanLine className="size-4" /> Guided sweep
          </DialogTitle>
          <DialogDescription>{script.title}</DialogDescription>
        </DialogHeader>

        {cameraError ? (
          <p
            className="rounded-xl border px-4 py-3 text-sm text-[#04203F]"
            style={{ background: AISLIX_PALETTE.pink, borderColor: AISLIX_PALETTE.border }}
          >
            {cameraError}
          </p>
        ) : (
          <div className="relative overflow-hidden rounded-xl border border-[#D9E2E8] bg-black">
            <video
              ref={videoRef}
              className={phase === "review" ? "hidden" : "aspect-video w-full object-contain"}
              playsInline
              muted
            />
            {!ready ? (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-white">
                <Loader2 className="mr-2 size-4 animate-spin" /> Opening camera…
              </div>
            ) : null}
            {ready && phase !== "review" && hint ? (
              <div className="absolute inset-x-2 top-2 flex items-center gap-2 rounded-lg bg-[#04203F]/85 px-3 py-1.5 text-xs font-medium text-white">
                <AlertTriangle className="size-3.5 text-[#FFEAF1]" /> {hint}
              </div>
            ) : null}
            {phase === "sweeping" ? (
              <div className="absolute inset-x-2 bottom-2 space-y-1 rounded-lg bg-[#04203F]/85 px-3 py-2 text-xs text-white">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 font-medium">
                    <MoveRight className="size-3.5" /> Keep moving slowly
                  </span>
                  <span className="tabular-nums">
                    Photo {photosTaken} of up to {limit}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/20">
                  <div
                    className="h-full rounded-full transition-[width] duration-150"
                    style={{ width: `${Math.round((update?.progressToNext ?? 0) * 100)}%`, background: AISLIX_PALETTE.green }}
                  />
                </div>
              </div>
            ) : null}
            {phase === "review" ? (
              <div className="grid grid-cols-2 gap-2 bg-white p-2 sm:grid-cols-4">
                {thumbs.map((url, i) => (
                  <figure key={url} className="relative overflow-hidden rounded-lg border border-[#D9E2E8]">
                    <img src={url} alt={`Sweep photo ${i + 1}`} className="h-24 w-full object-cover" />
                    <figcaption className="absolute left-1 top-1 rounded bg-[#04203F]/80 px-1.5 text-[10px] font-semibold text-white">
                      {i + 1}
                    </figcaption>
                  </figure>
                ))}
              </div>
            ) : null}
          </div>
        )}

        {phase === "aim" && !cameraError ? (
          <ol
            className="space-y-1 rounded-xl border border-[#D9E2E8] bg-white px-4 py-3 text-xs text-[#04203F]"
          >
            {script.steps.map((step, i) => (
              <li key={step}>
                <span className="font-semibold">{i + 1}.</span> {step}
              </li>
            ))}
          </ol>
        ) : null}

        {phase === "sweeping" && thumbs.length ? (
          <div className="flex gap-1.5 overflow-x-auto">
            {thumbs.map((url, i) => (
              <img key={url} src={url} alt={`Photo ${i + 1}`} className="h-12 w-16 shrink-0 rounded-md border border-[#D9E2E8] object-cover" />
            ))}
          </div>
        ) : null}

        {phase === "review" ? (
          <div
            className="space-y-1 rounded-xl border px-4 py-3 text-xs text-[#04203F]"
            style={{
              background: warnings.length ? AISLIX_PALETTE.pink : ACCENT_TINT.green,
              borderColor: warnings.length ? AISLIX_PALETTE.border : AISLIX_PALETTE.green,
            }}
          >
            <p className="font-semibold">
              {result?.files.length
                ? `${result.files.length} photo${result.files.length === 1 ? "" : "s"} captured, side by side without overlap.`
                : "No photo was captured. Try the sweep again."}
            </p>
            {warnings.map((w) => (
              <p key={w}>{w} You can redo the sweep or continue.</p>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            {torchAvailable && phase !== "review" ? (
              <Button type="button" variant="outline" size="sm" onClick={() => void toggleTorch()}>
                <Flashlight className="size-4" /> {torchOn ? "Torch off" : "Torch on"}
              </Button>
            ) : null}
          </div>
          <div className="flex gap-2">
            {phase === "aim" ? (
              <>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="button" variant="brand" disabled={!ready || Boolean(cameraError)} onClick={startSweep}>
                  <ScanLine className="size-4" /> Start sweep
                </Button>
              </>
            ) : null}
            {phase === "sweeping" ? (
              <Button type="button" variant="brand" onClick={() => void finish()}>
                <Square className="size-4" /> Finish
              </Button>
            ) : null}
            {phase === "finishing" ? (
              <Button type="button" variant="brand" disabled>
                <Loader2 className="size-4 animate-spin" /> Preparing photos…
              </Button>
            ) : null}
            {phase === "review" ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    clearCapture();
                    setPhase("aim");
                  }}
                >
                  <RotateCcw className="size-4" /> Redo sweep
                </Button>
                <Button type="button" variant="brand" disabled={!result?.files.length} onClick={confirmPhotos}>
                  <Check className="size-4" /> Use {result?.files.length ?? 0} photo{result?.files.length === 1 ? "" : "s"}
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
