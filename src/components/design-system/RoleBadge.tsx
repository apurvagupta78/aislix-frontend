import type { FieldRole } from "@/lib/audit-builder/field-roles";
import { FIELD_ROLE_BADGE_LABELS } from "@/lib/audit-builder/ensure-field-roles";
import { FIELD_ROLE_TONE, SEMANTIC_PALETTE } from "@/lib/design-system";
import { cn } from "@/lib/utils";

export function RoleBadge({ role, className }: { role: FieldRole; className?: string }) {
  const tone = FIELD_ROLE_TONE[role];
  const p = SEMANTIC_PALETTE[tone];
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        p.bg,
        p.border,
        p.text,
        className,
      )}
    >
      {FIELD_ROLE_BADGE_LABELS[role]}
    </span>
  );
}
