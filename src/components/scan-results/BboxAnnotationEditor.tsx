/**
 * Manual bounding-box editor — draw, select, and label detections on the shelf photo.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, MousePointer2, Pencil, SquareDashedMousePointer } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ResultSection } from "@/components/scan-results/ResultParts";
import {
  fetchCatalogSuggestions,
  fetchScanCorrections,
  saveScanCorrection,
} from "@/lib/scan-corrections";
import type { FacingBox, ScanFacing, ScanResult } from "@/lib/scan-results";
import { cn } from "@/lib/utils";

type EditorBox = {
  id: string;
  box: FacingBox;
  label: string;
  facing?: ScanFacing;
  draft?: boolean;
};

function clampBox(box: FacingBox, w: number, h: number): FacingBox {
  const x1 = Math.max(0, Math.min(box.x1, w - 1));
  const y1 = Math.max(0, Math.min(box.y1, h - 1));
  const x2 = Math.max(x1 + 4, Math.min(box.x2, w));
  const y2 = Math.max(y1 + 4, Math.min(box.y2, h));
  return { x1, y1, x2, y2 };
}

export function BboxAnnotationEditor({
  data,
  imageUrl,
  onCorrected,
}: {
  data?: ScanResult | null;
  imageUrl?: string | null;
  onCorrected?: () => void;
}) {
  const src = imageUrl ?? data?.annotated_image_url ?? data?.original_image_url;
  const scanId = data?.scan_id;
  const containerRef = useRef<HTMLDivElement>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [displaySize, setDisplaySize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [mode, setMode] = useState<"select" | "draw">("select");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftStart, setDraftStart] = useState<{ x: number; y: number } | null>(null);
  const [draftBox, setDraftBox] = useState<FacingBox | null>(null);
  const [editing, setEditing] = useState<EditorBox | null>(null);

  const correctionsQuery = useQuery({
    queryKey: ["scan-corrections", scanId],
    queryFn: () => fetchScanCorrections(scanId!),
    enabled: Boolean(scanId),
    retry: false,
  });

  useEffect(() => {
    if (!src || typeof window === "undefined") return;
    let cancelled = false;
    const img = new window.Image();
    if (!src.startsWith("data:")) img.crossOrigin = "anonymous";
    img.onload = () => {
      if (!cancelled) setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      setDisplaySize({ w: rect.width, h: rect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = useMemo(() => {
    if (!natural || displaySize.w <= 0) return 1;
    return displaySize.w / natural.w;
  }, [natural, displaySize.w]);

  const boxes: EditorBox[] = useMemo(() => {
    const facings = data?.facings ?? [];
    const base: EditorBox[] = facings
      .filter((f) => f.box)
      .map((f) => ({
        id: f.id,
        box: f.box!,
        label: `${f.brand} · ${f.product}`,
        facing: f,
      }));
    if (draftBox) {
      base.push({
        id: "draft-box",
        box: draftBox,
        label: "New detection",
        draft: true,
      });
    }
    return base;
  }, [data?.facings, draftBox]);

  const toImageCoords = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      const el = containerRef.current;
      if (!el || !natural) return null;
      const rect = el.getBoundingClientRect();
      const x = (clientX - rect.left) / scale;
      const y = (clientY - rect.top) / scale;
      return {
        x: Math.max(0, Math.min(x, natural.w)),
        y: Math.max(0, Math.min(y, natural.h)),
      };
    },
    [natural, scale],
  );

  const handlePointerDown = (e: React.PointerEvent) => {
    if (mode !== "draw" || !natural) return;
    e.preventDefault();
    const pt = toImageCoords(e.clientX, e.clientY);
    if (!pt) return;
    setDraftStart(pt);
    setDraftBox({ x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y });
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draftStart || !natural) return;
    const pt = toImageCoords(e.clientX, e.clientY);
    if (!pt) return;
    setDraftBox(
      clampBox(
        {
          x1: Math.min(draftStart.x, pt.x),
          y1: Math.min(draftStart.y, pt.y),
          x2: Math.max(draftStart.x, pt.x),
          y2: Math.max(draftStart.y, pt.y),
        },
        natural.w,
        natural.h,
      ),
    );
  };

  const handlePointerUp = () => {
    if (!draftBox || !natural) return;
    const w = draftBox.x2 - draftBox.x1;
    const h = draftBox.y2 - draftBox.y1;
    if (w >= 8 && h >= 8) {
      setEditing({
        id: "new",
        box: draftBox,
        label: "New detection",
        draft: true,
      });
    }
    setDraftStart(null);
    setDraftBox(null);
    setMode("select");
  };

  if (!data || !src) return null;

  const selected = boxes.find((b) => b.id === selectedId);

  return (
    <ResultSection
      title="Bounding-box editor"
      description="Click a detection to edit its label, or draw a new box to annotate a missed product."
      actions={
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={mode === "select" ? "brand" : "outline"}
            size="sm"
            className="rounded-xl"
            onClick={() => setMode("select")}
          >
            <MousePointer2 className="size-4" /> Select
          </Button>
          <Button
            type="button"
            variant={mode === "draw" ? "brand" : "outline"}
            size="sm"
            className="rounded-xl"
            onClick={() => {
              setMode("draw");
              setSelectedId(null);
            }}
          >
            <SquareDashedMousePointer className="size-4" /> Draw box
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
        <div
          ref={containerRef}
          className={cn(
            "relative w-full overflow-hidden rounded-xl border border-border bg-muted",
            mode === "draw" && "cursor-crosshair",
          )}
          style={{ aspectRatio: natural ? `${natural.w} / ${natural.h}` : "4 / 3" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          <img
            src={src}
            alt="Shelf for annotation"
            className="block h-full w-full select-none object-contain"
            draggable={false}
          />
          {natural ? (
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full"
              viewBox={`0 0 ${natural.w} ${natural.h}`}
              preserveAspectRatio="xMidYMid meet"
            >
              {boxes.map((item) => {
                const active = item.id === selectedId || item.draft;
                return (
                  <rect
                    key={item.id}
                    x={item.box.x1}
                    y={item.box.y1}
                    width={item.box.x2 - item.box.x1}
                    height={item.box.y2 - item.box.y1}
                    className={cn(
                      "pointer-events-auto cursor-pointer fill-transparent stroke-2",
                      active ? "stroke-brand" : "stroke-brand/60",
                      item.draft && "stroke-dashed",
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (item.draft) return;
                      setSelectedId(item.id);
                      setEditing(item);
                    }}
                  />
                );
              })}
            </svg>
          ) : null}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Detections</p>
          <ul className="max-h-72 space-y-1 overflow-y-auto rounded-xl border border-border p-2 text-sm">
            {boxes.filter((b) => !b.draft).length === 0 ? (
              <li className="px-2 py-4 text-center text-xs text-muted-foreground">No boxes yet</li>
            ) : (
              boxes
                .filter((b) => !b.draft)
                .map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-brand-soft/40",
                        selectedId === item.id && "bg-brand-soft/60",
                      )}
                      onClick={() => {
                        setSelectedId(item.id);
                        setEditing(item);
                      }}
                    >
                      <Pencil className="size-3.5 shrink-0 text-brand" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  </li>
                ))
            )}
          </ul>
          {(correctionsQuery.data?.length ?? 0) > 0 ? (
            <Badge variant="outline" className="rounded-full border-accent-green/30 bg-accent-green/10 text-accent-green">
              {correctionsQuery.data!.length} correction(s) saved
            </Badge>
          ) : null}
        </div>
      </div>

      <LabelDialog
        box={editing}
        data={data}
        onClose={() => {
          setEditing(null);
          setSelectedId(null);
        }}
        onSaved={() => {
          void correctionsQuery.refetch();
          onCorrected?.();
        }}
      />
    </ResultSection>
  );
}

function LabelDialog({
  box,
  data,
  onClose,
  onSaved,
}: {
  box: EditorBox | null;
  data: ScanResult;
  onClose: () => void;
  onSaved: () => void;
}) {
  const queryClient = useQueryClient();
  const [brand, setBrand] = useState("");
  const [product, setProduct] = useState("");
  const [variant, setVariant] = useState("");
  const [packText, setPackText] = useState("");

  useEffect(() => {
    if (!box) return;
    const f = box.facing;
    setBrand(f?.brand && f.brand !== "Unknown" ? f.brand : "");
    setProduct(f?.product && f.product !== "Unknown product" ? f.product : "");
    setVariant(f?.variant ?? "");
    setPackText(f?.pack_text ?? "");
  }, [box]);

  const suggestions = useQuery({
    queryKey: ["catalog-suggestions"],
    queryFn: () => fetchCatalogSuggestions(),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const save = useMutation({
    mutationFn: () =>
      saveScanCorrection({
        scan_id: data.scan_id,
        box: box?.box,
        corrected_brand: brand.trim(),
        corrected_product: product.trim(),
        corrected_variant: variant.trim() || undefined,
        corrected_ocr_label: packText.trim() || undefined,
        predicted_brand: box?.facing?.brand,
        predicted_product: box?.facing?.product,
        pack_text: box?.facing?.pack_text,
        category: data.scan_category,
        sub_category: data.scan_sub_category,
      }),
    onSuccess: () => {
      toast.success("Annotation saved.");
      void queryClient.invalidateQueries({ queryKey: ["scan-result", data.scan_id] });
      onSaved();
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const valid = brand.trim().length > 0 && product.trim().length > 0;

  return (
    <Dialog open={Boolean(box)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{box?.draft ? "Label new detection" : "Edit detection label"}</DialogTitle>
          <DialogDescription>
            Bounding box coordinates are saved with your correction for benchmark training.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="bbox-brand">Brand</Label>
            <Input
              id="bbox-brand"
              list="bbox-catalog-brands"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="e.g. Colgate"
            />
            <datalist id="bbox-catalog-brands">
              {(suggestions.data?.brands ?? []).map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="bbox-product">Product name</Label>
            <Input
              id="bbox-product"
              list="bbox-catalog-products"
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              placeholder="e.g. MaxFresh"
            />
            <datalist id="bbox-catalog-products">
              {(suggestions.data?.products ?? []).map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="bbox-variant">Variant (optional)</Label>
            <Input id="bbox-variant" value={variant} onChange={(e) => setVariant(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="bbox-pack">Pack text (optional)</Label>
            <Input id="bbox-pack" value={packText} onChange={(e) => setPackText(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="subtle" className="rounded-xl" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="brand"
            className="rounded-xl"
            disabled={!valid || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? <Loader2 className="size-4 animate-spin" /> : null} Save annotation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
