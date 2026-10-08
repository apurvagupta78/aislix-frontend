import { GripVertical, Plus, RotateCcw, Save, Sparkles, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  catalogForTab,
  isCustomCardId,
  reorderIds,
  resolveVisibleOrder,
  type DashboardTabKey,
  type TabLayoutState,
} from "@/lib/dashboard-layout";
import { cn } from "@/lib/utils";

export function DashboardLayoutToolbar({
  tab,
  layout,
  dirty,
  saving,
  customSlotsUsed,
  onChange,
  onSave,
  onReset,
  onCreateCustom,
}: {
  tab: DashboardTabKey;
  layout: TabLayoutState;
  dirty: boolean;
  saving?: boolean;
  customSlotsUsed: number;
  onChange: (next: TabLayoutState) => void;
  onSave: () => void;
  onReset: () => void;
  onCreateCustom: () => void;
}) {
  const catalog = catalogForTab(tab);
  const hiddenCatalog = catalog.filter((s) => layout.hidden.includes(s.id));
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#D9E2E8] bg-white px-3 py-2">
      <p className="mr-auto text-xs text-[#667085]">
        Drag cards to reorder.
        {dirty ? <span className="ml-1 font-medium text-[#04203F]">Unsaved changes</span> : null}
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-lg border-[#D9E2E8]"
        disabled={customSlotsUsed >= 3}
        onClick={onCreateCustom}
      >
        <Sparkles className="size-3.5" /> Create custom metric
      </Button>
      <div className="relative">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-lg border-[#D9E2E8]"
          disabled={!hiddenCatalog.length}
          onClick={() => setAddOpen((v) => !v)}
        >
          <Plus className="size-3.5" /> Add card
        </Button>
        {addOpen && hiddenCatalog.length ? (
          <div className="absolute right-0 z-20 mt-1 max-h-64 min-w-[240px] overflow-y-auto rounded-xl border border-[#D9E2E8] bg-white p-1 shadow-lift">
            {hiddenCatalog.map((s) => (
              <button
                key={s.id}
                type="button"
                className="block w-full rounded-lg px-3 py-2 text-left text-sm text-[#04203F] hover:bg-[#F4F7F9]"
                onClick={() => {
                  onChange({
                    order: layout.order.includes(s.id) ? layout.order : [...layout.order, s.id],
                    hidden: layout.hidden.filter((id) => id !== s.id),
                  });
                  setAddOpen(false);
                }}
              >
                {s.title}
                {isCustomCardId(s.id) ? " (custom slot)" : ""}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-lg border-[#D9E2E8]"
        disabled={!dirty || saving}
        onClick={onSave}
      >
        <Save className="size-3.5" /> Save layout
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-lg border-[#D9E2E8]"
        disabled={saving}
        onClick={onReset}
      >
        <RotateCcw className="size-3.5" /> Reset
      </Button>
    </div>
  );
}

/** Width in a `sm:grid-cols-2 lg:grid-cols-4` grid. */
export type MetricCardSpan = "one" | "half" | "full";

const SPAN_CLASS: Record<MetricCardSpan, string> = {
  one: "",
  half: "sm:col-span-2",
  full: "sm:col-span-2 lg:col-span-4",
};

export function SortableMetricCard({
  id,
  title,
  editMode,
  span2,
  span,
  children,
  onHide,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  id: string;
  title: string;
  editMode: boolean;
  span2?: boolean;
  span?: MetricCardSpan;
  children: React.ReactNode;
  onHide?: () => void;
  onDragStart: (id: string) => void;
  onDragOver: (e: React.DragEvent, id: string) => void;
  onDrop: (id: string) => void;
}) {
  const width = span ?? (span2 ? "half" : "one");
  return (
    <div
      className={cn("relative min-w-0", SPAN_CLASS[width])}
      draggable={editMode}
      onDragStart={() => onDragStart(id)}
      onDragOver={(e) => onDragOver(e, id)}
      onDrop={() => onDrop(id)}
    >
      {editMode ? (
        <div className="mb-1.5 flex items-center gap-2">
          <span className="inline-flex cursor-grab items-center gap-1 rounded-md border border-[#D9E2E8] bg-white px-2 py-0.5 text-[11px] text-[#667085] active:cursor-grabbing">
            <GripVertical className="size-3" /> {title}
          </span>
          {onHide ? (
            <button
              type="button"
              className="ml-auto inline-flex items-center gap-1 rounded-md border border-[#D9E2E8] bg-white px-2 py-0.5 text-[11px] text-[#04203F] hover:bg-[#F4F7F9]"
              onClick={onHide}
            >
              <X className="size-3" /> Hide
            </button>
          ) : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}

export function useSectionDrag(layout: TabLayoutState, onChange: (next: TabLayoutState) => void) {
  const [draggingId, setDraggingId] = useState<string | null>(null);

  return {
    draggingId,
    onDragStart: (id: string) => setDraggingId(id),
    onDragOver: (e: React.DragEvent, _id: string) => {
      e.preventDefault();
    },
    onDrop: (overId: string) => {
      if (!draggingId || draggingId === overId) {
        setDraggingId(null);
        return;
      }
      onChange({
        ...layout,
        order: reorderIds(layout.order, draggingId, overId),
      });
      setDraggingId(null);
    },
  };
}

export function visibleSectionIds(tab: DashboardTabKey, layout: TabLayoutState): string[] {
  return resolveVisibleOrder(catalogForTab(tab), layout);
}

/** @deprecated alias */
export const SortableSection = SortableMetricCard;
