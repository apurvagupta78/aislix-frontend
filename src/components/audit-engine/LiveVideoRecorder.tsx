import { useEffect, useRef, useState } from "react";
import { Circle, Loader2, MapPin, Square, Video } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AISLIX_PALETTE, ACCENT_TINT } from "@/lib/ai-audit/kpi-palette";
import { storeCheckFor, type StoreLocation } from "@/lib/audit-engine/grid-evidence";
import {
  LIVE_VIDEO_BITS_PER_SECOND,
  LIVE_VIDEO_MAX_SECONDS,
  formatGpsPoint,
  formatVideoDuration,
  liveVideoOverlayLines,
  pickRecorderMimeType,
  type SessionVideoMeta,
  type VideoGpsPoint,
} from "@/lib/audit-engine/session-video";

export type LiveVideoResult = { file: File; meta: Omit<SessionVideoMeta, "ref" | "receivedAt"> };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeName?: string | null;
  storeLocation?: StoreLocation | null;
  onRecorded: (result: LiveVideoResult) => void;
};

type GpsStatus = "waiting" | "ok" | "unavailable";

function timezoneName(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    return null;
  }
}

function drawOverlay(ctx: CanvasRenderingContext2D, width: number, height: number, lines: string[]) {
  const font = Math.round(Math.max(13, Math.min(width, height) / 30));
  const pad = Math.round(font * 0.6);
  const lineH = Math.round(font * 1.35);
  const boxH = pad * 2 + lineH * lines.length;
  ctx.fillStyle = "rgba(16, 42, 67, 0.72)";
  ctx.fillRect(0, height - boxH, width, boxH);
  ctx.font = `600 ${font}px system-ui, -apple-system, Segoe UI, sans-serif`;
  ctx.textBaseline = "top";
  lines.forEach((line, i) => {
    ctx.fillStyle = i === 0 ? "#F9A8C9" : "#FFFFFF";
    ctx.fillText(line, pad, height - boxH + pad + i * lineH, width - pad * 2);
  });
}

/**
 * Records the session inside Aislix: camera frames are drawn to a canvas with the date, time
 * and GPS stamped on every frame, and that canvas is what gets recorded.
 */
export function LiveVideoRecorder({ open, onOpenChange, storeName, storeLocation, onRecorded }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const frameRef = useRef<number | null>(null);
  const watchRef = useRef<number | null>(null);
  const gpsRef = useRef<VideoGpsPoint | null>(null);
  const gpsStartRef = useRef<VideoGpsPoint | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const gpsStatusRef = useRef<GpsStatus>("waiting");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [gps, setGps] = useState<VideoGpsPoint | null>(null);
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>("waiting");
  const timezone = timezoneName();

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setCameraError(null);
    setReady(false);
    setElapsed(0);

    if ("geolocation" in navigator) {
      watchRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const fix: VideoGpsPoint = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracyM: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
            at: new Date(pos.timestamp || Date.now()).toISOString(),
          };
          gpsRef.current = fix;
          if (startedAtRef.current != null && !gpsStartRef.current) gpsStartRef.current = fix;
          gpsStatusRef.current = "ok";
          setGps(fix);
          setGpsStatus("ok");
        },
        () => {
          if (!gpsRef.current) {
            gpsStatusRef.current = "unavailable";
            setGpsStatus("unavailable");
          }
        },
        { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
      );
    } else {
      gpsStatusRef.current = "unavailable";
      setGpsStatus("unavailable");
    }

    const openCamera = async () => {
      const video = { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } };
      try {
        return await navigator.mediaDevices.getUserMedia({ video, audio: true });
      } catch {
        return navigator.mediaDevices.getUserMedia({ video, audio: false });
      }
    };

    void (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
          throw new Error("This browser can't record video inside Aislix. Use Chrome or Safari on your phone.");
        }
        const stream = await openCamera();
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const el = videoRef.current;
        if (!el) return;
        el.srcObject = stream;
        await el.play().catch(() => undefined);
        const draw = () => {
          const canvas = canvasRef.current;
          const v = videoRef.current;
          if (canvas && v && v.videoWidth) {
            if (canvas.width !== v.videoWidth) canvas.width = v.videoWidth;
            if (canvas.height !== v.videoHeight) canvas.height = v.videoHeight;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
              const started = startedAtRef.current;
              drawOverlay(
                ctx,
                canvas.width,
                canvas.height,
                liveVideoOverlayLines({
                  now: new Date(),
                  timezone,
                  storeName: storeName ?? null,
                  gps: gpsRef.current,
                  gpsStatus: gpsStatusRef.current,
                  elapsedS: started != null ? (Date.now() - started) / 1000 : null,
                }),
              );
            }
          }
          frameRef.current = requestAnimationFrame(draw);
        };
        frameRef.current = requestAnimationFrame(draw);
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
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.onstop = null;
        recorderRef.current.stop();
      }
      recorderRef.current = null;
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
      if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      startedAtRef.current = null;
      gpsStartRef.current = null;
      setRecording(false);
    };
  }, [open, storeName, timezone]);

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => {
      const started = startedAtRef.current;
      if (started == null) return;
      const seconds = (Date.now() - started) / 1000;
      setElapsed(seconds);
      if (seconds >= LIVE_VIDEO_MAX_SECONDS) stop();
    }, 500);
    return () => window.clearInterval(timer);
  }, [recording]);

  function start() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const mimeType = pickRecorderMimeType((t) => MediaRecorder.isTypeSupported(t));
    const stream = canvas.captureStream(30);
    streamRef.current?.getAudioTracks().forEach((t) => stream.addTrack(t));
    const recorder = new MediaRecorder(stream, {
      ...(mimeType ? { mimeType } : {}),
      videoBitsPerSecond: LIVE_VIDEO_BITS_PER_SECOND,
    });
    chunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const started = startedAtRef.current ?? Date.now();
      const ended = Date.now();
      const type = recorder.mimeType || mimeType || "video/webm";
      const ext = type.includes("mp4") ? "mp4" : "webm";
      const file = new File(chunksRef.current, `aislix-live-${new Date(started).toISOString().replace(/[:.]/g, "-")}.${ext}`, {
        type: type.split(";")[0],
      });
      const gpsEnd = gpsRef.current;
      const gpsStart = gpsStartRef.current ?? gpsEnd;
      const check = gpsEnd ? storeCheckFor(gpsEnd, storeLocation) : null;
      startedAtRef.current = null;
      gpsStartRef.current = null;
      setRecording(false);
      onRecorded({
        file,
        meta: {
          live: true,
          startedAt: new Date(started).toISOString(),
          endedAt: new Date(ended).toISOString(),
          durationS: Math.round((ended - started) / 1000),
          timezone,
          gpsStart,
          gpsEnd,
          storeCheck: check?.storeCheck ?? null,
          storeDistanceM: check?.storeDistanceM ?? null,
        },
      });
      onOpenChange(false);
    };
    recorderRef.current = recorder;
    startedAtRef.current = Date.now();
    gpsStartRef.current = gpsRef.current;
    recorder.start(1000);
    setElapsed(0);
    setRecording(true);
  }

  function stop() {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && recording) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="size-4" /> Record session video
          </DialogTitle>
          <DialogDescription>
            Recorded inside Aislix. The date, time and GPS location are stamped on every frame so the reviewer
            can see it was recorded live.
          </DialogDescription>
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
            {/* Kept rendered (not display:none) so iOS Safari keeps decoding frames for the canvas. */}
            <video ref={videoRef} className="pointer-events-none absolute left-0 top-0 size-px opacity-0" playsInline muted />
            <canvas ref={canvasRef} className="aspect-video w-full object-contain" />
            {!ready ? (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-white">
                <Loader2 className="mr-2 size-4 animate-spin" /> Opening camera…
              </div>
            ) : null}
            {recording ? (
              <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-[#04203F]/85 px-2 py-0.5 text-xs font-medium text-white">
                <Circle className="size-2 animate-pulse fill-[#F9A8C9] text-[#F9A8C9]" /> REC {formatVideoDuration(elapsed)}
              </div>
            ) : null}
          </div>
        )}

        <div
          className="flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 text-xs text-[#04203F]"
          style={{
            background: gps ? ACCENT_TINT.green : ACCENT_TINT.blue,
            borderColor: gps ? AISLIX_PALETTE.green : AISLIX_PALETTE.border,
          }}
        >
          <MapPin className="size-3.5" />
          {gps
            ? `Location ${formatGpsPoint(gps)}`
            : gpsStatus === "waiting"
              ? "Finding your location…"
              : "Location unavailable — allow location for aislix.com. The video will say GPS unavailable."}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] text-[#667085]">Up to {LIVE_VIDEO_MAX_SECONDS / 60} minutes per video.</p>
          <div className="flex gap-2">
            {!recording ? (
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
            ) : null}
            {recording ? (
              <Button type="button" variant="brand" onClick={stop}>
                <Square className="size-4" /> Stop and save
              </Button>
            ) : (
              <Button type="button" variant="brand" disabled={!ready || Boolean(cameraError)} onClick={start}>
                <Circle className="size-4" /> Start recording
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
