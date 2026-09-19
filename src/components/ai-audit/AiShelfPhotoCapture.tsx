import { useRef } from "react";
import { Camera, ImagePlus, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { validateScanFile } from "@/lib/scan-api";
import { cn } from "@/lib/utils";

type Props = {
  file: File | null;
  previewUrl: string | null;
  onFileChange: (file: File | null, previewUrl: string | null) => void;
  disabled?: boolean;
  className?: string;
};

export function AiShelfPhotoCapture({
  file,
  previewUrl,
  onFileChange,
  disabled,
  className,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  function handleFile(next: File) {
    const error = validateScanFile(next);
    if (error) {
      onFileChange(null, null);
      throw new Error(error);
    }
    const url = URL.createObjectURL(next);
    onFileChange(next, url);
  }

  return (
    <div className={cn("overflow-hidden rounded-xl border border-[var(--aislix-border)] bg-white", className)}>
      <div className="border-b border-[var(--aislix-border)] px-5 py-4">
        <p className="font-display text-[15px] font-semibold text-[var(--aislix-primary)]">
          Your shelf photo
        </p>
        <p className="mt-1 text-[13px] text-[var(--aislix-secondary)]">
          Upload from your device or take a photo with your phone camera
        </p>
      </div>
      <div className="flex flex-col items-center gap-4 p-5 sm:flex-row sm:items-start">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="Shelf preview"
            className="max-h-44 w-full max-w-[220px] rounded-lg border border-[var(--aislix-border)] object-contain"
          />
        ) : (
          <div className="flex h-36 w-full max-w-[220px] items-center justify-center rounded-lg border border-dashed border-[var(--aislix-border)] bg-[var(--aislix-surface)] text-xs text-[var(--aislix-secondary)]">
            No photo yet
          </div>
        )}
        <div className="flex w-full flex-1 flex-col gap-2 sm:max-w-xs">
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start"
            disabled={disabled}
            onClick={() => fileRef.current?.click()}
          >
            <ImagePlus className="size-4" /> Upload shelf photo
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start"
            disabled={disabled}
            onClick={() => cameraRef.current?.click()}
          >
            <Camera className="size-4" /> Take photo on mobile
          </Button>
          {file ? (
            <p className="text-[11px] text-[var(--aislix-secondary)]">
              {file.name} · ready to analyse
            </p>
          ) : (
            <p className="text-[11px] text-[var(--aislix-secondary)]">
              JPEG or PNG, max 10 MB. On mobile, &quot;Take photo&quot; opens your camera.
            </p>
          )}
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) handleFile(f);
        }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) handleFile(f);
        }}
      />
    </div>
  );
}
