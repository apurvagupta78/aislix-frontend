import { describe, expect, it } from "vitest";

import { captureTimeUtc, evaluateServerPhoto, type PhotoMetrics, type ServerPhotoInput } from "./server-photo-check";

const metrics = (over: Partial<PhotoMetrics> = {}): PhotoMetrics => ({
  sha256: "a".repeat(64),
  bytes: 250_000,
  decodable: true,
  width: 1600,
  height: 1200,
  exif_taken_at: "2026:10:05 10:00:00",
  exif_offset: "+00:00",
  brightness: 120,
  sharpness: 300,
  dhash: "0f0f0f0f0f0f0f0f",
  ...over,
});

const input = (over: Partial<ServerPhotoInput> = {}): ServerPhotoInput => ({
  policy: { qualityChecks: ["blur", "dark", "glare", "duplicate_hash", "similarity_review"], maximumEvidenceAgeMinutes: 60 },
  metrics: metrics(),
  openedAt: new Date("2026-10-05T09:50:00Z"),
  receivedAt: new Date("2026-10-05T10:02:00Z"),
  timeZone: null,
  duplicate: null,
  similar: { count: 0, sameAudit: false },
  ...over,
});

const codes = (i: ServerPhotoInput) => evaluateServerPhoto(i).map((x) => `${x.code}:${x.blocking ? "block" : "flag"}`);

describe("captureTimeUtc", () => {
  it("uses the camera's UTC offset", () => {
    expect(captureTimeUtc("2026:10:05 15:30:00", "+05:30", null)?.toISOString()).toBe("2026-10-05T10:00:00.000Z");
  });
  it("falls back to the device time zone", () => {
    expect(captureTimeUtc("2026:10:05 15:30:00", null, "Asia/Kolkata")?.toISOString()).toBe("2026-10-05T10:00:00.000Z");
  });
  it("is unknown without offset or zone", () => {
    expect(captureTimeUtc("2026:10:05 15:30:00", null, null)).toBeNull();
    expect(captureTimeUtc(null, "+00:00", "UTC")).toBeNull();
  });
});

describe("evaluateServerPhoto", () => {
  it("passes a clean, fresh, new photo", () => {
    expect(codes(input())).toEqual([]);
  });

  it("never blocks when the photo couldn't be measured", () => {
    expect(codes(input({ metrics: null }))).toEqual(["not_checked:flag"]);
  });

  it("refuses dark, glare and blurry photos only when those checks are on", () => {
    expect(codes(input({ metrics: metrics({ brightness: 10 }) }))).toEqual(["dark:block"]);
    expect(codes(input({ metrics: metrics({ brightness: 254 }) }))).toEqual(["glare:block"]);
    expect(codes(input({ metrics: metrics({ sharpness: 5 }) }))).toEqual(["blurry:block"]);
    expect(codes(input({ policy: { qualityChecks: ["duplicate_hash"] }, metrics: metrics({ sharpness: 5, brightness: 10 }) }))).toEqual([]);
  });

  it("leaves a margin over the phone's limits", () => {
    expect(codes(input({ metrics: metrics({ brightness: 33, sharpness: 40 }) }))).toEqual([]);
  });

  it("refuses photos older than the age limit (plus a few minutes' slack)", () => {
    expect(codes(input({ receivedAt: new Date("2026-10-05T11:04:00Z") }))).toEqual([]);
    expect(codes(input({ receivedAt: new Date("2026-10-05T11:10:00Z") }))).toEqual(["too_old:block"]);
  });

  it("refuses photos taken before the audit was opened when in-app only", () => {
    const policy = { qualityChecks: [], captureSource: "in_app_only" as const, maximumEvidenceAgeMinutes: 0 };
    expect(codes(input({ policy, openedAt: new Date("2026-10-05T10:30:00Z"), receivedAt: new Date("2026-10-05T10:31:00Z") }))).toEqual([
      "before_audit:block",
    ]);
    expect(codes(input({ policy, openedAt: new Date("2026-10-05T10:03:00Z") }))).toEqual([]);
  });

  it("flags photos with no capture time instead of refusing them", () => {
    expect(codes(input({ metrics: metrics({ exif_taken_at: null }) }))).toEqual(["no_capture_time:flag"]);
  });

  it("flags a phone clock far ahead of the server", () => {
    expect(codes(input({ receivedAt: new Date("2026-10-05T09:30:00Z") }))).toEqual(["clock_ahead:flag"]);
  });

  it("refuses the same file used before, in this or another audit", () => {
    const issues = evaluateServerPhoto(input({ duplicate: { sameAudit: false } }));
    expect(issues.map((i) => i.code)).toEqual(["duplicate"]);
    expect(issues[0]!.message).toContain("another audit");
  });

  it("flags look-alike photos for review", () => {
    expect(codes(input({ similar: { count: 2, sameAudit: false } }))).toEqual(["similar:flag"]);
    expect(codes(input({ policy: { qualityChecks: [] }, similar: { count: 2, sameAudit: false } }))).toEqual([]);
  });
});
