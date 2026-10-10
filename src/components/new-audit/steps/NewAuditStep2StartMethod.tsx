import { useState, type ReactNode } from "react";
import { FileText, type LucideIcon } from "lucide-react";

import { AiDocumentAuditSetup } from "@/components/new-audit/AiDocumentAuditSetup";
import { OperatingModelCards, operatingModelIcon } from "@/components/new-audit/OperatingModelCards";
import { NewAuditStepSection } from "@/components/new-audit/NewAuditStepSection";
import { StartChoiceCards } from "@/components/new-audit/StartChoiceCards";
import { TemplateChoiceGrid } from "@/components/new-audit/TemplateChoiceGrid";
import type { AiAnalysisCheck } from "@/lib/ai-audit/ai-analysis";
import type { OperatingModel } from "@/lib/audit-builder/types";
import type { AuditTemplate } from "@/lib/audit-templates";
import { OPERATING_MODEL_CARDS } from "@/lib/audit-engine/operating-model-catalog";
import {
  demoPlanogramSummaryText,
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

function ChoiceSummaryRow({
  icon: Icon,
  label,
  value,
  onChange,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#F4F7F9]">
        <Icon className="size-4 text-[#04203F]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-[#667085]">{label}</p>
        <p className="truncate text-sm font-semibold text-[#04203F]">{value}</p>
      </div>
      <button
        type="button"
        onClick={onChange}
        aria-label={`Change ${label.toLowerCase()}`}
        className="shrink-0 rounded-md border border-[#D9E2E8] px-2.5 py-1 text-xs font-semibold text-[#04203F] transition-colors hover:bg-[#F4F7F9]"
      >
        Change
      </button>
    </div>
  );
}

function CancelButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 rounded-md px-2.5 py-1.5 text-xs font-semibold text-[#667085] transition-colors hover:bg-[#F4F7F9] hover:text-[#04203F]"
    >
      Cancel
    </button>
  );
}

export const STEP_3_TITLE = "What should Aislix work with?";
export const STEP_3_DESCRIPTION =
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
  const [reopen, setReopen] = useState<"operation" | "template" | null>(null);
  const picked = templateChoice !== "general" && Boolean(selectedTemplateName);
  const modelTitle = OPERATING_MODEL_CARDS.find((c) => c.id === operatingModel)?.title ?? "";

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
          {picked && !reopen ? (
            <div className="divide-y divide-[#D9E2E8] rounded-xl border border-[#D9E2E8] bg-white">
              <ChoiceSummaryRow
                icon={operatingModelIcon(operatingModel)}
                label="Auditing"
                value={modelTitle}
                onChange={() => setReopen("operation")}
              />
              <ChoiceSummaryRow
                icon={FileText}
                label="Template"
                value={selectedTemplateName ?? ""}
                onChange={() => setReopen("template")}
              />
            </div>
          ) : null}
          {!picked || reopen === "operation" ? (
            <OperatingModelCards
              value={operatingModel}
              onChange={(model) => {
                setReopen(null);
                if (model !== operatingModel || !picked) onOperatingModelChange(model);
              }}
              error={operatingModelError}
              headerAction={picked ? <CancelButton onClick={() => setReopen(null)} /> : null}
            />
          ) : null}
          {picked && reopen === "operation" ? (
            <div className="rounded-xl border border-[#D9E2E8] bg-white">
              <ChoiceSummaryRow
                icon={FileText}
                label="Template"
                value={selectedTemplateName ?? ""}
                onChange={() => setReopen("template")}
              />
            </div>
          ) : null}
          {picked && reopen === "template" ? (
            <div className="rounded-xl border border-[#D9E2E8] bg-white">
              <ChoiceSummaryRow
                icon={operatingModelIcon(operatingModel)}
                label="Auditing"
                value={modelTitle}
                onChange={() => setReopen("operation")}
              />
            </div>
          ) : null}
          {!picked || reopen === "template" ? (
            <div id="step-3-templates" className="scroll-mt-24">
              <TemplateChoiceGrid
                operatingModel={operatingModel}
                templateChoice={templateChoice}
                savedTemplates={savedTemplates}
                onSelect={(choice, meta) => {
                  setReopen(null);
                  onTemplateSelect(choice, meta);
                }}
                headerAction={picked ? <CancelButton onClick={() => setReopen(null)} /> : null}
              />
            </div>
          ) : null}
          {selectedTemplateName && templateSetup ? (
            <div id="step-3-template-fields" className="scroll-mt-24 space-y-3">
              {templateSetup}
              {templateIsPlanogram ? (
                <p className="text-sm text-[var(--aislix-secondary)]">{demoPlanogramSummaryText()}</p>
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
            <h4 className="text-sm font-semibold text-[#04203F]">Evidence required</h4>
            <p className="mt-0.5 text-xs text-[#667085]">
              What the auditee must capture before they can submit. Every option you tick is checked on submit.
            </p>
          </div>
          {evidenceSettings}
          {evidenceError ? (
            <p className="rounded-lg border border-[#D9E2E8] px-3 py-2 text-xs font-medium text-[#04203F]" style={{ background: "#FFEAF1" }}>
              {evidenceError}
            </p>
          ) : null}
        </div>
      ) : null}
    </NewAuditStepSection>
  );
}
