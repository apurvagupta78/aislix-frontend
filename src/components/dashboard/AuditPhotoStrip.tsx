import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** Every photo from the audit as a small, uncropped thumbnail; clicking opens it full size. */
export function AuditPhotoStrip({ urls, title }: { urls: string[]; title: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const count = urls.length;

  useEffect(() => {
    if (open == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setOpen((i) => (i == null ? i : (i + 1) % count));
      if (e.key === "ArrowLeft") setOpen((i) => (i == null ? i : (i - 1 + count) % count));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, count]);

  if (!count) return null;
  const current = open != null ? urls[open] : null;

  return (
    <div>
      <p className="mb-1.5 text-xs text-[#667085]">
        {count} photo{count === 1 ? "" : "s"} · click to view full size
      </p>
      <div className="flex flex-wrap gap-2">
        {urls.map((url, i) => (
          <button
            key={url}
            type="button"
            onClick={() => setOpen(i)}
            className="flex h-20 w-24 items-center justify-center overflow-hidden rounded-lg border border-[#D9E2E8] bg-[#F4F7F9] transition-colors hover:border-[#04203F]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#04203F]"
            aria-label={`View photo ${i + 1} of ${count} full size`}
          >
            <img src={url} alt="" loading="lazy" className="max-h-full max-w-full object-contain" />
          </button>
        ))}
      </div>

      <Dialog open={open != null} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-w-5xl p-3 sm:p-4">
          <DialogHeader>
            <DialogTitle className="text-sm text-[#04203F]">{title}</DialogTitle>
            <DialogDescription className="text-xs">
              Photo {(open ?? 0) + 1} of {count}
            </DialogDescription>
          </DialogHeader>
          {current ? (
            <div className="relative flex items-center justify-center rounded-lg bg-[#F4F7F9]">
              <img
                src={current}
                alt={`Shelf photo ${(open ?? 0) + 1} of ${count}`}
                className="max-h-[75vh] w-auto max-w-full object-contain"
              />
              {count > 1 ? (
                <>
                  <NavButton side="left" onClick={() => setOpen((i) => ((i ?? 0) - 1 + count) % count)} />
                  <NavButton side="right" onClick={() => setOpen((i) => ((i ?? 0) + 1) % count)} />
                </>
              ) : null}
            </div>
          ) : null}
          {count > 1 ? (
            <div className="flex flex-wrap justify-center gap-1.5">
              {urls.map((url, i) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => setOpen(i)}
                  className={cn(
                    "flex h-12 w-14 items-center justify-center overflow-hidden rounded-md border bg-[#F4F7F9]",
                    i === open ? "border-[#04203F]" : "border-[#D9E2E8]",
                  )}
                  aria-label={`Show photo ${i + 1}`}
                  aria-current={i === open}
                >
                  <img src={url} alt="" className="max-h-full max-w-full object-contain" />
                </button>
              ))}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NavButton({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "absolute top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full border border-[#D9E2E8] bg-white text-[#04203F] hover:bg-[#F4F7F9]",
        side === "left" ? "left-2" : "right-2",
      )}
      aria-label={side === "left" ? "Previous photo" : "Next photo"}
    >
      <Icon className="size-4" />
    </button>
  );
}
