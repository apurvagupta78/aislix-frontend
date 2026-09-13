/**
 * Slim landing demo payloads before persisting for public share links.
 * Strips multi-MB image/CSV blobs — the share page renders KPIs and inventory.
 */

import type { LandingScanResult } from "@/lib/landing-audit-api";

export function slimLandingSnapshot(result: LandingScanResult): Record<string, unknown> {
  const {
    annotated_image_base64: _a,
    original_image_base64: _o,
    csv_base64: _c,
    ...rest
  } = result;
  return JSON.parse(JSON.stringify(rest)) as Record<string, unknown>;
}
