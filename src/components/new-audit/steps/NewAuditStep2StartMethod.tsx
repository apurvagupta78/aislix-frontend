import type { ReactNode } from "react";

import { AiDocumentAuditSetup } from "@/components/new-audit/AiDocumentAuditSetup";
import { OperatingModelCards } from "@/components/new-audit/OperatingModelCards";
import { NewAuditStepSection } from "@/components/new-audit/NewAuditStepSection";
import { StartChoiceCards } from "@/components/new-audit/StartChoiceCards";
import { TemplateChoiceGrid } from "@/components/new-audit/TemplateChoiceGrid";
import type { AiAnalysisCheck } from "@/lib/ai-audit/ai-analysis";
import type { OperatingModel } from "@/lib/audit-builder/types";
import type { AuditTemplate } from "@/lib/audit-templates";
import {
  demoPlanogramSummary,
  type NewAuditPlanogramChoice,
} from "@/lib/new-audit/planogram-setup";
import type { CaptureMethod, StartChoice } from "@/lib/new-audit/summary";
import type { ScanContextState } from "@/lib/scan-context";

type Props = {
  method: CaptureMethod;
  startChoice: StartChoice;
  operatingModel: OperatingModel;
  selectedTemplateName?: string;
  templateIsPlanogram: boolean;
  aiPlanogramChoice: NewAuditPlanogramChoice | null;
  demoScanContext: ScanContextState;
  onStartChoiceChange: (choice: StartChoice) => void;
  onOperatingModelChange: (model: OperatingModel) => void;
  onAiPlanogramChange: (choice: NewAuditPlanogramChoice) => void;
  onScanContextChange: (ctx: ScanContextState) => void;
  aiChecks: AiAnalysisCheck[];
  aiQuestion: string;
  onAiChecksChange: (checks: AiAnalysisCheck[]) => void;
  onAiQuestionChange: (question: string) => void;
  templateChoice: string;
  /** Organisation + personal templates for the chosen operating model. */
  savedTemplates: AuditTemplate[];
  onTemplateSelect: (choice: string, meta: { name: string; systemKey?: string }) => void;
  /** Fields / lines editor for the selected template. */
  templateSetup?: ReactNode;
  csvUpload?: ReactNode;
  scratchBuilder?: ReactNode;
  /** Evidence requirements, shown under the audit data for Digital Audits. */
  evidenceSettings?: ReactNode;
  evidenceError?: string | null;
  complete?: boolean;
  error?: string | null;
  planogramError?: string | null;
  operatingModelError?: string | null;
};

const STEP_3_TITLE = "What should Aislix work with?";
const STEP_3_DESCRIPTION =
  "Upload planogram, documents, templates, evidence, images, or other reference material to set up your audit.";

export function NewAuditStep2StartMethod({
  method,
  startChoice,
  operatingModel,
  selectedTemplateName,
  templateIsPlanogram,
  aiPlanogramChoice,
  demoScanContext,
  onStartChoiceChange,
  onOperatingModelChange,
  onAiPlanogramChange,
  onScanContextChange,
  aiChecks,
  aiQuestion,
  onAiChecksChange,
  onAiQuestionChange,
  templateChoice,
  savedTemplates,
  onTemplateSelect,
  templateSetup,
  csvUpload,
  scratchBuilder,
  evidenceSettings,
  evidenceError,
  complete,
  error,
  planogramError,
  operatingModelError,
}: Props) {
  const isAi = method === "ai";

  if (isAi) {
    return (
      <NewAuditStepSection
        id="step-3-start"
        stepNumber={3}
        title={STEP_3_TITLE}
        description={STEP_3_DESCRIPTION}
        complete={complete}
        error={planogramError}
      >
        <AiDocumentAuditSetup
          choice={aiPlanogramChoice ?? "reference"}
          scanContext={demoScanContext}
          onScanContextChange={onScanContextChange}
          onChoiceChange={onAiPlanogramChange}
          checks={aiChecks}
          question={aiQuestion}
          onChecksChange={onAiChecksChange}
          onQuestionChange={onAiQuestionChange}
        />
      </NewAuditStepSection>
    );
  }

  return (
    <NewAuditStepSection
      id="step-3-start"
      stepNumber={3}
      title={STEP_3_TITLE}
      description={STEP_3_DESCRIPTION}
      complete={complete}
      error={error}
    >
      <StartChoiceCards hideHeader value={startChoice} onChange={onStartChoiceChange} />

      {startChoice === "template" ? (
        <div className="mt-6 space-y-6 border-t border-[var(--aislix-border)] pt-6">
          <OperatingModelCards
            value={operatingModel}
            onChange={onOperatingModelChange}
            error={operatingModelError}
          />
          <div id="step-3-templates" className="scroll-mt-24">
            <TemplateChoiceGrid
              operatingModel={operatingModel}
              templateChoice={templateChoice}
              savedTemplates={savedTemplates}
              onSelect={onTemplateSelect}
            />
          </div>
          {selectedTemplateName && templateSetup ? (
            <div id="step-3-template-fields" className="scroll-mt-24 space-y-3">
              {templateSetup}
              {templateIsPlanogram ? (
                <p className="text-sm text-[var(--aislix-secondary)]">{demoPlanogramSummary()}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {startChoice === "csv" ? <div className="mt-6">{csvUpload}</div> : null}

      {startChoice === "custom" ? <div className="mt-6">{scratchBuilder}</div> : null}

      {startChoice && evidenceSettings ? (
        <div id="step-3-evidence" className="mt-6 space-y-4 rounded-2xl border border-[#D9E2E8] bg-white p-4">
          <div>
            <h4 className="text-sm font-semibold text-[#102A43]">Evidence required</h4>
            <p className="mt-0.5 text-xs text-[#667085]">
              What the auditee must capture before they can submit. Every option you tick is checked on submit.
            </p>
          </div>
          {evidenceSettings}
          {evidenceError ? (
            <p className="rounded-lg border border-[#D9E2E8] px-3 py-2 text-xs font-medium text-[#102A43]" style={{ background: "#FFEAF1" }}>
              {evidenceError}
            </p>
          ) : null}
        </div>
      ) : null}
    </NewAuditStepSection>
  );
}
