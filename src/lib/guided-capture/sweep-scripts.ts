import type { AuditRoleTab } from "@/lib/role-audit-ui";

import type { SweepTile } from "./sweep-tracker";

export type SweepScript = { title: string; steps: string[] };

const COMMON_END = "Tap Finish when the last product is on screen.";

export const SWEEP_SCRIPTS: Record<AuditRoleTab, SweepScript> = {
  supermarket: {
    title: "Sweep one bay, left to right",
    steps: [
      "Stand about 1–1.5 m from the shelf so the full height of the bay fits on screen.",
      "Start at the left edge and move slowly to the right, keeping the phone level.",
      COMMON_END,
    ],
  },
  darkstore: {
    title: "Sweep the rack, one shelf level at a time",
    steps: [
      "Hold the phone close enough to read the bin labels.",
      "Move slowly along the shelf from the first bin to the last.",
      COMMON_END,
    ],
  },
  fmcg: {
    title: "Sweep your brand block and its neighbours",
    steps: [
      "Include the competitor products on both sides and any display or shelf strip.",
      "Move slowly left to right with the whole shelf height on screen.",
      COMMON_END,
    ],
  },
  distributor: {
    title: "Sweep the outlet shelf",
    steps: [
      "Cover every shelf where your must-stock products should be.",
      "Move slowly left to right with the whole shelf height on screen.",
      COMMON_END,
    ],
  },
  local: {
    title: "Sweep the shelf wall",
    steps: [
      "Stand where the whole shelf height fits on screen.",
      "Move slowly from one end of the wall to the other.",
      COMMON_END,
    ],
  },
};

export function sweepScript(role: AuditRoleTab | null | undefined): SweepScript {
  return SWEEP_SCRIPTS[role ?? "supermarket"] ?? SWEEP_SCRIPTS.supermarket;
}

export type SweepCaptureMeta = {
  mode: "guided_sweep";
  axis: "x" | "y" | null;
  direction: 1 | -1 | null;
  tiles: Array<Pick<SweepTile, "position" | "sharpness" | "luminance" | "issue">>;
  tracking_gaps: number;
  uncovered_fraction: number;
  duration_s: number;
  frame_width: number | null;
  frame_height: number | null;
  gps: { lat: number; lng: number; accuracy_m: number | null; captured_at: string } | null;
};

/** Photos flagged for the warn-and-retake prompt after a sweep. */
export function sweepWarnings(meta: Pick<SweepCaptureMeta, "tiles" | "tracking_gaps" | "uncovered_fraction">): string[] {
  const warnings: string[] = [];
  meta.tiles.forEach((tile, i) => {
    if (tile.issue === "blurry") warnings.push(`Photo ${i + 1} is blurry.`);
    if (tile.issue === "dark") warnings.push(`Photo ${i + 1} is too dark.`);
    if (tile.issue === "glare") warnings.push(`Photo ${i + 1} has glare.`);
  });
  if (meta.tracking_gaps > 0) {
    warnings.push("You moved too fast in places, so part of the shelf may be missing or repeated.");
  }
  if (meta.uncovered_fraction >= 0.25) {
    warnings.push("The end of the shelf may not be captured — sweep a little further before finishing.");
  }
  return warnings;
}
