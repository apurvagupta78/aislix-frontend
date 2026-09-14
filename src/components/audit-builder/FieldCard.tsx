import { Copy, GripVertical, Settings2, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { TemplateField } from "@/lib/audit-builder/types";

type Props = {
  field: TemplateField;
  selected: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  dragOver?: boolean;
};

export function FieldCard({
  field,
  selected,
  onSelect,
  onDuplicate,
  onRemove,
  dragOver,
}: Props) {
  const typeLabel = field.type.replace(/_/g, " ");

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
      className={`group rounded-lg border bg-background transition-all ${
        dragOver ? "border-brand border-dashed bg-brand/5" : ""
      } ${
        selected
          ? "border-brand ring-1 ring-brand/30 shadow-sm"
          : "border-border hover:border-brand/40"
      }`}
    >
      <div className="flex items-start gap-2 px-3 py-2.5">
        <GripVertical className="mt-0.5 size-4 shrink-0 cursor-grab text-muted-foreground opacity-50 group-hover:opacity-100" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-medium">{field.label}</span>
            {field.required ? (
              <Badge variant="destructive" className="h-4 px-1.5 text-[9px]">
                Required
              </Badge>
            ) : null}
            {field.calculated ? (
              <Badge variant="secondary" className="h-4 px-1.5 text-[9px]">
                Calculated
              </Badge>
            ) : null}
            {field.system ? (
              <Badge variant="outline" className="h-4 px-1.5 text-[9px]">
                System
              </Badge>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs capitalize text-muted-foreground">{typeLabel}</p>
          {field.description ? (
            <p className="mt-1 line-clamp-2 text-[10px] text-muted-foreground">{field.description}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-7"
            title="Configure"
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
          >
            <Settings2 className="size-3.5" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-7"
            title="Duplicate"
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
            }}
          >
            <Copy className="size-3.5" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-7 text-destructive hover:text-destructive"
            title="Delete"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
