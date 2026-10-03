import { useRef, useState } from "react";

import {
  buildSessionImageHashSet,
  hashFileContent,
  isDuplicateHash,
  validateImageQuality,
} from "@/lib/audit-builder/evidence-validation";

export const DUPLICATE_EVIDENCE_MESSAGE =
  "Duplicate evidence detected. This image was already uploaded — it will not count toward required coverage.";

export type EvidenceUploadOptions = {
  checkQuality: boolean;
  qualityRequirement?: "standard" | "high";
  checkDuplicates: boolean;
  /** "block" rejects a failing photo; "flag" keeps it and returns the reasons for review. */
  onProblem: "block" | "flag";
};

/** Upload one evidence photo with in-app quality and duplicate checks for this session. */
export function useEvidenceUpload(onUploadImage: (file: File) => Promise<string>) {
  const hashByUrlRef = useRef<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);

  async function upload(file: File, opts: EvidenceUploadOptions): Promise<{ url: string; flags: string[] }> {
    setUploading(true);
    try {
      const flags: string[] = [];
      if (opts.checkQuality) {
        const quality = await validateImageQuality(file, opts.qualityRequirement ?? "standard");
        if (!quality.ok) {
          if (opts.onProblem === "block") throw new Error(quality.reason);
          flags.push(quality.reason);
        }
      }
      const fileHash = await hashFileContent(file);
      if (opts.checkDuplicates && isDuplicateHash(fileHash, buildSessionImageHashSet(hashByUrlRef.current))) {
        if (opts.onProblem === "block") throw new Error(DUPLICATE_EVIDENCE_MESSAGE);
        flags.push("Duplicate photo");
      }
      const url = await onUploadImage(file);
      hashByUrlRef.current[url] = fileHash;
      return { url, flags };
    } finally {
      setUploading(false);
    }
  }

  return { upload, uploading };
}
