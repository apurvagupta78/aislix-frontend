import { useState } from "react";
import { ChevronDown, ChevronUp, Plus, Repeat } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FieldCard } from "@/components/audit-builder/FieldCard";
import type { FieldLibraryItem } from "@/lib/audit-builder/field-library";
import type { RepeatBy, TemplateField, TemplateSection } from "@/lib/audit-builder/types";

type Props = {
  sections: TemplateSection[];
  fields: TemplateField[];
  selectedFieldId: string | null;
  onSelectField: (id: string) => void;
  onRemoveField: (id: string) => void;
  onDuplicateField: (id: string) => void;
  onAddSection: () => void;
  onUpdateSection: (key: string, patch: Partial<TemplateSection>) => void;
  onReorderSection: (key: string, direction: "up" | "down") => void;
  onDropField: (item: FieldLibraryItem, sectionKey: string, index?: number) => void;
  onReorderField: (fieldId: string, direction: "up" | "down") => void;
};

const REPEAT_LABELS: Record<RepeatBy, string> = {
  sku: "Repeat per SKU",
  shelf: "Repeat per Shelf",
  location: "Repeat per Location",
  product: "Repeat per Product",
  custom: "Repeating Section",
};

export function BuilderCanvas({
  sections,
  fields,
  selectedFieldId,
  onSelectField,
  onRemoveField,
  onDuplicateField,
  onAddSection,
  onUpdateSection,
  onReorderSection,
  onDropField,
  onReorderField,
}: Props) {
  const sortedSections = [...sections].sort((a, b) => a.order - b.order);
  const [dropTarget, setDropTarget] = useState<{ sectionKey: string; index: number } | null>(null);

  return (
    <div className="flex h-full flex-col rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold">Audit Form Canvas</h3>
          <p className="text-xs text-muted-foreground">Drag fields from the library or click to add</p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={onAddSection}>
          <Plus className="mr-1 size-3" /> Add Section
        </Button>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {sortedSections.map((section, sectionIdx) => {
          const sectionFields = fields
            .filter((f) => f.section === section.key)
            .sort((a, b) => a.order - b.order);

          return (
            <section
              key={section.key}
              className="rounded-xl border border-dashed border-border bg-muted/10"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                setDropTarget(null);
                const raw = e.dataTransfer.getData("application/aislix-field");
                if (!raw) return;
                try {
                  onDropField(JSON.parse(raw) as FieldLibraryItem, section.key);
                } catch {
                  /* ignore */
                }
              }}
            >
              <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-3 py-2">
                <Input
                  className="h-8 max-w-[220px] border-0 bg-transparent px-0 text-sm font-semibold shadow-none focus-visible:ring-0"
                  value={section.title}
                  onChange={(e) => onUpdateSection(section.key, { title: e.target.value })}
                />
                {section.repeatable ? (
                  <Badge variant="secondary" className="gap-1 text-[10px]">
                    <Repeat className="size-3" />
                    {REPEAT_LABELS[section.repeatBy ?? "sku"]}
                  </Badge>
                ) : null}
                <div className="ml-auto flex gap-0.5">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    disabled={sectionIdx === 0}
                    onClick={() => onReorderSection(section.key, "up")}
                  >
                    <ChevronUp className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    disabled={sectionIdx === sortedSections.length - 1}
                    onClick={() => onReorderSection(section.key, "down")}
                  >
                    <ChevronDown className="size-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2 p-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={Boolean(section.repeatable)}
                      onChange={(e) =>
                        onUpdateSection(section.key, {
                          repeatable: e.target.checked,
                          repeatBy: e.target.checked ? (section.repeatBy ?? "sku") : undefined,
                        })
                      }
                    />
                    Repeating section
                  </label>
                  {section.repeatable ? (
                    <Select
                      value={section.repeatBy ?? "sku"}
                      onValueChange={(v) =>
                        onUpdateSection(section.key, { repeatBy: v as RepeatBy })
                      }
                    >
                      <SelectTrigger className="h-7 w-[140px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sku">Repeat by SKU</SelectItem>
                        <SelectItem value="shelf">Repeat by Shelf</SelectItem>
                        <SelectItem value="location">Repeat by Location</SelectItem>
                        <SelectItem value="product">Repeat by Product</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : null}
                </div>
                {sectionFields.length === 0 ? (
                  <p
                    className={`rounded-lg border border-dashed py-10 text-center text-xs text-muted-foreground ${
                      dropTarget?.sectionKey === section.key ? "border-brand bg-brand/5" : "border-muted-foreground/30"
                    }`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDropTarget({ sectionKey: section.key, index: 0 });
                    }}
                  >
                    Drop fields here
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {sectionFields.map((field, idx) => (
                      <li
                        key={field.id}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setDropTarget({ sectionKey: section.key, index: idx });
                        }}
                      >
                        <FieldCard
                          field={field}
                          selected={selectedFieldId === field.id}
                          dragOver={
                            dropTarget?.sectionKey === section.key && dropTarget.index === idx
                          }
                          onSelect={() => onSelectField(field.id)}
                          onDuplicate={() => onDuplicateField(field.id)}
                          onRemove={() => onRemoveField(field.id)}
                        />
                        <div className="mt-1 flex justify-end gap-0.5 opacity-0 transition-opacity hover:opacity-100">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-6 px-1 text-[10px]"
                            disabled={idx === 0}
                            onClick={() => onReorderField(field.id, "up")}
                          >
                            Move up
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-6 px-1 text-[10px]"
                            disabled={idx === sectionFields.length - 1}
                            onClick={() => onReorderField(field.id, "down")}
                          >
                            Move down
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
