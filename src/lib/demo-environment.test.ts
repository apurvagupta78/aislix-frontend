import { describe, expect, it } from "vitest";

import {
  AISLIX_DEMO_ORG_ID,
  canUseDemoPreview,
  decideDemoExperience,
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

  it("never shows demo data unless the toggle is on", () => {
    const org = "11111111-1111-4111-8111-111111111111";
    for (const options of [{}, { previewDemo: false }, { previewDemo: undefined }]) {
      const d = decideDemoExperience(org, false, options);
      expect(d.dataOrgId).toBe(org);
      expect(d.labeledDemo).toBe(false);
    }
    const on = decideDemoExperience(org, false, { previewDemo: true });
    expect(on.dataOrgId).toBe(AISLIX_DEMO_ORG_ID);
    expect(on.labeledDemo).toBe(true);
  });

  it("labels the demo workspace itself as demo", () => {
    const d = decideDemoExperience(AISLIX_DEMO_ORG_ID, false, { previewDemo: false });
    expect(d).toMatchObject({ labeledDemo: true, dataOrgId: AISLIX_DEMO_ORG_ID });
  });

  it("uses fixed demo org id", () => {
    expect(AISLIX_DEMO_ORG_ID).toBe("d0000000-0000-4000-8000-000000000001");
    expect(isDemoOrgId(AISLIX_DEMO_ORG_ID)).toBe(true);
    expect(isDemoOrgId("00000000-0000-0000-0000-000000000001")).toBe(false);
  });
});
