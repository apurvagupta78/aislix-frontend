/** Live session recording — MediaRecorder with packet timeline markers. */

export type SessionMarker = {
  packetOrdinal: number;
  offsetMs: number;
  label: string;
};

export type ContinuitySegment = {
  startedAt: number;
  endedAt: number | null;
  interrupted: boolean;
};

export type ContinuityReport = {
  segments: ContinuitySegment[];
  missingSegments: number;
  simulated: boolean;
  message: string;
  markers: SessionMarker[];
  durationMs: number;
  videoBlob: Blob | null;
  mimeType: string;
};

export interface VideoContinuitySession {
  readonly sessionId: string;
  readonly isRecording: boolean;
  start(): Promise<void>;
  markPacket(packetOrdinal: number): void;
  stop(): Promise<ContinuityReport>;
  getPreviewStream(): MediaStream | null;
}

function pickMimeType(): string {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ];
  for (const t of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) return t;
  }
  return "video/webm";
}

/** Real browser MediaRecorder session — uploads for manager replay (Phase 2a). */
export class MediaRecorderVideoSession implements VideoContinuitySession {
  readonly sessionId: string;
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private startedAt = 0;
  private markers: SessionMarker[] = [];
  private segments: ContinuitySegment[] = [];
  private interrupted = false;
  private mimeType: string;
  private visibilityHandler: (() => void) | null = null;

  constructor() {
    this.sessionId = crypto.randomUUID();
    this.mimeType = pickMimeType();
  }

  get isRecording(): boolean {
    return this.recorder?.state === "recording";
  }

  getPreviewStream(): MediaStream | null {
    return this.stream;
  }

  async start(): Promise<void> {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      throw new Error("Camera not available on this device.");
    }
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: true,
    });
    this.chunks = [];
    this.startedAt = Date.now();
    this.segments = [{ startedAt: this.startedAt, endedAt: null, interrupted: false }];
    this.recorder = new MediaRecorder(this.stream, { mimeType: this.mimeType });
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.recorder.start(1000);

    this.visibilityHandler = () => {
      if (document.hidden && this.isRecording) {
        this.interrupted = true;
        const seg = this.segments[this.segments.length - 1];
        if (seg) seg.interrupted = true;
      }
    };
    document.addEventListener("visibilitychange", this.visibilityHandler);
  }

  markPacket(packetOrdinal: number): void {
    if (!this.startedAt) return;
    const offsetMs = Date.now() - this.startedAt;
    this.markers.push({
      packetOrdinal,
      offsetMs,
      label: `Packet ${packetOrdinal}`,
    });
  }

  async stop(): Promise<ContinuityReport> {
    if (this.visibilityHandler) {
      document.removeEventListener("visibilitychange", this.visibilityHandler);
      this.visibilityHandler = null;
    }

    const endedAt = Date.now();
    const seg = this.segments[0];
    if (seg) seg.endedAt = endedAt;

    if (this.recorder && this.recorder.state !== "inactive") {
      await new Promise<void>((resolve) => {
        this.recorder!.onstop = () => resolve();
        this.recorder!.stop();
      });
    }

    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;

    const videoBlob = this.chunks.length > 0 ? new Blob(this.chunks, { type: this.mimeType }) : null;
    const durationMs = this.startedAt ? endedAt - this.startedAt : 0;

    let missingSegments = 0;
    if (this.interrupted) missingSegments += 1;

    return {
      segments: this.segments,
      missingSegments,
      simulated: false,
      message: videoBlob
        ? "Session recorded — available for manager replay."
        : "No video captured — session may have failed.",
      markers: this.markers,
      durationMs,
      videoBlob,
      mimeType: this.mimeType,
    };
  }
}

/** Fallback when camera unavailable — no fake video. */
export class StubVideoContinuityAdapter {
  async startSession(): Promise<string> {
    return crypto.randomUUID();
  }
  linkCapture(_sessionId: string, _timestampMs: number): void {}
  async endSession(_sessionId: string): Promise<ContinuityReport> {
    return {
      segments: [],
      missingSegments: 0,
      simulated: true,
      message: "Video not available — photos-only inspection.",
      markers: [],
      durationMs: 0,
      videoBlob: null,
      mimeType: "",
    };
  }
}
