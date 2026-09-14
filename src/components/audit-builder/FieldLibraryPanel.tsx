import { useState } from "react";
import { ChevronDown, ChevronRight, GripVertical, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { FIELD_LIBRARY, type FieldLibraryItem } from "@/lib/audit-builder/field-library";
import type { FieldType } from "@/lib/audit-builder/types";

type Props = {
  onAddField: (item: FieldLibraryItem) => void;
};

export function FieldLibraryPanel({ onAddField }: Props) {
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const q = search.trim().toLowerCase();

  return (
    <aside className="flex h-full flex-col rounded-xl border border-border bg-card">
      <div className="border-b border-border p-4">
        <h3 className="text-sm font-semibold">Field Library</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">Drag or click to add fields</p>
        <div className="relative mt-3">
          <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
          <Input
            className="pl-8 h-8 text-xs"
            placeholder="Search fields…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {FIELD_LIBRARY.map((cat) => {
          const items = cat.items.filter(
            (item) =>
              !q ||
              item.label.toLowerCase().includes(q) ||
              item.type.toLowerCase().includes(q),
          );
          if (!items.length) return null;
          const isCollapsed = collapsed[cat.id] ?? false;
          return (
            <div key={cat.id} className="mb-2">
              <button
                type="button"
                className="flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-left text-xs font-medium hover:bg-muted/60"
                onClick={() => setCollapsed((c) => ({ ...c, [cat.id]: !isCollapsed }))}
              >
                {isCollapsed ? <ChevronRight className="size-3" /> : <ChevronDown className="size-3" />}
                {cat.title}
                <span className="ml-auto text-muted-foreground">{items.length}</span>
              </button>
              {!isCollapsed ? (
                <ul className="space-y-1 px-1">
                  {items.map((item) => (
                    <li key={item.type as FieldType}>
                      <button
                        type="button"
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("application/aislix-field", JSON.stringify(item));
                        }}
                        onClick={() => onAddField(item)}
                        className="group flex w-full items-start gap-2 rounded-lg border border-transparent px-2 py-2 text-left text-xs hover:border-border hover:bg-muted/40"
                      >
                        <GripVertical className="mt-0.5 size-3 shrink-0 text-muted-foreground opacity-40 group-hover:opacity-100" />
                        <span>
                          <span className="font-medium">{item.label}</span>
                          <span className="mt-0.5 block text-[10px] text-muted-foreground line-clamp-2">
                            {item.description}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
