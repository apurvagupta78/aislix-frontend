import { describe, expect, it } from "vitest";

import {
  formatVideoDuration,
  liveVideoOverlayLines,
  parseSessionVideoMeta,
  pickRecorderMimeType,
  upsertSessionVideoMeta,
  type SessionVideoMeta,
} from "@/lib/audit-engine/session-video";

const live: SessionVideoMeta = {
  ref: "scan-images:org/custom-audit/a/video-1.webm",
  live: true,
  startedAt: "2026-10-05T08:30:00.000Z",
  endedAt: "2026-10-05T08:32:05.000Z",
  durationS: 125,
  timezone: "Asia/Kolkata",
  gpsStart: { lat: 28.6139, lng: 77.209, accuracyM: 12, at: "2026-10-05T08:30:01.000Z" },
  gpsEnd: { lat: 28.614, lng: 77.2091, accuracyM: 9, at: "2026-10-05T08:32:04.000Z" },
  storeCheck: "at_store",
  storeDistanceM: 40,
  receivedAt: "2026-10-05T08:32:30.000Z",
};

describe("session video metadata", () => {
  it("round-trips through the saved JSON and drops malformed entries", () => {
    const saved = JSON.stringify([live, { live: true }, null, { ref: "x", live: "yes", storeCheck: "moon" }]);
    const parsed = parseSessionVideoMeta(saved);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toEqual(live);
    expect(parsed[1]).toMatchObject({ ref: "x", live: false, storeCheck: null, gpsStart: null });
    expect(parseSessionVideoMeta("not json")).toEqual([]);
    expect(parseSessionVideoMeta(undefined)).toEqual([]);
  });

  it("replaces the entry for the same video", () => {
    const uploaded = { ...live, live: false, receivedAt: "later" };
    expect(upsertSessionVideoMeta([live], uploaded)).toEqual([uploaded]);
  });

  it("stamps brand, store, time, GPS and elapsed time on each frame", () => {
    const lines = liveVideoOverlayLines({
      now: new Date("2026-10-05T08:31:00.000Z"),
      timezone: "Asia/Kolkata",
      storeName: "Store 12",
      gps: live.gpsStart,
      gpsStatus: "ok",
      elapsedS: 61,
    });
    expect(lines[0]).toBe("Aislix live audit · Store 12 · REC 1:01");
    expect(lines[1]).toContain("Asia/Kolkata");
    expect(lines[2]).toBe("GPS 28.61390, 77.20900 ±12 m");
    expect(
      liveVideoOverlayLines({ now: new Date(), timezone: null, storeName: null, gps: null, gpsStatus: "unavailable", elapsedS: null })[2],
    ).toBe("GPS unavailable");
  });

  it("formats durations and picks a supported recording type", () => {
    expect(formatVideoDuration(0)).toBe("0:00");
    expect(formatVideoDuration(125)).toBe("2:05");
    expect(pickRecorderMimeType((t) => t.startsWith("video/webm"))).toBe("video/webm;codecs=vp9,opus");
    expect(pickRecorderMimeType((t) => t === "video/mp4")).toBe("video/mp4");
    expect(pickRecorderMimeType(() => false)).toBeNull();
  });
});
