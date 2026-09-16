import { FieldChip } from "@/components/design-system";
import type { FieldRole } from "@/lib/audit-builder/field-roles";

type Props = {
  items: { label: string; role: FieldRole }[];
  compact?: boolean;
};

export function AuditorFillPills({ items, compact }: Props) {
  if (!items.length) {
    return (
      <p className="text-xs text-muted-foreground">
        {compact
          ? "No auditor fields yet"
          : "Fields will appear after you choose a template or upload data."}
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <FieldChip key={`${item.role}-${item.label}`} label={item.label} role={item.role} />
      ))}
    </div>
  );
}
