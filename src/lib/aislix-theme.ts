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
 * Ask Aislix palette — light blue matches Demo Data toggle (`#EAF6FD` / `#C1E4F8`).
 * Do not reuse on KPI cards (those stay on AISLIX / AISLIX_PALETTE).
 */
export const ASK_AISLIX_SECTION = {
  /** Header band — same as Demo Data toggle chip */
  background: "#EAF6FD",
  bandBorder: "#C1E4F8",
  heading: "#04203F",
  subtitle: "#557187",
  muted: "#667085",
  inputBackground: "#FFFFFF",
  composerBorder: "#C1E4F8",
  /** Ask CTA */
  askButton: "#1f7ac2",
  askButtonHover: "#1a68a6",
  askButtonText: "#FFFFFF",
  askButtonDisabled: "#EAF6FD",
  askButtonDisabledText: "rgba(16, 42, 67, 0.45)",
  focusRing: "#C1E4F8",
  accentSoft: "#EAF6FD",
  accentRing: "#C1E4F8",
  /** Enhance — soft green tint */
  enhanceBg: "#e9efdc",
  enhanceBorder: "#c8d4ae",
  enhanceText: "#4d6b22",
  chipBackground: "#EAF6FD",
  chipBorder: "#C1E4F8",
  chipText: "#04203F",
  /** Scope chips — same Demo Data blue */
  scopeBg: "#EAF6FD",
  scopeBorder: "#C1E4F8",
  scopeText: "#04203F",
  blueInk: "#04203F",
  sparkle: "#1f7ac2",
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
