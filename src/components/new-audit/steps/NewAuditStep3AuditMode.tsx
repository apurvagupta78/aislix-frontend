import { NewAuditStepSection } from "@/components/new-audit/NewAuditStepSection";
import { AuditMethodCards } from "@/components/new-audit/AuditMethodCards";
import type { CaptureMethod } from "@/lib/new-audit/summary";

type Props = {
  method: CaptureMethod;
  onMethodChange: (method: CaptureMethod) => void;
  complete?: boolean;
  error?: string | null;
};

export function NewAuditStep3AuditMode({
  method,
  onMethodChange,
  complete,
  error,
}: Props) {
  return (
    <NewAuditStepSection
      id="step-2-perform"
      stepNumber={2}
      title="How will your team perform the audit?"
      description="Choose digital manual entry or AI-powered photo analysis."
      complete={complete}
      error={error}
    >
      <AuditMethodCards hideHeader value={method} onChange={onMethodChange} />
    </NewAuditStepSection>
  );
}
