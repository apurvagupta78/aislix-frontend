import { useRef, useState } from "react";

import {
  buildSessionImageHashSet,
  hashFileContent,
  isDuplicateHash,
  validateImageQuality,
  type ImageQualityChecks,
} from "@/lib/audit-builder/evidence-validation";
import {
  SIMILAR_PHOTO_DISTANCE,
  hammingDistance,
  perceptualHash,
  photoTakenAt,
  photoRulesFromPolicy,
  photoTimingProblem,
  type PhotoRules,
} from "@/lib/audit-engine/photo-rules";
import type { AuditEvidencePolicy } from "@/lib/audit-evidence-policy";

export const DUPLICATE_EVIDENCE_MESSAGE =
  "Duplicate evidence detected. This image was already uploaded — it will not count toward required coverage.";

export const SIMILAR_PHOTO_FLAG = "Looks almost the same as another photo";

export type EvidenceUploadOptions = {
  checkQuality: boolean;
  qualityRequirement?: "standard" | "high";
  /** Which quality problems to test when checkQuality is on (default: all). */
  qualityChecks?: ImageQualityChecks;
  checkDuplicates: boolean;
  /** Flag (never block) photos that look almost the same as one already added. */
  checkSimilar?: boolean;
  /** Capture-time rules (in-app only, maximum age); a photo that breaks them is always rejected. */
  rules?: PhotoRules;
  /** "block" rejects a failing photo; "flag" keeps it and returns the reasons for review. */
  onProblem: "block" | "flag";
};

/** Upload checks from the audit's evidence policy: photo rules and ticked quality checks reject the photo. */
export function uploadOptionsForPolicy(
  policy: Partial<AuditEvidencePolicy> | null | undefined,
  openedAt: string | null,
  extra: { forceQuality?: boolean; forceDuplicates?: boolean; qualityRequirement?: "standard" | "high" } = {},
): EvidenceUploadOptions {
  const checks = new Set(policy?.qualityChecks ?? ["duplicate_hash"]);
  const qualityChecks = extra.forceQuality
    ? { blur: true, dark: true, glare: true }
    : { blur: checks.has("blur"), dark: checks.has("dark"), glare: checks.has("glare") };
  return {
    checkQuality: qualityChecks.blur || qualityChecks.dark || qualityChecks.glare,
    qualityChecks,
    qualityRequirement: extra.qualityRequirement ?? "standard",
    checkDuplicates: checks.has("duplicate_hash") || Boolean(extra.forceDuplicates),
    checkSimilar: checks.has("similarity_review"),
    rules: photoRulesFromPolicy(policy, openedAt),
    onProblem: "block",
  };
}

/** Stores the photo and returns its ref, plus any server review flags. Throws when the server refuses it. */
export type UploadImage = (file: File) => Promise<string | { url: string; flags?: string[] }>;

/** Upload one evidence photo with in-app quality and duplicate checks for this session. */
export function useEvidenceUpload(onUploadImage: UploadImage) {
  const hashByUrlRef = useRef<Record<string, string>>({});
  const similarByUrlRef = useRef<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);

  async function upload(file: File, opts: EvidenceUploadOptions): Promise<{ url: string; flags: string[] }> {
    setUploading(true);
    try {
      const flags: string[] = [];
      if (opts.rules) {
        const problem = photoTimingProblem(await photoTakenAt(file), opts.rules);
        if (problem) throw new Error(problem);
      }
      if (opts.checkQuality) {
        const quality = await validateImageQuality(file, opts.qualityRequirement ?? "standard", opts.qualityChecks);
        if (!quality.ok) {
          if (opts.onProblem === "block") throw new Error(quality.reason);
          flags.push(quality.reason);
        }
      }
      const fileHash = await hashFileContent(file);
      const duplicate = isDuplicateHash(fileHash, buildSessionImageHashSet(hashByUrlRef.current));
      if (opts.checkDuplicates && duplicate) {
        if (opts.onProblem === "block") throw new Error(DUPLICATE_EVIDENCE_MESSAGE);
        flags.push("Duplicate photo");
      }
      const visualHash = opts.checkSimilar ? await perceptualHash(file) : null;
      if (
        visualHash &&
        !duplicate &&
        Object.values(similarByUrlRef.current).some((h) => hammingDistance(h, visualHash) <= SIMILAR_PHOTO_DISTANCE)
      ) {
        flags.push(SIMILAR_PHOTO_FLAG);
      }
      const uploaded = await onUploadImage(file);
      const url = typeof uploaded === "string" ? uploaded : uploaded.url;
      if (typeof uploaded !== "string") {
        for (const f of uploaded.flags ?? []) if (!flags.includes(f)) flags.push(f);
      }
      hashByUrlRef.current[url] = fileHash;
      if (visualHash) similarByUrlRef.current[url] = visualHash;
      return { url, flags };
    } finally {
      setUploading(false);
    }
  }

  return { upload, uploading };
}
