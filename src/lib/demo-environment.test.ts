import { describe, expect, it } from "vitest";

import {
  AISLIX_DEMO_ORG_ID,
  canUseDemoPreview,
  isDemoOrgId,
  shouldShowDemoPreviewCta,
} from "@/lib/demo-environment";

describe("demo preview eligibility", () => {
  it("allows any signed-in email (and null)", () => {
    expect(canUseDemoPreview("apurv@aislix.com")).toBe(true);
    expect(canUseDemoPreview("hello@aislix.com")).toBe(true);
    expect(canUseDemoPreview(null)).toBe(true);
  });

  it("shows preview overlay CTA only when previewDemo is true", () => {
    expect(shouldShowDemoPreviewCta(true)).toBe(true);
    expect(shouldShowDemoPreviewCta(false)).toBe(false);
    expect(shouldShowDemoPreviewCta(undefined)).toBe(false);
  });

  it("uses fixed demo org id", () => {
    expect(AISLIX_DEMO_ORG_ID).toBe("d0000000-0000-4000-8000-000000000001");
    expect(isDemoOrgId(AISLIX_DEMO_ORG_ID)).toBe(true);
    expect(isDemoOrgId("00000000-0000-0000-0000-000000000001")).toBe(false);
  });
});
