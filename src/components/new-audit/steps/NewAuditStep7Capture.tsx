import { toast } from "sonner";

import { AiShelfPhotoCapture } from "@/components/ai-audit/AiShelfPhotoCapture";
import { NewAuditStepSection } from "@/components/new-audit/NewAuditStepSection";
import { Progress } from "@/components/ui/progress";

type Props = {
  captureFile: File | null;
  capturePreviewUrl: string | null;
  onCaptureChange: (file: File | null, previewUrl: string | null) => void;
  disabled?: boolean;
  complete?: boolean;
  error?: string | null;
  /** 0–100 while uploading to the server; null when idle. */
  uploadProgress?: number | null;
  uploading?: boolean;
};

export function NewAuditStep7Capture({
  captureFile,
  capturePreviewUrl,
  onCaptureChange,
  disabled,
  complete,
  error,
  uploadProgress = null,
  uploading = false,
}: Props) {
  return (
    <NewAuditStepSection
      id="step-7-capture"
      stepNumber={7}
      title="Capture shelf photo"
      description="Upload or take a shelf photo, then run the audit. Results open on this page."
      complete={complete}
      error={error}
    >
      <AiShelfPhotoCapture
        file={captureFile}
        previewUrl={capturePreviewUrl}
        onFileChange={(file, url) => {
          try {
            onCaptureChange(file, url);
          } catch (captureError) {
            toast.error(
              captureError instanceof Error
                ? captureError.message
                : "Could not use that photo.",
            );
          }
        }}
        disabled={disabled}
      />
      {uploading ? (
        <div className="mt-4 space-y-2 rounded-xl border border-[var(--aislix-border)] bg-[var(--aislix-surface)]/60 px-4 py-3">
          <div className="flex items-center justify-between text-[13px] text-[var(--aislix-secondary)]">
            <span>Uploading shelf photo…</span>
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
