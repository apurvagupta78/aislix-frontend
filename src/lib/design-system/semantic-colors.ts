import type { FieldRole } from "@/lib/audit-builder/field-roles";

/**
 * Soft semantic tints for cards, pills, and badges — not full-screen fills.
 * All values are design tokens declared in src/styles.css; never raw palette colors.
 */
export const SEMANTIC_PALETTE = {
  brand: {
    bg: "bg-brand-soft/60",
    border: "border-brand/30",
    text: "text-brand",
    ring: "ring-brand/25",
  },
  success: {
    bg: "bg-status-good-soft",
    border: "border-status-good/30",
    text: "text-status-good-strong",
    ring: "ring-status-good/25",
  },
  warning: {
    bg: "bg-status-warn-soft",
    border: "border-status-warn/35",
    text: "text-status-warn-strong",
    ring: "ring-status-warn/25",
  },
  critical: {
    bg: "bg-status-danger-soft",
    border: "border-status-danger/30",
    text: "text-status-danger-strong",
    ring: "ring-status-danger/25",
  },
  info: {
    bg: "bg-status-info-soft",
    border: "border-status-info/30",
    text: "text-status-info-strong",
    ring: "ring-status-info/25",
  },
  ai: {
    bg: "bg-status-ai-soft",
    border: "border-status-ai/30",
    text: "text-status-ai-strong",
    ring: "ring-status-ai/25",
  },
  evidence: {
    bg: "bg-status-evidence-soft",
    border: "border-status-evidence/30",
    text: "text-status-evidence-strong",
    ring: "ring-status-evidence/25",
  },
  calculated: {
    bg: "bg-status-ai-soft",
    border: "border-status-ai/25",
    text: "text-status-ai-strong",
    ring: "ring-status-ai/20",
  },
  neutral: {
    bg: "bg-muted",
    border: "border-border",
    text: "text-muted-foreground",
    ring: "ring-border",
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
