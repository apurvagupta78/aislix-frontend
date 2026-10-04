import { describe, expect, it } from "vitest";

import {
  hammingDistance,
  photoRulesFromPolicy,
  photoTimingProblem,
  readExifTakenAt,
} from "@/lib/audit-engine/photo-rules";

/** Minimal big-endian JPEG with one IFD0 DateTime (0x0132) tag. */
function jpegWithExifDate(text: string): ArrayBuffer {
  const date = [...text].map((c) => c.charCodeAt(0)).concat(0);
  const tiff = [
    0x4d,
    0x4d,
    0x00,
    0x2a,
    0x00,
    0x00,
    0x00,
    0x08,
    0x00,
    0x01,
    0x01,
    0x32,
    0x00,
    0x02,
    0x00,
    0x00,
    0x00,
    date.length,
    0x00,
    0x00,
    0x00,
    26,
    0x00,
    0x00,
    0x00,
    0x00,
    ...date,
  ];
  const size = 2 + 6 + tiff.length;
  const bytes = [
    0xff,
    0xd8,
    0xff,
    0xe1,
    size >> 8,
    size & 0xff,
    0x45,
    0x78,
    0x69,
    0x66,
    0x00,
    0x00,
    ...tiff,
    0xff,
    0xd9,
  ];
  return new Uint8Array(bytes).buffer;
}

describe("photo rules", () => {
  it("reads the capture time from EXIF and ignores files without it", () => {
    const taken = readExifTakenAt(jpegWithExifDate("2026:10:04 09:30:00"));
    expect(taken).toEqual(new Date(2026, 9, 4, 9, 30, 0));
    expect(readExifTakenAt(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]).buffer)).toBeNull();
    expect(readExifTakenAt(new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer)).toBeNull();
  });

  it("rejects photos older than the age limit", () => {
    const now = new Date("2026-10-04T10:00:00Z");
    const rules = photoRulesFromPolicy({ maximumEvidenceAgeMinutes: 15 }, null);
    expect(photoTimingProblem(new Date("2026-10-04T09:50:00Z"), rules, now)).toBeNull();
    expect(photoTimingProblem(new Date("2026-10-04T09:00:00Z"), rules, now)).toContain(
      "within the last 15 minutes",
    );
    expect(photoTimingProblem(null, rules, now)).toBeNull();
    expect(
      photoTimingProblem(new Date("2020-01-01T00:00:00Z"), photoRulesFromPolicy({}, null), now),
    ).toBeNull();
  });

  it("in-app only accepts photos taken after the audit was opened", () => {
    const now = new Date("2026-10-04T10:00:00Z");
    const rules = photoRulesFromPolicy({ captureSource: "in_app_only" }, "2026-10-04T09:40:00Z");
    expect(photoTimingProblem(new Date("2026-10-04T09:45:00Z"), rules, now)).toBeNull();
    expect(photoTimingProblem(new Date("2026-10-04T09:39:00Z"), rules, now)).toBeNull();
    expect(photoTimingProblem(new Date("2026-10-04T09:30:00Z"), rules, now)).toContain(
      "camera now",
    );
    expect(photoTimingProblem(null, rules, now)).toContain("couldn't tell");
    const notOpened = photoRulesFromPolicy({ captureSource: "in_app_only" }, null);
    expect(photoTimingProblem(new Date("2026-10-04T09:55:00Z"), notOpened, now)).toBeNull();
    expect(photoTimingProblem(new Date("2026-10-04T09:30:00Z"), notOpened, now)).toContain(
      "camera now",
    );
  });

  it("measures how different two photo hashes are", () => {
    expect(hammingDistance("ff00", "ff00")).toBe(0);
    expect(hammingDistance("ff00", "fe01")).toBe(2);
  });
});
