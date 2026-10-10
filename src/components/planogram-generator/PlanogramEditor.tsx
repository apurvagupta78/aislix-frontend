import { useEffect, useMemo, useState } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  MAX_PRODUCTS_PER_SPACE,
  MAX_SPACES_PER_SHELF,
  addSpace,
  emptyProduct,
  mapSpaces,
  removeLastSpace,
  type LayoutProduct,
  type LayoutRack,
  type LayoutSpace,
  type PlanogramLayout,
} from "@/lib/planogram-generator/layout";
import { encodeQr, qrSvgPath } from "@/lib/qr/qr-code";
import { cn } from "@/lib/utils";

export function QrSvg({ value, size = 96, label }: { value: string; size?: number; label: string }) {
  const matrix = useMemo(() => encodeQr(value), [value]);
  const n = matrix.length + 8;
  return (
    <svg viewBox={`0 0 ${n} ${n}`} width={size} height={size} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect width={n} height={n} fill="#FFFFFF" />
      <path d={qrSvgPath(matrix)} fill="#000000" />
    </svg>
  );
}

function shelfName(shelf: number, total: number, position: string): string {
  if (position) return `Shelf ${shelf} · ${position}`;
  if (shelf === 1) return `Shelf ${shelf} · Top`;
  if (shelf === total) return `Shelf ${shelf} · Bottom`;
  return `Shelf ${shelf}`;
}

function intOrNull(value: string, max: number): number | null {
  if (!value.trim()) return null;
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : null;
}

function findSpace(layout: PlanogramLayout, locationId: string) {
  for (const rack of layout.racks) {
    for (const shelf of rack.shelves) {
      const space = shelf.spaces.find((s) => s.locationId === locationId);
      if (space) return { rack, shelf, space };
    }
  }
  return null;
}

function moveProduct(layout: PlanogramLayout, productId: string, toId: string): PlanogramLayout {
  let moving: LayoutProduct | undefined;
  const removed = mapSpaces(layout, (s) => {
    const hit = s.products.find((p) => p.id === productId);
    if (!hit || s.locationId === toId) return s;
    moving = hit;
    return { ...s, products: s.products.filter((p) => p.id !== productId) };
  });
  if (!moving) return layout;
  const item = moving;
  return mapSpaces(removed, (s) =>
    s.locationId === toId && s.products.length < MAX_PRODUCTS_PER_SPACE ? { ...s, products: [...s.products, item] } : s,
  );
}

/** Visual rack diagram plus an editable table for the selected shelf space. */
export function PlanogramEditor({
  layout,
  readOnly,
  onChange,
}: {
  layout: PlanogramLayout;
  readOnly: boolean;
  onChange: (next: PlanogramLayout) => void;
}) {
  const [rackNo, setRackNo] = useState(layout.racks[0]?.rack ?? 1);
  const rack = layout.racks.find((r) => r.rack === rackNo) ?? layout.racks[0];
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!layout.racks.some((r) => r.rack === rackNo)) setRackNo(layout.racks[0]?.rack ?? 1);
  }, [layout, rackNo]);

  const current = selected ? findSpace(layout, selected) : null;
  const active = current && current.rack.rack === rack?.rack ? current : null;

  if (!rack) return null;

  const updateSpace = (locationId: string, fn: (s: LayoutSpace) => LayoutSpace) =>
    onChange(mapSpaces(layout, (s) => (s.locationId === locationId ? fn(s) : s)));

  return (
    <div className="space-y-4">
      {layout.racks.length > 1 ? (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Racks">
          {layout.racks.map((r) => (
            <button
              key={r.rack}
              type="button"
              role="tab"
              aria-selected={r.rack === rack.rack}
              onClick={() => {
                setRackNo(r.rack);
                setSelected(null);
              }}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-sm transition-colors duration-150",
                r.rack === rack.rack
                  ? "border-[#04203F] bg-[#04203F] text-white"
                  : "border-[#D9E2E8] bg-white text-[#04203F] hover:bg-[#F4F7F9]",
              )}
            >
              Rack {r.rack}
            </button>
          ))}
        </div>
      ) : null}

      <RackDiagram rack={rack} selected={active?.space.locationId ?? null} onSelect={setSelected} />

      {active ? (
        <SpaceTable
          key={active.space.locationId}
          rack={active.rack}
          shelfNo={active.shelf.shelf}
          shelfSpaces={active.shelf.spaces.length}
          space={active.space}
          readOnly={readOnly}
          onSpace={(fn) => updateSpace(active.space.locationId, fn)}
          onMove={(productId, toId) => onChange(moveProduct(layout, productId, toId))}
          onAddSpace={() => onChange(addSpace(layout, active.rack.rack, active.shelf.shelf))}
          onRemoveSpace={() => {
            const last = active.shelf.spaces[active.shelf.spaces.length - 1];
            if (last?.locationId === active.space.locationId) setSelected(null);
            onChange(removeLastSpace(layout, active.rack.rack, active.shelf.shelf));
          }}
        />
      ) : (
        <p className="rounded-lg border border-dashed border-[#D9E2E8] px-3 py-3 text-sm text-[#667085]">
          Tap a shelf space to see {readOnly ? "its products" : "and edit its products"}.
        </p>
      )}
    </div>
  );
}

function RackDiagram({
  rack,
  selected,
  onSelect,
}: {
  rack: LayoutRack;
  selected: string | null;
  onSelect: (locationId: string) => void;
}) {
  return (
    <div className="rounded-xl border border-[#D9E2E8] bg-white p-3">
      <p className="text-sm font-semibold text-[#04203F]">
        Rack {rack.rack}
        {rack.description ? <span className="font-normal text-[#667085]"> · {rack.description}</span> : null}
      </p>
      <div className="mt-3 overflow-x-auto">
        <div className="min-w-[520px] space-y-2">
          {rack.shelves.map((shelf) => {
            const widths = shelf.spaces.map((s) => s.widthCm).filter((w): w is number => w !== null);
            const fallback = widths.length ? widths.reduce((a, b) => a + b, 0) / widths.length : 1;
            return (
              <div key={shelf.shelf} className="flex items-stretch gap-2">
                <div className="flex w-24 shrink-0 flex-col justify-center text-xs text-[#667085]">
                  <span className="font-medium text-[#04203F]">
                    {shelfName(shelf.shelf, rack.shelves.length, shelf.position)}
                  </span>
                  {shelf.widthCm ? <span>{shelf.widthCm} cm wide</span> : null}
                </div>
                <div className="flex min-w-0 flex-1 gap-1.5 border-b-4 border-[#D9E2E8] pb-1.5">
                  {shelf.spaces.map((space) => {
                    const isSelected = space.locationId === selected;
                    const shown = space.products.slice(0, 3);
                    return (
                      <button
                        key={space.locationId}
                        type="button"
                        onClick={() => onSelect(space.locationId)}
                        style={{ flexGrow: space.widthCm ?? fallback, flexBasis: 0 }}
                        className={cn(
                          "min-w-[84px] rounded-lg border p-2 text-left text-xs transition-colors duration-150",
                          isSelected ? "border-[#04203F] ring-1 ring-[#04203F]" : "border-[#D9E2E8] hover:bg-[#F4F7F9]",
                          !space.products.length && "bg-[#F4F7F9]",
                        )}
                        aria-pressed={isSelected}
                        aria-label={`${space.locationId}, ${space.products.length} products`}
                      >
                        <span className="block text-[11px] text-[#667085]">Space {space.space}</span>
                        {shown.length ? (
                          shown.map((p) => (
                            <span key={p.id} className="mt-0.5 flex items-center gap-1 text-[#04203F]">
                              <span
                                className={cn(
                                  "size-1.5 shrink-0 rounded-full",
                                  p.inList === false ? "bg-[#ECBDCC]" : "bg-[#9B86D9]",
                                )}
                                aria-hidden
                              />
                              <span className="truncate">
                                {p.facings ? `${p.facings}× ` : ""}
                                {p.name || "Unnamed product"}
                              </span>
                            </span>
                          ))
                        ) : (
                          <span className="mt-0.5 block text-[#667085]">Empty</span>
                        )}
                        {space.products.length > shown.length ? (
                          <span className="mt-0.5 block text-[#667085]">+{space.products.length - shown.length} more</span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#667085]">
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-[#9B86D9]" aria-hidden /> Product and facings
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-[#ECBDCC]" aria-hidden /> Not in your product list
        </span>
      </p>
    </div>
  );
}

function SpaceTable({
  rack,
  shelfNo,
  shelfSpaces,
  space,
  readOnly,
  onSpace,
  onMove,
  onAddSpace,
  onRemoveSpace,
}: {
  rack: LayoutRack;
  shelfNo: number;
  shelfSpaces: number;
  space: LayoutSpace;
  readOnly: boolean;
  onSpace: (fn: (s: LayoutSpace) => LayoutSpace) => void;
  onMove: (productId: string, toId: string) => void;
  onAddSpace: () => void;
  onRemoveSpace: () => void;
}) {
  const targets = rack.shelves.flatMap((s) => s.spaces.map((sp) => ({ id: sp.locationId, shelf: s.shelf, space: sp.space })));
  const patch = (id: string, change: Partial<LayoutProduct>) =>
    onSpace((s) => ({ ...s, products: s.products.map((p) => (p.id === id ? { ...p, ...change } : p)) }));
  const isLast = space.space === shelfSpaces;

  return (
    <div className="rounded-xl border border-[#D9E2E8] bg-white p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#04203F]">{space.locationId}</p>
          <p className="text-xs text-[#667085]">
            Rack {rack.rack} → Shelf {shelfNo} → Space {space.space}
            {space.widthCm ? ` · ${space.widthCm} cm${space.estimated ? " (estimated)" : ""}` : ""}
          </p>
        </div>
        {readOnly ? null : (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg"
              disabled={shelfSpaces >= MAX_SPACES_PER_SHELF}
              onClick={onAddSpace}
            >
              <Plus className="size-4" /> Add space to shelf
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg"
              disabled={!isLast || shelfSpaces <= 1 || space.products.length > 0}
              onClick={onRemoveSpace}
              title="Only the last space on a shelf can be removed, once it is empty"
            >
              <Minus className="size-4" /> Remove space
            </Button>
          </div>
        )}
      </div>

      {readOnly ? (
        space.instructions ? <p className="mt-3 text-sm text-[#04203F]">{space.instructions}</p> : null
      ) : (
        <Input
          className="mt-3 rounded-lg"
          value={space.instructions}
          maxLength={400}
          onChange={(e) => onSpace((s) => ({ ...s, instructions: e.target.value }))}
          placeholder="Placement instructions (optional), e.g. Bestsellers at eye level, front-face labels"
          aria-label="Placement instructions"
        />
      )}

      <div className="mt-3 overflow-x-auto rounded-lg border border-[#D9E2E8]">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-[#F4F7F9] text-left text-xs text-[#667085]">
            <tr>
              <th className="px-2 py-2 font-medium">Product</th>
              <th className="px-2 py-2 font-medium">Brand</th>
              <th className="px-2 py-2 font-medium">SKU</th>
              <th className="w-20 px-2 py-2 font-medium">Facings</th>
              <th className="w-20 px-2 py-2 font-medium">Qty</th>
              {readOnly ? null : <th className="w-36 px-2 py-2 font-medium">Move to</th>}
              {readOnly ? null : <th className="w-10 px-2 py-2" aria-label="Remove" />}
            </tr>
          </thead>
          <tbody>
            {space.products.map((p) => (
              <tr key={p.id} className="border-t border-[#EEF1F4] align-top">
                <td className="px-2 py-1.5">
                  {readOnly ? (
                    <span className="text-[#04203F]">{p.name}</span>
                  ) : (
                    <Input
                      className="h-8 rounded-md"
                      value={p.name}
                      maxLength={160}
                      onChange={(e) => patch(p.id, { name: e.target.value })}
                      aria-label="Product name"
                    />
                  )}
                  {p.inList === false ? (
                    <span className="mt-1 inline-block rounded-full border border-[#ECBDCC] px-2 py-0.5 text-[11px] text-[#04203F]">
                      Not in your product list
                    </span>
                  ) : null}
                  {p.reason ? <span className="mt-1 block text-xs text-[#667085]">{p.reason}</span> : null}
                </td>
                <td className="px-2 py-1.5">
                  {readOnly ? (
                    <span className="text-[#667085]">{p.brand || "—"}</span>
                  ) : (
                    <Input
                      className="h-8 rounded-md"
                      value={p.brand}
                      maxLength={80}
                      onChange={(e) => patch(p.id, { brand: e.target.value })}
                      aria-label="Brand"
                    />
                  )}
                </td>
                <td className="px-2 py-1.5">
                  {readOnly ? (
                    <span className="text-[#667085]">{p.sku || "—"}</span>
                  ) : (
                    <Input
                      className="h-8 rounded-md"
                      value={p.sku}
                      maxLength={60}
                      onChange={(e) => patch(p.id, { sku: e.target.value })}
                      aria-label="SKU"
                    />
                  )}
                </td>
                <td className="px-2 py-1.5">
                  {readOnly ? (
                    <span className="text-[#04203F]">{p.facings ?? "—"}</span>
                  ) : (
                    <Input
                      className="h-8 rounded-md"
                      inputMode="numeric"
                      value={p.facings ?? ""}
                      onChange={(e) => patch(p.id, { facings: intOrNull(e.target.value, 99) })}
                      aria-label="Facings"
                    />
                  )}
                </td>
                <td className="px-2 py-1.5">
                  {readOnly ? (
                    <span className="text-[#04203F]">
                      {p.quantity ?? "—"}
                      {p.quantity !== null && p.quantityEstimated ? <span className="block text-xs text-[#667085]">Estimated</span> : null}
                    </span>
                  ) : (
                    <Input
                      className="h-8 rounded-md"
                      inputMode="numeric"
                      value={p.quantity ?? ""}
                      placeholder={p.quantityEstimated ? "Est." : ""}
                      onChange={(e) => patch(p.id, { quantity: intOrNull(e.target.value, 9999), quantityEstimated: false })}
                      aria-label="Quantity"
                    />
                  )}
                </td>
                {readOnly ? null : (
                  <td className="px-2 py-1.5">
                    <select
                      className="h-8 w-full rounded-md border border-[#D9E2E8] bg-white px-1 text-xs text-[#04203F]"
                      value={space.locationId}
                      onChange={(e) => onMove(p.id, e.target.value)}
                      aria-label="Move to space"
                    >
                      {targets.map((t) => (
                        <option key={t.id} value={t.id}>
                          Shelf {t.shelf} · Space {t.space}
                        </option>
                      ))}
                    </select>
                  </td>
                )}
                {readOnly ? null : (
                  <td className="px-2 py-1.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => onSpace((s) => ({ ...s, products: s.products.filter((x) => x.id !== p.id) }))}
                      aria-label={`Remove ${p.name || "product"}`}
                    >
                      <Trash2 className="size-4 text-[#667085]" />
                    </Button>
                  </td>
                )}
              </tr>
            ))}
            {!space.products.length ? (
              <tr>
                <td colSpan={readOnly ? 5 : 7} className="px-2 py-3 text-sm text-[#667085]">
                  No products in this space{space.instructions ? "" : " — it will stay free"}.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {readOnly ? null : (
        <Button
          variant="outline"
          size="sm"
          className="mt-3 rounded-lg"
          disabled={space.products.length >= MAX_PRODUCTS_PER_SPACE}
          onClick={() => onSpace((s) => ({ ...s, products: [...s.products, emptyProduct()] }))}
        >
          <Plus className="size-4" /> Add product
        </Button>
      )}
    </div>
  );
}
