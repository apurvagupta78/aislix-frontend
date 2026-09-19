import { AiAuditResultsView } from "@/components/ai-audit/AiAuditResultsView";
import { NewAuditStepSection } from "@/components/new-audit/NewAuditStepSection";
import type { ScanContextState } from "@/lib/scan-context";
import type { ScanResult } from "@/lib/scan-results";

type Props = {
  scanResult: ScanResult;
  scanContext: ScanContextState;
  assignmentId?: string;
  previewImageUrl?: string | null;
  complete?: boolean;
};

export function NewAuditStep8Results({
  scanResult,
  scanContext,
  assignmentId,
  previewImageUrl,
  complete,
}: Props) {
  return (
    <NewAuditStepSection
      id="step-8-results"
      stepNumber={8}
      title="AI audit results"
      description="Analysis complete — review findings and download your CSV report."
      complete={complete}
    >
      <AiAuditResultsView
        scanResult={scanResult}
        scanContext={scanContext}
        assignmentId={assignmentId}
        previewImageUrl={previewImageUrl}
      />
    </NewAuditStepSection>
  );
}
