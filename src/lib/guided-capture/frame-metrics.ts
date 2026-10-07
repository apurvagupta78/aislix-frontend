/**
 * Pure per-frame measurements for the guided sweep: brightness, sharpness and the
 * intensity profiles used to follow how far the camera has moved between samples.
 */

export type GrayFrame = { width: number; height: number; data: Float32Array };

/** Same thresholds as photo evidence checks (measured on a frame scaled to 320 px). */
export const SWEEP_ANALYSIS_WIDTH = 320;
export const DARK_LUMINANCE = 35;
export const GLARE_LUMINANCE = 245;
export const MIN_SHARPNESS = 45;

export function toGray(rgba: ArrayLike<number>, width: number, height: number): GrayFrame {
  const data = new Float32Array(width * height);
  for (let i = 0, p = 0; i < data.length; i++, p += 4) {
    data[i] = 0.299 * rgba[p]! + 0.587 * rgba[p + 1]! + 0.114 * rgba[p + 2]!;
  }
  return { width, height, data };
}

export function meanLuminance(frame: GrayFrame): number {
  if (!frame.data.length) return 0;
  let sum = 0;
  for (let i = 0; i < frame.data.length; i++) sum += frame.data[i]!;
  return sum / frame.data.length;
}

/** Laplacian variance — low values mean motion blur or out of focus. */
export function sharpness(frame: GrayFrame): number {
  const { width, height, data } = frame;
  let sum = 0;
  let sumSq = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const lap = 4 * data[i]! - data[i - 1]! - data[i + 1]! - data[i - width]! - data[i + width]!;
      sum += lap;
      sumSq += lap * lap;
      count++;
    }
  }
  if (!count) return 0;
  const mean = sum / count;
  return sumSq / count - mean * mean;
}

/** Mean intensity of every column (x profile) or row (y profile). */
export function intensityProfile(frame: GrayFrame, axis: "x" | "y"): Float32Array {
  const { width, height, data } = frame;
  const out = new Float32Array(axis === "x" ? width : height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      out[axis === "x" ? x : y]! += data[y * width + x]!;
    }
  }
  const n = axis === "x" ? height : width;
  for (let i = 0; i < out.length; i++) out[i] = out[i]! / n;
  return out;
}

export type ShiftEstimate = {
  /** Content moved by this many samples; positive = camera moved right/down. */
  shift: number;
  /** Normalised correlation of the overlapping part, -1..1. */
  score: number;
};

/**
 * Finds how far the scene slid between two profiles. When the camera pans right the
 * content moves left, so next[i] ≈ prev[i + shift].
 */
export function estimateShift(prev: ArrayLike<number>, next: ArrayLike<number>, maxShift: number): ShiftEstimate {
  const len = Math.min(prev.length, next.length);
  const limit = Math.max(0, Math.min(Math.floor(maxShift), len - 8));
  let best: ShiftEstimate = { shift: 0, score: -1 };
  for (let s = -limit; s <= limit; s++) {
    const start = Math.max(0, -s);
    const end = Math.min(len, len - s);
    const n = end - start;
    if (n < 8) continue;
    let ma = 0;
    let mb = 0;
    for (let i = start; i < end; i++) {
      ma += prev[i + s]!;
      mb += next[i]!;
    }
    ma /= n;
    mb /= n;
    let cov = 0;
    let va = 0;
    let vb = 0;
    for (let i = start; i < end; i++) {
      const a = prev[i + s]! - ma;
      const b = next[i]! - mb;
      cov += a * b;
      va += a * a;
      vb += b * b;
    }
    const score = va > 0 && vb > 0 ? cov / Math.sqrt(va * vb) : -1;
    if (score > best.score + 1e-9 || (Math.abs(score - best.score) <= 1e-9 && Math.abs(s) < Math.abs(best.shift))) {
      best = { shift: s, score };
    }
  }
  return best;
}

export type FrameIssue = "dark" | "glare" | "blurry";

export function frameIssue(luminance: number, sharp: number): FrameIssue | null {
  if (luminance < DARK_LUMINANCE) return "dark";
  if (luminance > GLARE_LUMINANCE) return "glare";
  if (sharp < MIN_SHARPNESS) return "blurry";
  return null;
}
