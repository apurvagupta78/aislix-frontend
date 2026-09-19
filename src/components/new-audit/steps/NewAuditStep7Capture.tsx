import { toast } from "sonner";

import { AiShelfPhotoCapture } from "@/components/ai-audit/AiShelfPhotoCapture";
import { NewAuditStepSection } from "@/components/new-audit/NewAuditStepSection";

type Props = {
  captureFile: File | null;
  capturePreviewUrl: string | null;
  onCaptureChange: (file: File | null, previewUrl: string | null) => void;
  disabled?: boolean;
  complete?: boolean;
  error?: string | null;
};

export function NewAuditStep7Capture({
  captureFile,
  capturePreviewUrl,
  onCaptureChange,
  disabled,
  complete,
  error,
}: Props) {
  return (
    <NewAuditStepSection
      id="step-7-capture"
      stepNumber={7}
      title="Capture shelf photo"
      description="Upload or take a shelf photo, then run the audit. Analysis opens in a new tab."
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
    </NewAuditStepSection>
  );
}
