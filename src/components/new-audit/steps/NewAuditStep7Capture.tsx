import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, ImagePlus, ScanLine, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

import { GuidedSweepCamera } from "@/components/guided-capture/GuidedSweepCamera";
import { NewAuditStepSection } from "@/components/new-audit/NewAuditStepSection";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { SweepCaptureMeta } from "@/lib/guided-capture";
import type { AuditRoleTab } from "@/lib/role-audit-ui";
import { MAX_SCAN_IMAGES, validateScanFile } from "@/lib/scan-api";

type SamplePhoto = {
  imageUrl: string;
  active: boolean;
  onUse: () => void;
  onClear: () => void;
};

type Props = {
  captureFiles: File[];
  /** `meta` is set after a guided sweep; plain uploads leave it undefined. */
  onCaptureChange: (files: File[], meta?: SweepCaptureMeta | null) => void;
  role?: AuditRoleTab | null;
  disabled?: boolean;
  complete?: boolean;
  error?: string | null;
  /** 0–100 while uploading to the server; null when idle. */
  uploadProgress?: number | null;
  uploading?: boolean;
  stepNumber?: number;
  maxPhotos?: number;
  /** Offers a ready-made shelf photo instead of an upload. */
  sample?: SamplePhoto;
  /** False when the audit runs without a document; the copy must not promise a comparison. */
  hasDocument?: boolean;
};

export function NewAuditStep7Capture({
  captureFiles,
  onCaptureChange,
  role,
  disabled,
  complete,
  error,
  uploadProgress = null,
  uploading = false,
  stepNumber = 8,
  maxPhotos = MAX_SCAN_IMAGES,
  sample,
  hasDocument = true,
}: Props) {
  const [sweepOpen, setSweepOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const previews = useMemo(() => captureFiles.map((file) => URL.createObjectURL(file)), [captureFiles]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);
  const usingSample = Boolean(sample?.active);
  const full = captureFiles.length >= maxPhotos;
  const single = maxPhotos === 1;

  function addFiles(list: FileList | null) {
    if (!list?.length) return;
    const next = single ? [] : [...captureFiles];
    for (const file of Array.from(list)) {
      if (next.length >= maxPhotos) {
        toast.error(single ? "One shelf photo per audit." : `Up to ${maxPhotos} shelf photos per audit.`);
        break;
      }
      const problem = validateScanFile(file);
      if (problem) {
        toast.error(`${file.name}: ${problem}`);
        continue;
      }
      next.push(file);
    }
    if (next.length && usingSample) sample?.onClear();
    onCaptureChange(next);
  }

  const addDisabled = disabled || (full && !single);

  return (
    <NewAuditStepSection
      id="step-8-capture"
      stepNumber={stepNumber}
      title={single ? "Capture shelf photo" : "Capture shelf photos"}
      description={
        single
          ? `Add one clear photo of the shelf. AI counts it${hasDocument ? " against your document" : ""}.`
          : `Add 1–${maxPhotos} photos of the shelf — one per section, without overlapping. AI counts them together${hasDocument ? " against your document" : ""}.`
      }
      complete={complete}
      error={error}
    >
      <div className="overflow-hidden rounded-xl border border-[var(--aislix-border)] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--aislix-border)] px-5 py-4">
          <div>
            <p className="font-display text-[15px] font-semibold text-[var(--aislix-primary)]">
              {single ? "Your shelf photo" : "Your shelf photos"}
            </p>
            <p className="mt-1 text-[13px] text-[var(--aislix-secondary)]">
              {usingSample
                ? "Sample shelf photo selected"
                : captureFiles.length
                  ? `${captureFiles.length} of ${maxPhotos} added`
                  : "Upload from your device or take photos with your phone camera"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="brand"
              size="sm"
              disabled={addDisabled}
              onClick={() => setSweepOpen(true)}
            >
              <ScanLine className="size-4" /> Guided sweep
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={addDisabled}
              onClick={() => fileRef.current?.click()}
            >
              <ImagePlus className="size-4" /> {single ? "Upload photo" : "Upload photos"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={addDisabled}
              onClick={() => cameraRef.current?.click()}
            >
              <Camera className="size-4" /> Take photo
            </Button>
            {sample && !usingSample ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={() => {
                  onCaptureChange([]);
                  sample.onUse();
                }}
              >
                <Sparkles className="size-4" /> Use sample shelf photo
              </Button>
            ) : null}
          </div>
        </div>
        <div className="p-5">
          {usingSample && sample ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <figure className="relative overflow-hidden rounded-lg border border-[var(--aislix-border)] bg-[var(--aislix-surface)]">
                <img src={sample.imageUrl} alt="Sample shelf photo" className="h-32 w-full object-contain" />
                <figcaption className="truncate border-t border-[var(--aislix-border)] px-2 py-1 text-[11px] text-[var(--aislix-secondary)]">
                  Sample shelf
                </figcaption>
                {!disabled ? (
                  <button
                    type="button"
                    aria-label="Remove sample shelf photo"
                    className="absolute right-1.5 top-1.5 rounded-full border border-[var(--aislix-border)] bg-white p-1 text-[var(--aislix-secondary)] hover:text-[var(--aislix-primary)]"
                    onClick={sample.onClear}
                  >
                    <X className="size-3" />
                  </button>
                ) : null}
              </figure>
            </div>
          ) : captureFiles.length ? (
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
              className="flex h-36 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--aislix-border)] bg-[var(--aislix-surface)] text-xs text-[var(--aislix-secondary)] hover:border-[#9FB3C8]"
            >
              <ImagePlus className="size-5 text-[#04203F]" />
              No photos yet — JPEG or PNG, max 10 MB each
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          multiple={!single}
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
      <GuidedSweepCamera
        open={sweepOpen}
        onOpenChange={setSweepOpen}
        role={role}
        maxPhotos={single ? 1 : maxPhotos - captureFiles.length}
        onComplete={(result) => {
          if (usingSample) sample?.onClear();
          onCaptureChange(single ? result.files.slice(0, 1) : [...captureFiles, ...result.files], result.meta);
        }}
      />
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
