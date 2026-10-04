import type { ReactNode } from "react";
import { LayoutTemplate } from "lucide-react";

import { AiPlanogramChoice } from "@/components/new-audit/AiPlanogramChoice";
import { NewAuditDemoSetupPanel } from "@/components/new-audit/NewAuditDemoSetupPanel";
import { OperatingModelCards } from "@/components/new-audit/OperatingModelCards";
import { NewAuditStepSection } from "@/components/new-audit/NewAuditStepSection";
import { StartChoiceCards } from "@/components/new-audit/StartChoiceCards";
import { Button } from "@/components/ui/button";
import type { OperatingModel } from "@/lib/audit-builder/types";
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
  onAiPlanogramReset: () => void;
  onScanContextChange: (ctx: ScanContextState) => void;
  onOpenTemplatePicker: () => void;
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
  onAiPlanogramReset,
  onScanContextChange,
  onOpenTemplatePicker,
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

  if (isAi && !aiPlanogramChoice) {
    return (
      <NewAuditStepSection
        id="step-3-start"
        stepNumber={3}
        title="What should the shelf be compared against?"
        description="Your planogram, nothing (analyse what is visible), or your own document."
        complete={complete}
        error={planogramError}
      >
        <AiPlanogramChoice value={aiPlanogramChoice} onChange={onAiPlanogramChange} />
      </NewAuditStepSection>
    );
  }

  if (isAi && aiPlanogramChoice) {
    return (
      <NewAuditStepSection
        id="step-3-start"
        stepNumber={3}
        title={aiPlanogramChoice === "reference" ? "Upload your document" : "Tell Aislix what you're auditing"}
        description={
          aiPlanogramChoice === "without"
            ? "Pick who this audit is for, plus the category and sub-category."
            : aiPlanogramChoice === "reference"
              ? "Upload an invoice, list, PDF or CSV. Review the lines, edit anything, then save."
              : "Pick who this audit is for and the category and sub-category, then upload your planogram."
        }
        complete={complete}
        error={planogramError}
      >
        <NewAuditDemoSetupPanel
          planogramChoice={aiPlanogramChoice}
          scanContext={demoScanContext}
          onScanContextChange={onScanContextChange}
          onBack={onAiPlanogramReset}
        />
      </NewAuditStepSection>
    );
  }

  return (
    <NewAuditStepSection
      id="step-3-start"
      stepNumber={3}
      title="How do you want to start?"
      description="Pick one starting method for this audit."
      complete={complete}
      error={error}
    >
      <StartChoiceCards
        hideHeader
        value={startChoice}
        onChange={onStartChoiceChange}
        selectedTemplateName={selectedTemplateName}
        onOpenTemplatePicker={onOpenTemplatePicker}
      />

      {startChoice === "template" ? (
        <div className="mt-6 space-y-6 border-t border-[var(--aislix-border)] pt-6">
          <OperatingModelCards
            value={operatingModel}
            onChange={onOperatingModelChange}
            error={operatingModelError}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="brand" onClick={onOpenTemplatePicker}>
              <LayoutTemplate className="size-4" />
              {selectedTemplateName ? "Change template" : "Select template"}
            </Button>
            {selectedTemplateName ? (
              <span className="text-sm text-[var(--aislix-secondary)]">{selectedTemplateName}</span>
            ) : null}
          </div>
          {templateIsPlanogram ? (
            <p className="text-sm text-[var(--aislix-secondary)]">{demoPlanogramSummary()}</p>
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
