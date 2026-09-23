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
        Drag metric cards to reorder. Layout saves to your profile.
        {dirty ? <span className="ml-1 font-medium text-[#102A43]">Unsaved changes</span> : null}
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
          <div className="absolute right-0 z-20 mt-1 max-h-64 min-w-[240px] overflow-y-auto rounded-xl border border-[#D9E2E8] bg-white p-1 shadow-lg">
            {hiddenCatalog.map((s) => (
              <button
                key={s.id}
                type="button"
                className="block w-full rounded-lg px-3 py-2 text-left text-sm text-[#102A43] hover:bg-[#F4F7F9]"
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
        <Save className="size-3.5" /> Save as Default
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-lg border-[#D9E2E8]"
        disabled={saving}
        onClick={onReset}
      >
        <RotateCcw className="size-3.5" /> Reset to Aislix Default
      </Button>
    </div>
  );
}

export function SortableMetricCard({
  id,
  title,
  editMode,
  span2,
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
  children: React.ReactNode;
  onHide?: () => void;
  onDragStart: (id: string) => void;
  onDragOver: (e: React.DragEvent, id: string) => void;
  onDrop: (id: string) => void;
}) {
  return (
    <div
      className={cn("relative min-w-0", span2 && "sm:col-span-2")}
      draggable={editMode}
      onDragStart={() => onDragStart(id)}
      onDragOver={(e) => onDragOver(e, id)}
      onDrop={() => onDrop(id)}
    >
      {editMode ? (
        <div className="mb-1.5 flex items-center gap-2">
          <span className="inline-flex cursor-grab items-center gap-1 rounded-md border border-[#D9E2E8] bg-white px-2 py-0.5 text-[10px] text-[#667085] active:cursor-grabbing">
            <GripVertical className="size-3" /> {title}
          </span>
          {onHide ? (
            <button
              type="button"
              className="ml-auto inline-flex items-center gap-1 rounded-md border border-[#ECBDCC] bg-[#FFEAF1] px-2 py-0.5 text-[10px] text-[#102A43]"
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
