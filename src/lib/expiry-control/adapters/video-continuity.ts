/** Live session continuity — links close-ups to session timeline. */

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
};

export interface VideoContinuityAdapter {
  startSession(): Promise<string>;
  linkCapture(sessionId: string, timestampMs: number): void;
  endSession(sessionId: string): Promise<ContinuityReport>;
}

export class StubVideoContinuityAdapter implements VideoContinuityAdapter {
  private sessions = new Map<string, ContinuitySegment[]>();

  async startSession(): Promise<string> {
    const id = crypto.randomUUID();
    this.sessions.set(id, [{ startedAt: Date.now(), endedAt: null, interrupted: false }]);
    return id;
  }

  linkCapture(sessionId: string, timestampMs: number): void {
    const segs = this.sessions.get(sessionId);
    if (segs?.length) segs[0]!.endedAt = timestampMs;
  }

  async endSession(sessionId: string): Promise<ContinuityReport> {
    const segs = this.sessions.get(sessionId) ?? [];
    return {
      segments: segs,
      missingSegments: 0,
      simulated: true,
      message: "Video continuity stub — configure real adapter for high-assurance sessions.",
    };
  }
}
