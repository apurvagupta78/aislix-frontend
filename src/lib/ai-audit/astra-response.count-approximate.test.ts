import { describe, expect, it } from "vitest";
import { countApproximateGap } from "./astra-response";

describe("countApproximateGap", () => {
  it("returns the largest approximate gap", () => {
    const metrics = {
      astra_cv_validation: {
        count_verification_status: "APPROXIMATE",
        total_actual_facings: { status: "APPROXIMATE", gap: 1 },
        total_actual_visible_units: { status: "APPROXIMATE", gap: 3 },
      },
    };
    expect(countApproximateGap(metrics)).toBe(3);
  });

  it("ignores verified and mismatched scans", () => {
    expect(
      countApproximateGap({ astra_cv_validation: { count_verification_status: "VERIFIED" } }),
    ).toBeNull();
    expect(
      countApproximateGap({
        astra_cv_validation: {
          count_verification_status: "COUNT_MISMATCH",
          total_actual_facings: { status: "COUNT_MISMATCH", gap: 99 },
        },
      }),
    ).toBeNull();
    expect(countApproximateGap(undefined)).toBeNull();
  });
});
