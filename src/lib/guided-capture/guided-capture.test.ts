import { describe, expect, it } from "vitest";

import { estimateShift, frameIssue, intensityProfile, meanLuminance, sharpness, toGray } from "./frame-metrics";
import { createSweepTracker, type SweepSample } from "./sweep-tracker";

function scene(length: number): number[] {
  return Array.from({ length }, (_, i) => 128 + 60 * Math.sin(i / 3.1) + 40 * Math.cos(i / 7.3) + ((i * 37) % 11));
}

describe("frame metrics", () => {
  it("measures brightness and flags dark, glare and blur", () => {
    const flat = toGray(new Uint8ClampedArray(4 * 16 * 16).fill(20), 16, 16);
    expect(meanLuminance(flat)).toBeCloseTo(20, 0);
    expect(frameIssue(20, 500)).toBe("dark");
    expect(frameIssue(250, 500)).toBe("glare");
    expect(frameIssue(120, 10)).toBe("blurry");
    expect(frameIssue(120, 500)).toBeNull();
    expect(sharpness(flat)).toBe(0);
  });

  it("finds a sharp checkerboard sharper than a flat frame", () => {
    const px = new Uint8ClampedArray(4 * 32 * 32);
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        const v = (x + y) % 2 ? 255 : 0;
        px.set([v, v, v, 255], 4 * (y * 32 + x));
      }
    }
    const frame = toGray(px, 32, 32);
    expect(sharpness(frame)).toBeGreaterThan(1000);
    expect(intensityProfile(frame, "x")).toHaveLength(32);
  });

  it("estimates how far the camera panned", () => {
    const world = scene(400);
    const prev = world.slice(100, 260);
    const next = world.slice(112, 272);
    const est = estimateShift(prev, next, 48);
    expect(est.shift).toBe(12);
    expect(est.score).toBeGreaterThan(0.95);
    expect(estimateShift(next, prev, 48).shift).toBe(-12);
  });
});

describe("sweep tracker", () => {
  const width = 100;
  const sample = (over: Partial<SweepSample> = {}): SweepSample => ({
    width,
    height: 60,
    luminance: 120,
    sharpness: 200,
    profileX: [],
    profileY: [],
    ...over,
  });

  function panRight(perSample: number) {
    return createSweepTracker(() => ({ shift: perSample, score: 0.95 }));
  }

  it("commits one photo per frame-width so photos barely overlap", () => {
    const tracker = panRight(5);
    const commits: number[] = [];
    for (let i = 0; i < 80; i++) {
      const u = tracker.push(sample());
      if (u.commit != null) commits.push(u.commit);
    }
    tracker.finish();
    const positions = tracker.tiles.map((t) => t.position);
    expect(positions.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < positions.length; i++) {
      const gap = positions[i]! - positions[i - 1]!;
      expect(gap).toBeGreaterThanOrEqual(0.9);
      expect(gap).toBeLessThanOrEqual(1.06);
    }
    expect(tracker.tiles[0]!.position).toBeLessThanOrEqual(0.08);
  });

  it("keeps the sharpest frame inside each window", () => {
    const tracker = panRight(2);
    const sharpnessAt = [50, 400, 90];
    sharpnessAt.forEach((s) => tracker.push(sample({ sharpness: s })));
    const result = tracker.finish();
    expect(result.tiles).toHaveLength(1);
    expect(result.tiles[0]!.sharpness).toBe(400);
  });

  it("stops at the photo limit", () => {
    const tracker = createSweepTracker(() => ({ shift: 10, score: 0.95 }), { maxTiles: 3 });
    let done = false;
    for (let i = 0; i < 200 && !done; i++) done = tracker.push(sample()).done;
    expect(done).toBe(true);
    expect(tracker.tiles).toHaveLength(3);
  });

  it("reports too fast when the frames no longer match and does not move", () => {
    const tracker = createSweepTracker(() => ({ shift: 40, score: 0.2 }));
    tracker.push(sample());
    const u = tracker.push(sample());
    expect(u.issue).toBe("too_fast");
    expect(u.position).toBe(0);
    expect(tracker.trackingGaps).toBe(1);
  });

  it("holding still gives a single photo", () => {
    const tracker = createSweepTracker(() => ({ shift: 0, score: 0.99 }));
    for (let i = 0; i < 20; i++) tracker.push(sample({ sharpness: 100 + i }));
    const result = tracker.finish();
    expect(result.tiles).toHaveLength(1);
    expect(result.uncoveredFraction).toBe(0);
  });

  it("works for vertical sweeps and leftward pans", () => {
    const up = createSweepTracker((_a, _b, max) => (max > 25 ? { shift: 0, score: 0.95 } : { shift: -3, score: 0.95 }));
    for (let i = 0; i < 60; i++) up.push(sample());
    up.finish();
    expect(up.tiles.length).toBeGreaterThanOrEqual(2);
  });
});
