import { describe, expect, it } from "vitest";

import {
  EVIDENCE_PRESETS,
  mergeTemplateMinimum,
  policyForLevel,
} from "@/lib/audit-evidence-policy";

describe("audit evidence policy", () => {
  it("does not allow manager selection to weaken template minimums", () => {
    const policy = mergeTemplateMinimum(policyForLevel("basic"), {
      requiredProof: ["context_photo", "live_session_video"],
      minimumPhotos: 3,
      qualityChecks: ["duplicate_hash", "similarity_review"],
    });

    expect(policy.requiredProof).toContain("live_session_video");
    expect(policy.minimumPhotos).toBe(3);
    expect(policy.qualityChecks).toContain("similarity_review");
  });

  it("returns independent copies of presets", () => {
    const policy = policyForLevel("high");
    policy.requiredProof.pop();

    expect(policy.requiredProof).not.toHaveLength(EVIDENCE_PRESETS.high.requiredProof.length);
    expect(EVIDENCE_PRESETS.high.requiredProof).toContain("live_session_video");
  });
});
