import { describe, expect, it } from "vitest";

import { AISLIX_DEMO_ORG_ID, canUseDemoPreview } from "@/lib/demo-environment";

describe("demo preview eligibility", () => {
  it("allows apurv@aislix.com", () => {
    expect(canUseDemoPreview("apurv@aislix.com")).toBe(true);
  });

  it("denies other emails", () => {
    expect(canUseDemoPreview("hello@aislix.com")).toBe(false);
    expect(canUseDemoPreview(null)).toBe(false);
  });

  it("uses fixed demo org id", () => {
    expect(AISLIX_DEMO_ORG_ID).toBe("d0000000-0000-4000-8000-000000000001");
  });
});
