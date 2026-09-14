import { describe, expect, it } from "vitest";
import { classifyByPolicy, parseRetailDate } from "./date-policy";

describe("parseRetailDate", () => {
  it("parses ISO dates", () => {
    expect(parseRetailDate("2026-12-01")).toMatchObject({ ok: true, date: "2026-12-01" });
  });
});

describe("classifyByPolicy", () => {
  it("marks past dates expired", () => {
    expect(
      classifyByPolicy({
        confirmedDate: "2020-01-01",
        dateType: "expiry",
        unreadable: false,
        referenceDate: "2026-01-01",
      }),
    ).toBe("expired");
  });

  it("marks unreadable unresolved", () => {
    expect(
      classifyByPolicy({
        confirmedDate: null,
        dateType: "unknown",
        unreadable: true,
      }),
    ).toBe("unresolved");
  });

  it("marks manufacturing without shelf-life rule unresolved", () => {
    expect(
      classifyByPolicy({
        confirmedDate: "2026-01-01",
        dateType: "manufacturing",
        unreadable: false,
        hasShelfLifeRule: false,
      }),
    ).toBe("unresolved");
  });
});
