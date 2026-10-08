import { AISLIX_PALETTE, CHART_SERIES } from "@/lib/ai-audit/kpi-palette";

/**
 * Aislix chart + operating-model colors — hex from the official palette only.
 */
export const AISLIX = {
  bg: "#F2F6F9",
  primary: "#04203F",
  secondary: "#557187",
  border: "#E7EDF0",
  surface: "#EFF4F7",
  white: "#FFFFFF",
  localBg: "#EAF6FD",
  localBorder: "#C1E4F8",
  supermarketBg: "#EAF1DF",
  supermarketBorder: "#C5D0B2",
  darkstoreBg: "#FFEAF1",
  darkstoreBorder: "#ECBDCC",
  warehouseBg: "#CFEEFF",
  warehouseBorder: "#AEDEF9",
  fmcgBg: "#EAF6FD",
  fmcgBorder: "#C1E4F8",
  customBg: "#EEF1F4",
  customBorder: "#DBE0E5",
  /** Magic Patterns accent — Ask Aislix + featured KPI tiles */
  accentBg: "#F0E9FF",
  accentBorder: "#D9C5F2",
} as const;

/**
 * Ask Aislix palette — neutral search box: white, thin grey border, navy Ask button.
 * Do not reuse on KPI cards (those stay on AISLIX / AISLIX_PALETTE).
 */
export const ASK_AISLIX_SECTION = {
  background: "#FFFFFF",
  bandBorder: "#D9E2E8",
  heading: "#04203F",
  subtitle: "#667085",
  muted: "#667085",
  inputBackground: "#FFFFFF",
  composerBorder: "#D9E2E8",
  /** Ask CTA — the one accent in the box */
  askButton: "#04203F",
  askButtonHover: "#0B3360",
  askButtonText: "#FFFFFF",
  askButtonDisabled: "#EEF1F4",
  askButtonDisabledText: "rgba(4, 32, 63, 0.4)",
  focusRing: "#9FB3C8",
  accentSoft: "#F4F7F9",
  accentRing: "#D9E2E8",
  enhanceBg: "#FFFFFF",
  enhanceBorder: "#D9E2E8",
  enhanceText: "#04203F",
  chipBackground: "#FFFFFF",
  chipBorder: "#D9E2E8",
  chipText: "#04203F",
  scopeBg: "#FFFFFF",
  scopeBorder: "#D9E2E8",
  scopeText: "#04203F",
  blueInk: "#04203F",
  sparkle: "#04203F",
} as const;

/** Chart series order from the design spec — never rainbow / library defaults. */
export const AISLIX_CHART = CHART_SERIES;

export const AISLIX_STATUS_MIX: Record<string, string> = {
  Assigned: AISLIX_PALETTE.blue,
  "In Progress": AISLIX_PALETTE.purple,
  Submitted: AISLIX_PALETTE.cyan,
  Approved: AISLIX_PALETTE.green,
  Overdue: AISLIX_PALETTE.pink,
};

/** Soft navy primary CTA — New Audit (matches homepage navy #04203F). */
export const NEW_AUDIT_BUTTON_CLASS =
  "rounded-lg border border-[#04203F] bg-[#04203F] text-white hover:bg-[#04203F]/90";

export const AISLIX_MODEL_SURFACE: Record<string, { bg: string; border: string }> = {
  all: { bg: AISLIX.customBg, border: AISLIX.customBorder },
  local_store: { bg: AISLIX.localBg, border: AISLIX.localBorder },
  supermarket: { bg: AISLIX.supermarketBg, border: AISLIX.supermarketBorder },
  dark_store: { bg: AISLIX.darkstoreBg, border: AISLIX.darkstoreBorder },
  warehouse: { bg: AISLIX.warehouseBg, border: AISLIX.warehouseBorder },
  fmcg_distributor: { bg: AISLIX.fmcgBg, border: AISLIX.fmcgBorder },
  custom: { bg: AISLIX.customBg, border: AISLIX.customBorder },
};
