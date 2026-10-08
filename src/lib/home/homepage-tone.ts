import type { HomeTone } from "./homepage-data";

/** Homepage tiles are white; the tone shows only as a small dot (and as boxes on the shelf photo). */
export const toneCard: Record<HomeTone, string> = {
  sky: "border-border bg-white",
  sage: "border-border bg-white",
  rose: "border-border bg-white",
  azure: "border-border bg-white",
  mist: "border-border bg-white",
};

export const toneText: Record<HomeTone, string> = {
  sky: "text-[#04203F]",
  sage: "text-[#04203F]",
  rose: "text-[#04203F]",
  azure: "text-[#04203F]",
  mist: "text-[#04203F]",
};

export const toneDot: Record<HomeTone, string> = {
  sky: "bg-[#7DB7D6]",
  sage: "bg-[#79E2A8]",
  rose: "bg-[#ECBDCC]",
  azure: "bg-[#8EC9E8]",
  mist: "bg-[#9B86D9]",
};

export const toneBox: Record<HomeTone, string> = {
  sky: "border-[#7DB7D6] bg-[#7DB7D6]/15",
  sage: "border-[#79E2A8] bg-[#79E2A8]/15",
  rose: "border-[#ECBDCC] bg-[#ECBDCC]/20",
  azure: "border-[#8EC9E8] bg-[#8EC9E8]/15",
  mist: "border-[#9B86D9] bg-[#9B86D9]/15",
};

export const toneLabel: Record<HomeTone, string> = {
  sky: "bg-[#7DB7D6] text-[#04203F]",
  sage: "bg-[#79E2A8] text-[#04203F]",
  rose: "bg-[#ECBDCC] text-[#04203F]",
  azure: "bg-[#8EC9E8] text-[#04203F]",
  mist: "bg-[#9B86D9] text-white",
};

export const statusDot: Record<"ok" | "warn" | "issue", string> = {
  ok: "bg-[#79E2A8]",
  warn: "bg-[#8EC9E8]",
  issue: "bg-[#ECBDCC]",
};
