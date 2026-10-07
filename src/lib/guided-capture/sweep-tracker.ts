/**
 * Guided sweep tracker: follows how far the camera has moved and picks one sharp frame per
 * frame-width of movement. The backend sums counts across photos (it expects photos of
 * different shelf sections), so committed frames must not overlap by more than a sliver.
 */

import { frameIssue, type FrameIssue } from "./frame-metrics";

export type SweepAxis = "x" | "y";

export type SweepSample = {
  width: number;
  height: number;
  luminance: number;
  sharpness: number;
  profileX: ArrayLike<number>;
  profileY: ArrayLike<number>;
};

export type SweepTile = {
  id: number;
  /** Position along the sweep, in frame-widths from the first frame. */
  position: number;
  sharpness: number;
  luminance: number;
  issue: FrameIssue | null;
};

export type SweepUpdate = {
  /** Grab the current frame as the best candidate for the next photo (replaces the previous candidate). */
  takeCandidate: number | null;
  /** Candidate id that is now a committed photo. */
  commit: number | null;
  axis: SweepAxis | null;
  position: number;
  /** 0..1 progress from the last photo towards the next one. */
  progressToNext: number;
  tiles: number;
  issue: FrameIssue | "too_fast" | null;
  done: boolean;
};

export type SweepTrackerOptions = {
  maxTiles?: number;
  /** Distance between photos, in frame-widths. Slightly under 1 so there are no gaps. */
  step?: number;
  /** Window around each target where the sharpest frame is kept. */
  bandBefore?: number;
  bandAfter?: number;
  /** Movement (frame-widths) that decides the sweep direction. */
  lockAt?: number;
  /** Largest believable movement between two samples, in frame-widths. */
  maxShiftFraction?: number;
  minMatchScore?: number;
};

const DEFAULTS: Required<SweepTrackerOptions> = {
  maxTiles: 8,
  step: 0.97,
  bandBefore: 0.03,
  bandAfter: 0.08,
  lockAt: 0.06,
  maxShiftFraction: 0.3,
  minMatchScore: 0.6,
};

type Candidate = SweepTile;

export function candidateScore(c: Pick<SweepTile, "sharpness" | "issue">): number {
  if (c.issue === "dark" || c.issue === "glare") return c.sharpness * 0.1;
  return c.sharpness;
}

/** Estimates are injected so the tracker stays testable without real images. */
export type ShiftEstimator = (
  prev: ArrayLike<number>,
  next: ArrayLike<number>,
  maxShift: number,
) => { shift: number; score: number };

export function createSweepTracker(estimate: ShiftEstimator, options: SweepTrackerOptions = {}) {
  const o = { ...DEFAULTS, ...options };
  let prevX: ArrayLike<number> | null = null;
  let prevY: ArrayLike<number> | null = null;
  let cumX = 0;
  let cumY = 0;
  let axis: SweepAxis | null = null;
  let dir = 1;
  let nextId = 1;
  let pending: Candidate | null = null;
  let lastCommitted: number | null = null;
  let target = 0;
  let trackingGaps = 0;
  let lastWidth = 1;
  let lastHeight = 1;
  const tiles: SweepTile[] = [];

  function positionNow(): number {
    if (!axis) return Math.max(Math.abs(cumX) / lastWidth, Math.abs(cumY) / lastHeight);
    return (dir * (axis === "x" ? cumX : cumY)) / (axis === "x" ? lastWidth : lastHeight);
  }

  function commitPending(): number | null {
    if (!pending) return null;
    tiles.push(pending);
    lastCommitted = pending.position;
    target = lastCommitted + o.step;
    const id = pending.id;
    pending = null;
    return id;
  }

  function push(sample: SweepSample): SweepUpdate {
    lastWidth = Math.max(1, sample.width);
    lastHeight = Math.max(1, sample.height);
    let issue: SweepUpdate["issue"] = frameIssue(sample.luminance, sample.sharpness);
    const done = tiles.length >= o.maxTiles;

    if (prevX && prevY && !done) {
      const ex = estimate(prevX, sample.profileX, lastWidth * o.maxShiftFraction);
      const ey = estimate(prevY, sample.profileY, lastHeight * o.maxShiftFraction);
      const lost =
        (axis === "x" && (ex.score < o.minMatchScore || Math.abs(ex.shift) >= lastWidth * o.maxShiftFraction)) ||
        (axis === "y" && (ey.score < o.minMatchScore || Math.abs(ey.shift) >= lastHeight * o.maxShiftFraction)) ||
        (!axis && ex.score < o.minMatchScore && ey.score < o.minMatchScore);
      if (lost) {
        trackingGaps++;
        issue = "too_fast";
      } else {
        if (ex.score >= o.minMatchScore) cumX += ex.shift;
        if (ey.score >= o.minMatchScore) cumY += ey.shift;
        if (!axis) {
          const fx = Math.abs(cumX) / lastWidth;
          const fy = Math.abs(cumY) / lastHeight;
          if (Math.max(fx, fy) >= o.lockAt) {
            axis = fx >= fy ? "x" : "y";
            dir = Math.sign(axis === "x" ? cumX : cumY) || 1;
          }
        }
      }
    }
    prevX = sample.profileX;
    prevY = sample.profileY;

    const position = positionNow();
    let takeCandidate: number | null = null;
    let commit: number | null = null;

    if (!done && issue !== "too_fast") {
      const inBand = position >= target - o.bandBefore && position <= target + o.bandAfter;
      if (inBand) {
        const candidate: Candidate = {
          id: nextId,
          position,
          sharpness: sample.sharpness,
          luminance: sample.luminance,
          issue: frameIssue(sample.luminance, sample.sharpness),
        };
        if (!pending || candidateScore(candidate) > candidateScore(pending)) {
          nextId++;
          pending = candidate;
          takeCandidate = candidate.id;
        }
      } else if (position > target + o.bandAfter) {
        if (!pending) {
          pending = {
            id: nextId++,
            position,
            sharpness: sample.sharpness,
            luminance: sample.luminance,
            issue: frameIssue(sample.luminance, sample.sharpness),
          };
          takeCandidate = pending.id;
        }
        commit = commitPending();
      }
    }

    const from = lastCommitted ?? 0;
    const span = lastCommitted == null ? o.bandAfter : o.step;
    const progressToNext = Math.max(0, Math.min(1, (position - from) / span));

    return {
      takeCandidate,
      commit,
      axis,
      position,
      progressToNext,
      tiles: tiles.length,
      issue,
      done: tiles.length >= o.maxTiles,
    };
  }

  /**
   * Ends the sweep. The waiting candidate becomes the last photo only when it sits on its
   * target, so finishing early never adds an overlapping frame.
   */
  function finish(): { commit: number | null; uncoveredFraction: number; tiles: SweepTile[]; trackingGaps: number } {
    const commit = pending ? commitPending() : null;
    const uncoveredFraction = lastCommitted == null ? 0 : Math.max(0, positionNow() - lastCommitted);
    return { commit, uncoveredFraction, tiles: [...tiles], trackingGaps };
  }

  return {
    push,
    finish,
    get tiles() {
      return [...tiles];
    },
    get trackingGaps() {
      return trackingGaps;
    },
    get axis() {
      return axis;
    },
    get direction(): 1 | -1 | null {
      return axis ? (dir < 0 ? -1 : 1) : null;
    },
  };
}

export type SweepTracker = ReturnType<typeof createSweepTracker>;

export function sweepIssueMessage(issue: SweepUpdate["issue"]): string | null {
  switch (issue) {
    case "dark":
      return "Too dark — turn on the torch or move closer to the light.";
    case "glare":
      return "Too much glare — tilt the phone slightly.";
    case "blurry":
      return "Hold steadier — the picture is blurry.";
    case "too_fast":
      return "Too fast — go back a little and move slower.";
    default:
      return null;
  }
}
