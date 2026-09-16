import { Badge } from "@/components/ui/badge";
import type { FieldRole } from "@/lib/audit-builder/field-roles";
import { ROLE_PILL_CLASS } from "@/lib/new-audit/summary";

type Props = {
  items: { label: string; role: FieldRole }[];
  compact?: boolean;
};

export function AuditorFillPills({ items, compact }: Props) {
  if (!items.length) {
    return (
      <p className="text-xs text-muted-foreground">
        {compact ? "No auditor fields yet" : "Fields will appear after you choose a template or upload data."}
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Badge
          key={`${item.role}-${item.label}`}
          variant="outline"
          className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${ROLE_PILL_CLASS[item.role]}`}
        >
          {item.label}
        </Badge>
      ))}
    </div>
  );
}
