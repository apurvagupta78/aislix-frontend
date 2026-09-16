import type { FieldRole } from "@/lib/audit-builder/field-roles";
import { FIELD_ROLE_BADGE_LABELS } from "@/lib/audit-builder/ensure-field-roles";
import { FIELD_ROLE_TONE, SEMANTIC_PALETTE } from "@/lib/design-system";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  role?: FieldRole;
  onClick?: () => void;
  selected?: boolean;
  className?: string;
};

/** Friendly visual chip for audit fields — click or drag target. */
export function FieldChip({ label, role = "auditor_input", onClick, selected, className }: Props) {
  const tone = FIELD_ROLE_TONE[role];
  const p = SEMANTIC_PALETTE[tone];
  const Tag = onClick ? "button" : "span";

  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      title={FIELD_ROLE_BADGE_LABELS[role]}
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium transition-shadow",
        p.bg,
        p.border,
        p.text,
        selected && "ring-2 ring-brand/30",
        onClick && "cursor-pointer hover:shadow-sm",
        className,
      )}
    >
      {label}
    </Tag>
  );
}
