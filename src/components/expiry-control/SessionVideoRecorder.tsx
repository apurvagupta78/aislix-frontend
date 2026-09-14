import { useEffect, useRef } from "react";
import { Video, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MediaRecorderVideoSession } from "@/lib/expiry-control/adapters/video-continuity";

type Props = {
  session: MediaRecorderVideoSession | null;
  recording: boolean;
  markerCount: number;
  className?: string;
};

export function SessionVideoRecorder({ session, recording, markerCount, className }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    const stream = session?.getPreviewStream() ?? null;
    if (!el) return;
    el.srcObject = stream;
    if (stream) void el.play().catch(() => undefined);
    return () => {
      el.srcObject = null;
    };
  }, [session, recording]);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="relative overflow-hidden rounded-xl border bg-black">
        <video ref={videoRef} className="aspect-video w-full object-cover" playsInline muted autoPlay />
        {recording ? (
          <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-red-600/90 px-2 py-0.5 text-xs font-medium text-white">
            <Circle className="h-2 w-2 fill-current animate-pulse" /> REC
          </div>
        ) : null}
      </div>
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <Video className="h-3.5 w-3.5" />
        {recording
          ? `Recording session — ${markerCount} packet marker${markerCount === 1 ? "" : "s"} linked`
          : "Start session to record inspection video for manager review."}
      </p>
    </div>
  );
}
