import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, ScanBarcode, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type BarcodeScannerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (barcode: string) => void;
};

/** Camera barcode scan via native BarcodeDetector (Chrome/Android) with manual fallback hint. */
export function BarcodeScannerDialog({ open, onOpenChange, onScan }: BarcodeScannerDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [starting, setStarting] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => {
    if (!open) {
      stopCamera();
      setError(null);
      return;
    }

    type BarcodeDetectorLike = new (opts?: { formats?: string[] }) => {
      detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>;
    };
    const BarcodeDetectorCtor = (
      window as Window & { BarcodeDetector?: BarcodeDetectorLike }
    ).BarcodeDetector;
    if (!BarcodeDetectorCtor) {
      setUnsupported(true);
      return;
    }

    let cancelled = false;
    setStarting(true);
    setUnsupported(false);

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        const detector = new BarcodeDetectorCtor({
          formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "qr_code"],
        });

        const tick = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            const value = codes[0]?.rawValue?.trim();
            if (value) {
              onScan(value);
              onOpenChange(false);
              return;
            }
          } catch {
            /* frame may not be ready */
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not open the camera.");
      } finally {
        if (!cancelled) setStarting(false);
      }
    }

    void start();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [open, onOpenChange, onScan, stopCamera]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanBarcode className="size-5" /> Scan barcode
          </DialogTitle>
          <DialogDescription>
            Point the camera at the product barcode. Supported on Chrome and Android browsers.
          </DialogDescription>
        </DialogHeader>

        {unsupported ? (
          <p className="text-sm text-muted-foreground">
            Camera barcode scanning is not supported in this browser. Type or paste the barcode in
            the lookup field instead.
          </p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-black">
            {starting ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="size-8 animate-spin text-white" />
              </div>
            ) : (
              <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
            )}
          </div>
        )}

        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          <X className="size-4" /> Close
        </Button>
      </DialogContent>
    </Dialog>
  );
}
