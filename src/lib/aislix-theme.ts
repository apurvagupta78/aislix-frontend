/**
 * Aislix chart + operating-model colors — hex from the official palette only.
 */
export const AISLIX = {
  bg: "#F2F6F9",
  primary: "#102A43",
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

/** Ask Aislix command-center palette — scoped to the Ask section only; do not use on KPI cards. */
export const ASK_AISLIX_SECTION = {
  /** White Ask strip — matches dashboard cards */
  background: "#FFFFFF",
  heading: "#102A43",
  subtitle: "#557187",
  inputBackground: "#FFFFFF",
  /** Soft blue — design-system Soft Blue */
  askButton: "#7DB7D6",
  askButtonText: "#102A43",
  chipBackground: "#F4F7F9",
  chipBorder: "#D9E2E8",
  chipText: "#102A43",
} as const;

/** Chart series order from the design spec — never rainbow / library defaults. */
export const AISLIX_CHART = [
  AISLIX.primary,
  AISLIX.secondary,
  AISLIX.warehouseBg,
  AISLIX.localBg,
  AISLIX.supermarketBg,
  AISLIX.darkstoreBg,
  AISLIX.customBg,
] as const;

export const AISLIX_STATUS_MIX: Record<string, string> = {
  Assigned: AISLIX.secondary,
  "In Progress": AISLIX.primary,
  Submitted: AISLIX.warehouseBg,
  Approved: AISLIX.supermarketBg,
  Overdue: AISLIX.darkstoreBg,
};

/** Soft blue primary CTA — New Audit (matches Ask button Soft Blue #7DB7D6). */
export const NEW_AUDIT_BUTTON_CLASS =
  "rounded-xl border border-[#7DB7D6] bg-[#7DB7D6] text-[#102A43] shadow-soft hover:bg-[#6aa9c9]";

export const AISLIX_MODEL_SURFACE: Record<string, { bg: string; border: string }> = {
  all: { bg: AISLIX.customBg, border: AISLIX.customBorder },
  local_store: { bg: AISLIX.localBg, border: AISLIX.localBorder },
  supermarket: { bg: AISLIX.supermarketBg, border: AISLIX.supermarketBorder },
  dark_store: { bg: AISLIX.darkstoreBg, border: AISLIX.darkstoreBorder },
  warehouse: { bg: AISLIX.warehouseBg, border: AISLIX.warehouseBorder },
  fmcg_distributor: { bg: AISLIX.fmcgBg, border: AISLIX.fmcgBorder },
  custom: { bg: AISLIX.customBg, border: AISLIX.customBorder },
};
