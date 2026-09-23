import type { HomeTone } from "./homepage-data";

/** Soft pastel cards aligned to Aislix operating-model tokens. */
export const toneCard: Record<HomeTone, string> = {
  sky: "border-[var(--aislix-local-border)] bg-[var(--aislix-local-bg)]",
  sage: "border-[var(--aislix-supermarket-border)] bg-[var(--aislix-supermarket-bg)]",
  rose: "border-[var(--aislix-darkstore-border)] bg-[var(--aislix-darkstore-bg)]",
  azure: "border-[var(--aislix-warehouse-border)] bg-[var(--aislix-warehouse-bg)]",
  mist: "border-[var(--aislix-custom-border)] bg-[var(--aislix-custom-bg)]",
};

export const toneText: Record<HomeTone, string> = {
  sky: "text-[#2A6FA8]",
  sage: "text-[#4F6B2E]",
  rose: "text-[#B03A63]",
  azure: "text-[#1F6FB2]",
  mist: "text-[#35658F]",
};

export const toneBox: Record<HomeTone, string> = {
  sky: "border-[#2A6FA8] bg-[#2A6FA8]/10",
  sage: "border-[#4F6B2E] bg-[#4F6B2E]/10",
  rose: "border-[#B03A63] bg-[#B03A63]/10",
  azure: "border-[#1F6FB2] bg-[#1F6FB2]/10",
  mist: "border-[#35658F] bg-[#35658F]/10",
};

export const toneLabel: Record<HomeTone, string> = {
  sky: "bg-[#2A6FA8] text-white",
  sage: "bg-[#4F6B2E] text-white",
  rose: "bg-[#B03A63] text-white",
  azure: "bg-[#1F6FB2] text-white",
  mist: "bg-[#35658F] text-white",
};

export const statusDot: Record<"ok" | "warn" | "issue", string> = {
  ok: "bg-[#79E2A8]",
  warn: "bg-[#B7791F]",
  issue: "bg-[#C2410C]",
};
