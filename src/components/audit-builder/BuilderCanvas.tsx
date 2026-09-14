import { GripVertical, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { FieldLibraryItem } from "@/lib/audit-builder/field-library";
import type { TemplateField, TemplateSection } from "@/lib/audit-builder/types";

type Props = {
  sections: TemplateSection[];
  fields: TemplateField[];
  selectedFieldId: string | null;
  onSelectField: (id: string) => void;
  onRemoveField: (id: string) => void;
  onAddSection: () => void;
  onDropField: (item: FieldLibraryItem, sectionKey: string) => void;
  onReorderField: (fieldId: string, direction: "up" | "down") => void;
};

export function BuilderCanvas({
  sections,
  fields,
  selectedFieldId,
  onSelectField,
  onRemoveField,
  onAddSection,
  onDropField,
  onReorderField,
}: Props) {
  const sortedSections = [...sections].sort((a, b) => a.order - b.order);

  return (
    <div className="flex h-full flex-col rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold">Audit Form Canvas</h3>
          <p className="text-xs text-muted-foreground">Build the auditor experience</p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={onAddSection}>
          <Plus className="mr-1 size-3" /> Section
        </Button>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {sortedSections.map((section) => {
          const sectionFields = fields
            .filter((f) => f.section === section.key)
            .sort((a, b) => a.order - b.order);

          return (
            <section
              key={section.key}
              className="rounded-lg border border-dashed border-border bg-muted/20 p-4"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const raw = e.dataTransfer.getData("application/aislix-field");
                if (!raw) return;
                try {
                  onDropField(JSON.parse(raw) as FieldLibraryItem, section.key);
                } catch {
                  /* ignore */
                }
              }}
            >
              <div className="mb-3 flex items-center gap-2">
                <h4 className="text-sm font-semibold">{section.title}</h4>
                {section.repeatable ? (
                  <Badge variant="secondary" className="text-[10px]">
                    Repeat per SKU
                  </Badge>
                ) : null}
              </div>
              {sectionFields.length === 0 ? (
                <p className="rounded-md border border-dashed border-muted-foreground/30 py-8 text-center text-xs text-muted-foreground">
                  Drop fields here from the library
                </p>
              ) : (
                <ul className="space-y-2">
                  {sectionFields.map((field, idx) => (
                    <li key={field.id}>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => onSelectField(field.id)}
                        onKeyDown={(e) => e.key === "Enter" && onSelectField(field.id)}
                        className={`group flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 transition-colors ${
                          selectedFieldId === field.id
                            ? "border-brand bg-brand/5 ring-1 ring-brand/30"
                            : "border-border bg-background hover:border-brand/40"
                        }`}
                      >
                        <GripVertical className="size-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-sm font-medium">{field.label}</span>
                            {field.required ? (
                              <Badge variant="destructive" className="h-4 px-1 text-[9px]">
                                Required
                              </Badge>
                            ) : null}
                            {field.system ? (
                              <Badge variant="outline" className="h-4 px-1 text-[9px]">
                                System
                              </Badge>
                            ) : null}
                            {field.calculated ? (
                              <Badge variant="outline" className="h-4 px-1 text-[9px]">
                                Calculated
                              </Badge>
                            ) : null}
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            {field.type.replace(/_/g, " ")} · {field.key}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-0.5 opacity-0 group-hover:opacity-100">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="size-7"
                            disabled={idx === 0}
                            onClick={(e) => {
                              e.stopPropagation();
                              onReorderField(field.id, "up");
                            }}
                          >
                            ↑
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="size-7"
                            disabled={idx === sectionFields.length - 1}
                            onClick={(e) => {
                              e.stopPropagation();
                              onReorderField(field.id, "down");
                            }}
                          >
                            ↓
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="size-7 text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemoveField(field.id);
                            }}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
