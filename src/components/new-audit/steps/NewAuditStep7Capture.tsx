import { useEffect, useMemo, useRef } from "react";
import { Camera, ImagePlus, X } from "lucide-react";
import { toast } from "sonner";

import { NewAuditStepSection } from "@/components/new-audit/NewAuditStepSection";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { MAX_SCAN_IMAGES, validateScanFile } from "@/lib/scan-api";

type Props = {
  captureFiles: File[];
  onCaptureChange: (files: File[]) => void;
  disabled?: boolean;
  complete?: boolean;
  error?: string | null;
  /** 0–100 while uploading to the server; null when idle. */
  uploadProgress?: number | null;
  uploading?: boolean;
};

export function NewAuditStep7Capture({
  captureFiles,
  onCaptureChange,
  disabled,
  complete,
  error,
  uploadProgress = null,
  uploading = false,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const previews = useMemo(() => captureFiles.map((file) => URL.createObjectURL(file)), [captureFiles]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);
  const full = captureFiles.length >= MAX_SCAN_IMAGES;

  function addFiles(list: FileList | null) {
    if (!list?.length) return;
    const next = [...captureFiles];
    for (const file of Array.from(list)) {
      if (next.length >= MAX_SCAN_IMAGES) {
        toast.error(`Up to ${MAX_SCAN_IMAGES} shelf photos per audit.`);
        break;
      }
      const problem = validateScanFile(file);
      if (problem) {
        toast.error(`${file.name}: ${problem}`);
        continue;
      }
      next.push(file);
    }
    onCaptureChange(next);
  }

  return (
    <NewAuditStepSection
      id="step-8-capture"
      stepNumber={8}
      title="Capture shelf photos"
      description={`Add 1–${MAX_SCAN_IMAGES} photos of the shelf — one per section, without overlapping. AI counts them together against your document.`}
      complete={complete}
      error={error}
    >
      <div className="overflow-hidden rounded-xl border border-[var(--aislix-border)] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--aislix-border)] px-5 py-4">
          <div>
            <p className="font-display text-[15px] font-semibold text-[var(--aislix-primary)]">Your shelf photos</p>
            <p className="mt-1 text-[13px] text-[var(--aislix-secondary)]">
              {captureFiles.length
                ? `${captureFiles.length} of ${MAX_SCAN_IMAGES} added`
                : "Upload from your device or take photos with your phone camera"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || full}
              onClick={() => fileRef.current?.click()}
            >
              <ImagePlus className="size-4" /> Upload photos
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || full}
              onClick={() => cameraRef.current?.click()}
            >
              <Camera className="size-4" /> Take photo
            </Button>
          </div>
        </div>
        <div className="p-5">
          {captureFiles.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {captureFiles.map((file, index) => (
                <figure
                  key={`${file.name}-${file.size}-${index}`}
                  className="relative overflow-hidden rounded-lg border border-[var(--aislix-border)] bg-[var(--aislix-surface)]"
                >
                  <img src={previews[index]} alt={`Shelf photo ${index + 1}`} className="h-32 w-full object-contain" />
                  <figcaption className="truncate border-t border-[var(--aislix-border)] px-2 py-1 text-[11px] text-[var(--aislix-secondary)]">
                    Photo {index + 1} · {file.name}
                  </figcaption>
                  {!disabled ? (
                    <button
                      type="button"
                      aria-label={`Remove photo ${index + 1}`}
                      className="absolute right-1.5 top-1.5 rounded-full border border-[var(--aislix-border)] bg-white p-1 text-[var(--aislix-secondary)] hover:text-[var(--aislix-primary)]"
                      onClick={() => onCaptureChange(captureFiles.filter((_, i) => i !== index))}
                    >
                      <X className="size-3" />
                    </button>
                  ) : null}
                </figure>
              ))}
            </div>
          ) : (
            <button
              type="button"
              disabled={disabled}
              onClick={() => fileRef.current?.click()}
              className="flex h-36 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--aislix-border)] bg-[var(--aislix-surface)] text-xs text-[var(--aislix-secondary)] hover:border-[#7DB7D6]"
            >
              <ImagePlus className="size-5 text-[#7DB7D6]" />
              No photos yet — JPEG or PNG, max 10 MB each
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/jpeg,image/png"
          className="sr-only"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {uploading ? (
        <div className="mt-4 space-y-2 rounded-xl border border-[var(--aislix-border)] bg-[var(--aislix-surface)]/60 px-4 py-3">
          <div className="flex items-center justify-between text-[13px] text-[var(--aislix-secondary)]">
            <span>Uploading {captureFiles.length > 1 ? `${captureFiles.length} shelf photos` : "shelf photo"}…</span>
            <span className="font-medium text-[var(--aislix-primary)]">
              {Math.max(0, Math.min(100, uploadProgress ?? 0))}%
            </span>
          </div>
          <Progress value={Math.max(0, Math.min(100, uploadProgress ?? 0))} className="h-2" />
        </div>
      ) : null}
    </NewAuditStepSection>
  );
}
