/** Exact-file duplicate detection for expiry evidence. */

import { hashFileContent } from "@/lib/audit-builder/evidence-validation";

export type DuplicateCheckResult =
  | { status: "ok"; hash: string }
  | { status: "duplicate_slot"; hash: string; message: string }
  | { status: "cross_observation_flag"; hash: string; message: string };

export async function checkEvidenceDuplicate(
  file: File,
  usedHashesInAttempt: Set<string>,
  usedHashesAcrossInspection?: Set<string>,
): Promise<DuplicateCheckResult> {
  const hash = await hashFileContent(file);

  if (usedHashesInAttempt.has(hash)) {
    return {
      status: "duplicate_slot",
      hash,
      message: "This exact file was already submitted for another packet in this inspection.",
    };
  }

  if (usedHashesAcrossInspection?.has(hash)) {
    return {
      status: "cross_observation_flag",
      hash,
      message: "This image was used elsewhere — flagged for review, not auto-rejected.",
    };
  }

  return { status: "ok", hash };
}
