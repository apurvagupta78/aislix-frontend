/**
 * "Needs review" accuracy correction workflow.
 *
 * Lists the facings the vision backend was unsure about, shows a crop of each
 * one taken straight from the backend-rendered shelf JPEG (CSS crop — the shelf
 * is never re-drawn on a canvas), and lets ops fix the SKU in a modal. Every fix
 * is appended to `scan_corrections` for the backend benchmark loop.
 */

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, ScanEye, Sparkles, WandSparkles } from "lucide-react";
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
import { EmptyState } from "@/components/States";
import { ResultSection } from "@/components/scan-results/ResultParts";
import {
  fetchCatalogSuggestions,
  fetchScanCorrections,
  saveScanCorrection,
} from "@/lib/scan-corrections";
import {
  needsReviewFacings,
  normalizeConfidence,
  type FacingBox,
  type ScanFacing,
  type ScanResult,
} from "@/lib/scan-results";

/** Number of facings flagged for human review on this audit. */
export function reviewCount(data?: ScanResult | undefined): number {
  const q = data?.quality ?? {};
  return Math.max(
    needsReviewFacings(data).length,
    (q.ocr_low_confidence_facings ?? 0) + (q.recognition_unknown ?? 0),
  );
}

export function NeedsReviewBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <Badge variant="outline" className="rounded-full border-amber-500/30 bg-amber-500/10 text-amber-600">
      <ScanEye className="size-3.5" /> {count} in AI review queue
    </Badge>
  );
}

function FacingCrop({
  src,
  box,
  size = 72,
}: {
  src?: string | undefined;
  box?: FacingBox | undefined;
  size?: number;
}) {
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);

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

  if (!src || !box || !natural) {
    return (
      <div
        className="grid shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground"
        style={{ width: size, height: size }}
      >
        <ScanEye className="size-4" />
      </div>
    );
  }

  const boxW = Math.max(1, box.x2 - box.x1);
  const boxH = Math.max(1, box.y2 - box.y1);
  const scale = size / Math.max(boxW, boxH);

  return (
    <div
      className="shrink-0 overflow-hidden rounded-xl border border-border bg-muted"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <div
        style={{
          width: size,
          height: size,
          backgroundImage: `url("${src}")`,
          backgroundRepeat: "no-repeat",
          backgroundSize: `${natural.w * scale}px ${natural.h * scale}px`,
          backgroundPosition: `${-box.x1 * scale + (size - boxW * scale) / 2}px ${
            -box.y1 * scale + (size - boxH * scale) / 2
          }px`,
        }}
      />
    </div>
  );
}

function confidenceLabel(facing: ScanFacing): string | null {
  const value = facing.ocr_confidence ?? facing.confidence;
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return `${normalizeConfidence(value).toFixed(0)}% confidence`;
}

export function NeedsReviewSection({
  data,
  onCorrected,
}: {
  data?: ScanResult | undefined;
  onCorrected?: (() => void) | undefined;
}) {
  const [flagged, setFlagged] = useState(false);
  const [editing, setEditing] = useState<ScanFacing | null>(null);

  const quality = data?.quality ?? {};
  const auto = useMemo(() => needsReviewFacings(data), [data]);
  const lowConfidence = quality.ocr_low_confidence_facings ?? 0;
  const unknown = quality.recognition_unknown ?? 0;
  const shouldShow = lowConfidence > 0 || unknown > 0 || auto.length > 0;

  const scanId = data?.scan_id;
  const correctionsQuery = useQuery({
    queryKey: ["scan-corrections", scanId],
    queryFn: () => fetchScanCorrections(scanId!),
    enabled: Boolean(scanId),
    retry: false,
  });

  if (!data || !shouldShow) return null;

  const facings = flagged ? (data.facings ?? []) : auto;
  const corrected = new Map(
    (correctionsQuery.data ?? []).map((row) => [
      `${row.predicted_brand ?? ""}::${row.predicted_product ?? ""}`,
      row,
    ]),
  );

  return (
    <ResultSection
      title="AI review queue"
      description="Facings the AI was unsure about. Correcting them updates this audit and feeds the recognition benchmark."
      actions={
        <div className="flex items-center gap-2">
          <NeedsReviewBadge count={reviewCount(data)} />
          <Button
            variant="subtle"
            size="sm"
            className="rounded-xl"
            onClick={() => setFlagged((v) => !v)}
          >
            <WandSparkles className="size-4" />
            {flagged ? "Show flagged only" : "Flag for review"}
          </Button>
        </div>
      }
    >
      <div className="grid gap-3 text-xs text-muted-foreground sm:grid-cols-3">
        <span>Low OCR confidence: {lowConfidence}</span>
        <span>Unrecognised facings: {unknown}</span>
        <span>Empty facings: {quality.ocr_empty_facings ?? 0}</span>
      </div>

      {facings.length === 0 ? (
        <div className="mt-3">
          <EmptyState
            icon={<Sparkles className="size-5" />}
            title="Nothing to review"
            description="Every facing on this shelf was recognised with high confidence."
          />
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-border rounded-xl border border-border">
          {facings.map((facing) => {
            const fix = corrected.get(`${facing.brand}::${facing.product}`);
            return (
              <li key={facing.id} className="flex items-center gap-3 p-3">
                <FacingCrop src={data.annotated_image_url ?? data.original_image_url} box={facing.box} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {fix?.corrected_brand ?? facing.brand} ·{" "}
                    {fix?.corrected_product ?? facing.product}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[
                      facing.pack_text ? `“${facing.pack_text}”` : null,
                      confidenceLabel(facing),
                      facing.recognition_source ? `via ${facing.recognition_source}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "No OCR text captured"}
                  </p>
                  {fix ? (
                    <Badge
                      variant="outline"
                      className="mt-1 rounded-full border-accent-green/30 bg-accent-green/10 text-accent-green"
                    >
                      Corrected
                    </Badge>
                  ) : null}
                </div>
                <Button
                  variant="subtle"
                  size="sm"
                  className="rounded-xl"
                  onClick={() => setEditing(facing)}
                >
                  <Pencil className="size-4" /> Edit
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <CorrectionDialog
        facing={editing}
        data={data}
        onClose={() => setEditing(null)}
        onSaved={() => {
          void correctionsQuery.refetch();
          onCorrected?.();
        }}
      />
    </ResultSection>
  );
}

function CorrectionDialog({
  facing,
  data,
  onClose,
  onSaved,
}: {
  facing: ScanFacing | null;
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
    if (!facing) return;
    setBrand(facing.brand === "Unknown" ? "" : facing.brand);
    setProduct(facing.product === "Unknown product" ? "" : facing.product);
    setVariant(facing.variant ?? "");
    setPackText(facing.pack_text ?? "");
  }, [facing]);

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
        box: facing?.box,
        corrected_brand: brand.trim(),
        corrected_product: product.trim(),
        corrected_variant: variant.trim() || undefined,
        corrected_ocr_label: packText.trim() || undefined,
        predicted_brand: facing?.brand,
        predicted_product: facing?.product,
        pack_text: facing?.pack_text,
        category: data.scan_category,
        sub_category: data.scan_sub_category,
      }),
    onSuccess: () => {
      toast.success("Correction saved — it will train the next benchmark run.");
      void queryClient.invalidateQueries({ queryKey: ["scan-result", data.scan_id] });
      onSaved();
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const valid = brand.trim().length > 0 && product.trim().length > 0;

  return (
    <Dialog open={Boolean(facing)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Correct this facing</DialogTitle>
          <DialogDescription>
            AI predicted {facing?.brand ?? "—"} · {facing?.product ?? "—"}. Your correction updates
            this audit's inventory and is exported for benchmark training.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="correct-brand">Brand</Label>
            <Input
              id="correct-brand"
              list="aislix-catalog-brands"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="e.g. Lay's"
            />
            <datalist id="aislix-catalog-brands">
              {(suggestions.data?.brands ?? []).map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="correct-product">Product name</Label>
            <Input
              id="correct-product"
              list="aislix-catalog-products"
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              placeholder="e.g. Magic Masala"
            />
            <datalist id="aislix-catalog-products">
              {(suggestions.data?.products ?? []).map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="correct-variant">Variant (optional)</Label>
            <Input
              id="correct-variant"
              value={variant}
              onChange={(e) => setVariant(e.target.value)}
              placeholder="e.g. 52g"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="correct-pack">Pack text / OCR label</Label>
            <Input
              id="correct-pack"
              value={packText}
              onChange={(e) => setPackText(e.target.value)}
              placeholder="What is printed on the pack"
            />
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
            {save.isPending ? <Loader2 className="size-4 animate-spin" /> : null} Save correction
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
