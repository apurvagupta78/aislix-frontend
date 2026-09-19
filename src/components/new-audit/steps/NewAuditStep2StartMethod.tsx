import { FileSpreadsheet, LayoutTemplate, Plus } from "lucide-react";

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
        title="Would you like to conduct the audit with or without a planogram?"
        description="Compare against an expected shelf layout, or analyse without one."
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
        title="Tell Aislix what you're auditing"
        description={
          aiPlanogramChoice === "without"
            ? "Pick who this audit is for, category and sub-category."
            : "Pick who this audit is for, category, sub-category, and upload your planogram."
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

      {startChoice === "csv" ? (
        <div className="mt-6 rounded-xl border border-dashed border-[var(--aislix-border)] p-6 text-center">
          <FileSpreadsheet className="mx-auto mb-2 size-8 text-[var(--aislix-secondary)]" />
          <p className="text-sm text-[var(--aislix-secondary)]">
            CSV upload will be configured in a later step of this wizard.
          </p>
        </div>
      ) : null}

      {startChoice === "custom" ? (
        <div className="mt-6 rounded-xl border border-dashed border-[var(--aislix-border)] p-6 text-center">
          <Plus className="mx-auto mb-2 size-8 text-[var(--aislix-secondary)]" />
          <p className="text-sm text-[var(--aislix-secondary)]">
            Scratch builder will be configured in a later step of this wizard.
          </p>
        </div>
      ) : null}
    </NewAuditStepSection>
  );
}
