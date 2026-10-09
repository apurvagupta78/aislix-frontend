import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ImageOff, Maximize2 } from "lucide-react";

import { Skeleton } from "@/components/States";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { fetchActionPhotos, type ActionPhoto } from "@/lib/action-evidence";
import type { FacingBox } from "@/lib/scan-results";

type Size = { w: number; h: number };

function boxStyle(box: FacingBox, size: Size): React.CSSProperties {
  const normalised = Math.max(box.x2, box.y2) <= 1.0001;
  const w = normalised ? 1 : size.w;
  const h = normalised ? 1 : size.h;
  return {
    left: `${(box.x1 / w) * 100}%`,
    top: `${(box.y1 / h) * 100}%`,
    width: `${((box.x2 - box.x1) / w) * 100}%`,
    height: `${((box.y2 - box.y1) / h) * 100}%`,
  };
}

function BoxedPhoto({ photo, className }: { photo: ActionPhoto; className?: string }) {
  const [size, setSize] = useState<Size | null>(null);
  return (
    <div className={`relative inline-block max-w-full ${className ?? ""}`}>
      <img
        src={photo.url}
        alt={photo.label}
        className="block max-h-[inherit] max-w-full rounded-lg object-contain"
        onLoad={(e) =>
          setSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })
        }
      />
      {size
        ? photo.boxes.map((box, i) => (
            <span
              key={i}
              aria-hidden
              className="pointer-events-none absolute rounded-sm border-2 border-[#04203F]"
              style={{ ...boxStyle(box, size), boxShadow: "0 0 0 2px #FFFFFF" }}
            />
          ))
        : null}
    </div>
  );
}

/** The audit photo(s) an action came from, with the problem product boxed when it was located. */
export function ActionAuditPhoto({
  scanId,
  source,
  sku,
  productName,
}: {
  scanId: string;
  source: "ai" | "digital";
  sku?: string | null;
  productName?: string | null;
}) {
  const [active, setActive] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const query = useQuery({
    queryKey: ["action-photos", scanId, source, sku ?? "", productName ?? ""],
    queryFn: () => fetchActionPhotos({ scanId, source, sku, productName }),
    staleTime: 30 * 60_000,
  });

  if (query.isPending) return <Skeleton className="h-64 w-full" />;
  const photos = query.data ?? [];
  if (!photos.length) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-[#D9E2E8] bg-[#F4F7F9] p-4 text-sm text-[#667085]">
        <ImageOff className="size-4 shrink-0" />
        No photo was saved with this audit.
      </div>
    );
  }

  const current = photos[Math.min(active, photos.length - 1)]!;
  const located = current.boxes.length > 0;
  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setFullscreen(true)}
        className="group relative flex w-full justify-center rounded-lg border border-[#D9E2E8] bg-[#F4F7F9] p-2 transition-colors hover:border-[#04203F]"
        aria-label="Open photo full screen"
      >
        <BoxedPhoto photo={current} className="max-h-[420px]" />
        <span className="absolute right-3 top-3 grid size-8 place-items-center rounded-lg border border-[#D9E2E8] bg-white text-[#04203F]">
          <Maximize2 className="size-4" />
        </span>
      </button>
      <p className="flex items-center gap-2 text-xs text-[#667085]">
        {located ? (
          <>
            <span className="size-1.5 rounded-full bg-[#04203F]" />
            The boxed area is where the AI found {productName ? productName : "this product"}.
          </>
        ) : (
          <>
            <span className="size-1.5 rounded-full bg-[#7DB7D6]" />
            {source === "digital"
              ? "Photo taken by the auditor during this audit."
              : `The AI did not mark an exact spot for this problem${productName ? ` — look for ${productName}` : ""}.`}
          </>
        )}
      </p>
      {photos.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {photos.map((p, i) => (
            <button
              key={p.url}
              type="button"
              onClick={() => setActive(i)}
              className={`size-16 overflow-hidden rounded-lg border ${
                i === active ? "border-[#04203F]" : "border-[#D9E2E8] hover:border-[#667085]"
              }`}
              aria-label={p.label}
            >
              <img src={p.url} alt="" className="size-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}
      <Dialog open={fullscreen} onOpenChange={setFullscreen}>
        <DialogContent className="max-w-[min(96vw,1200px)] p-3">
          <DialogTitle className="sr-only">{current.label}</DialogTitle>
          <div className="flex max-h-[85vh] justify-center overflow-auto">
            <BoxedPhoto photo={current} className="max-h-[85vh]" />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
