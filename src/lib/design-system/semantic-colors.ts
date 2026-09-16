import type { FieldRole } from "@/lib/audit-builder/field-roles";

/** Soft pastel tints for cards, pills, and badges — not full-screen fills. */
export const SEMANTIC_PALETTE = {
  brand: {
    bg: "bg-brand-soft/60",
    border: "border-brand/30",
    text: "text-brand",
    ring: "ring-brand/25",
  },
  success: {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-800",
    ring: "ring-emerald-200",
  },
  warning: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-900",
    ring: "ring-amber-200",
  },
  critical: {
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-800",
    ring: "ring-red-200",
  },
  info: {
    bg: "bg-sky-50",
    border: "border-sky-200",
    text: "text-sky-900",
    ring: "ring-sky-200",
  },
  ai: {
    bg: "bg-violet-50",
    border: "border-violet-200",
    text: "text-violet-900",
    ring: "ring-violet-200",
  },
  evidence: {
    bg: "bg-pink-50",
    border: "border-pink-200",
    text: "text-pink-900",
    ring: "ring-pink-200",
  },
  calculated: {
    bg: "bg-purple-50",
    border: "border-purple-200",
    text: "text-purple-900",
    ring: "ring-purple-200",
  },
  neutral: {
    bg: "bg-slate-50",
    border: "border-slate-200",
    text: "text-slate-700",
    ring: "ring-slate-200",
  },
} as const;

export type SemanticTone = keyof typeof SEMANTIC_PALETTE;

export const FIELD_ROLE_TONE: Record<FieldRole, SemanticTone> = {
  reference: "info",
  auditor_input: "success",
  calculated: "calculated",
  system: "neutral",
  evidence: "evidence",
  ai_suggested: "ai",
  human_confirmed: "warning",
};

export function toneClasses(tone: SemanticTone, selected = false) {
  const p = SEMANTIC_PALETTE[tone];
  return selected
    ? `${p.bg} ${p.border} border-2 ring-2 ${p.ring} shadow-sm`
    : `${p.bg} ${p.border} border hover:shadow-md`;
}
