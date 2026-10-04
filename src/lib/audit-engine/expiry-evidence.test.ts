import { describe, expect, it } from "vitest";
import {
  EXPIRY_REMOVAL_PHOTO_KEY,
  EXPIRY_REMOVED_KEY,
  EXPIRY_SCAN_DATE_KEY,
  EXPIRY_SCAN_PHOTO_KEY,
  classifyExpiry,
  describeExpiry,
  normalizeExpiryDate,
  rowExpiryState,
} from "./expiry-evidence";
import { parseExpiryReadPayload } from "./expiry-read-parse";

describe("normalizeExpiryDate", () => {
  it.each([
    ["2026-10-04", "2026-10-04"],
    ["04/10/2026", "2026-10-04"],
    ["4.10.26", "2026-10-04"],
    ["10/2026", "2026-10-31"],
    ["2026-02", "2026-02-28"],
    ["OCT 2026", "2026-10-31"],
    ["12 Sept 2026", "2026-09-12"],
    ["15-Mar-27", "2027-03-15"],
  ])("%s → %s", (raw, iso) => {
    expect(normalizeExpiryDate(raw)).toBe(iso);
  });

  it.each(["", "31/02/2026", "13/2026", "best before", "abc 2026"])("rejects %s", (raw) => {
    expect(normalizeExpiryDate(raw)).toBeNull();
  });
});

describe("classifyExpiry", () => {
  const today = "2026-10-04";
  it("is not expired on the printed day", () => {
    expect(classifyExpiry("2026-10-04", today, 7)).toBe("near_expiry");
  });
  it("is expired the day after", () => {
    expect(classifyExpiry("2026-10-03", today, 7)).toBe("expired");
  });
  it("uses the near-expiry window", () => {
    expect(classifyExpiry("2026-10-11", today, 7)).toBe("near_expiry");
    expect(classifyExpiry("2026-10-12", today, 7)).toBe("ok");
    expect(classifyExpiry("2026-10-05", today, 0)).toBe("ok");
  });
  it("describes days left", () => {
    expect(describeExpiry("2026-10-02", today)).toBe("Expired 2 days ago");
    expect(describeExpiry("2026-10-04", today)).toBe("Expires today");
    expect(describeExpiry("2026-10-05", today)).toBe("1 day left");
  });
});

describe("parseExpiryReadPayload", () => {
  it("keeps a valid date", () => {
    expect(
      parseExpiryReadPayload({ found: true, expiry_date: "2026-12-31", date_text: "EXP 12/2026", date_kind: "expiry", confidence: 0.9 }, "t"),
    ).toEqual({ date: "2026-12-31", rawText: "EXP 12/2026", kind: "expiry", confidence: 0.9, readAt: "t" });
  });
  it("falls back to the printed text", () => {
    expect(parseExpiryReadPayload({ found: true, expiry_date: null, date_text: "EXP 10/2026" }).date).toBe("2026-10-31");
  });
  it("drops unreadable or impossible dates", () => {
    expect(parseExpiryReadPayload({ found: false, expiry_date: "2026-12-31" }).date).toBeNull();
    expect(parseExpiryReadPayload({ found: true, expiry_date: "2026-02-30" }).date).toBeNull();
    expect(parseExpiryReadPayload("garbage").date).toBeNull();
  });
});

describe("rowExpiryState", () => {
  const today = "2026-10-04";
  it("needs a photo and a date", () => {
    expect(rowExpiryState({}, today, 7).dateMissing).toBe(true);
    expect(rowExpiryState({ [EXPIRY_SCAN_DATE_KEY]: "2026-12-01" }, today, 7).dateMissing).toBe(true);
    expect(
      rowExpiryState({ [EXPIRY_SCAN_DATE_KEY]: "2026-12-01", [EXPIRY_SCAN_PHOTO_KEY]: ["p1"] }, today, 7),
    ).toMatchObject({ dateMissing: false, status: "ok", removalMissing: false });
  });

  it("expired items need removal confirmation and a photo", () => {
    const base = { [EXPIRY_SCAN_DATE_KEY]: "2026-09-30", [EXPIRY_SCAN_PHOTO_KEY]: ["p1"] };
    expect(rowExpiryState(base, today, 7)).toMatchObject({ status: "expired", removalMissing: true });
    expect(rowExpiryState({ ...base, [EXPIRY_REMOVED_KEY]: true }, today, 7).removalMissing).toBe(true);
    expect(
      rowExpiryState({ ...base, [EXPIRY_REMOVED_KEY]: true, [EXPIRY_REMOVAL_PHOTO_KEY]: ["p2"] }, today, 7).removalMissing,
    ).toBe(false);
  });
});
