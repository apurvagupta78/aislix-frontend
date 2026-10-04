import { Camera, FileSpreadsheet } from "lucide-react";

import { AiAnalysisQuestionCard } from "@/components/new-audit/AiAnalysisQuestionCard";
import { NewAuditDemoSetupPanel } from "@/components/new-audit/NewAuditDemoSetupPanel";
import { ReferenceSourcePanel } from "@/components/new-audit/ReferenceSourcePanel";
import { defaultAiChecks, type AiAnalysisCheck } from "@/lib/ai-audit/ai-analysis";
import { usableReferenceRows } from "@/lib/ai-audit/reference-document";
import type { NewAuditPlanogramChoice } from "@/lib/new-audit/planogram-setup";
import type { ScanContextState } from "@/lib/scan-context";

type Props = {
  choice: NewAuditPlanogramChoice;
  scanContext: ScanContextState;
  onScanContextChange: (ctx: ScanContextState) => void;
  onChoiceChange: (choice: NewAuditPlanogramChoice) => void;
  checks: AiAnalysisCheck[];
  question: string;
  onChecksChange: (checks: AiAnalysisCheck[]) => void;
  onQuestionChange: (question: string) => void;
};

/**
 * AI Audit Step 3: the customer's document becomes the CSV the AI audits against
 * (or no document — shelf only), plus what Luna should analyse.
 */
export function AiDocumentAuditSetup({
  choice,
  scanContext,
  onScanContextChange,
  onChoiceChange,
  checks,
  question,
  onChecksChange,
  onQuestionChange,
}: Props) {
  const shelfOnly = choice === "without";
  const rows = scanContext.reference?.rows ?? [];
  const hasLines = usableReferenceRows(rows).length > 0;

  if (shelfOnly) {
    return (
      <div className="space-y-4">
        <NewAuditDemoSetupPanel
          planogramChoice="without"
          scanContext={scanContext}
          onScanContextChange={onScanContextChange}
          onBack={() => {
            onChoiceChange("reference");
            onChecksChange(defaultAiChecks(scanContext.reference?.rows ?? null));
          }}
          backLabel="Use a document instead"
        />
        <AiAnalysisQuestionCard
          rows={null}
          checks={checks}
          question={question}
          onChecksChange={onChecksChange}
          onQuestionChange={onQuestionChange}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-[#D9E2E8] bg-[#F4F7F9] px-4 py-3 text-xs text-[#667085]">
        <span className="inline-flex items-center gap-1.5">
          <FileSpreadsheet className="size-4 text-[#7DB7D6]" />
          <span>
            <strong className="font-semibold text-[#102A43]">1. Your document</strong> → editable CSV
          </span>
        </span>
        <span>
          <strong className="font-semibold text-[#102A43]">2. What AI should analyse</strong>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Camera className="size-4 text-[#9B86D9]" />
          <span>
            <strong className="font-semibold text-[#102A43]">3. Shelf photos</strong> — AI counts and explains
          </span>
        </span>
      </div>

      <ReferenceSourcePanel
        value={scanContext.reference}
        onChange={(reference) => {
          const hadLines = usableReferenceRows(scanContext.reference?.rows ?? []).length > 0;
          onScanContextChange({ ...scanContext, reference });
          if (!hadLines && reference && usableReferenceRows(reference.rows).length) {
            onChecksChange(defaultAiChecks(reference.rows));
          }
        }}
        category={scanContext.planogramMeta?.category}
        subCategory={scanContext.planogramMeta?.sub_category}
      />

      <AiAnalysisQuestionCard
        rows={hasLines ? rows : []}
        checks={checks}
        question={question}
        onChecksChange={onChecksChange}
        onQuestionChange={onQuestionChange}
        disabled={!hasLines}
      />

      <button
        type="button"
        className="text-xs font-medium text-[#667085] underline decoration-[#D9E2E8] underline-offset-4 hover:text-[#102A43]"
        onClick={() => {
          onChoiceChange("without");
          onChecksChange(defaultAiChecks(null));
        }}
      >
        No document? Just analyse the shelf →
      </button>
    </div>
  );
}
