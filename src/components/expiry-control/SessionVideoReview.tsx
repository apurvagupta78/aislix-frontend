import { useRef } from "react";
import { AlertTriangle, Video } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { ExpiryAttemptEvidence } from "@/lib/expiry-control";

type Props = {
  evidence: ExpiryAttemptEvidence;
};

function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

export function SessionVideoReview({ evidence }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const session = evidence.sessionVideo;

  if (!session) {
    return (
      <Alert>
        <AlertDescription className="text-sm">
          {evidence.assuranceFallback
            ? "Lower-assurance fallback — no session video. Review packet photos."
            : "No session video for this inspection."}
        </AlertDescription>
      </Alert>
    );
  }

  const meta = session.device_metadata as {
    continuity?: { missingSegments?: number; interrupted?: boolean; durationMs?: number };
    markers?: { packetOrdinal: number; offsetMs: number; label: string }[];
  };

  const markers = meta.markers ?? [];
  const missing = meta.continuity?.missingSegments ?? 0;

  function seekTo(ms: number) {
    const el = videoRef.current;
    if (!el) return;
    el.currentTime = ms / 1000;
    void el.play().catch(() => undefined);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Video className="h-4 w-4" /> Session recording
        {session.evidence_status === "uploaded" ? (
          <span className="text-xs font-normal text-muted-foreground">— watch later replay</span>
        ) : null}
      </div>
      <video
        ref={videoRef}
        src={session.signedUrl}
        controls
        className="w-full rounded-xl border bg-black aspect-video"
        playsInline
      />
      {missing > 0 ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Recording gap detected ({missing} interruption{missing === 1 ? "" : "s"}) — review packet photos
            carefully.
          </AlertDescription>
        </Alert>
      ) : null}
      {markers.length > 0 ? (
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Packet timeline</p>
          <div className="flex flex-wrap gap-2">
            {markers.map((m) => (
              <Button key={`${m.packetOrdinal}-${m.offsetMs}`} size="sm" variant="outline" onClick={() => seekTo(m.offsetMs)}>
                {m.label} @ {formatMs(m.offsetMs)}
              </Button>
            ))}
          </div>
        </div>
      ) : null}
      {meta.continuity?.durationMs ? (
        <p className="text-xs text-muted-foreground">Duration: {formatMs(meta.continuity.durationMs)}</p>
      ) : null}
    </div>
  );
}
