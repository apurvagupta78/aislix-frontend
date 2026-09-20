import { cn } from "@/lib/utils";
import type { AssignmentMode } from "@/lib/assignment-engine";
import type { CaptureMethod } from "@/lib/new-audit/summary";
import {
  getNewAuditNavSteps,
  scrollToNewAuditStep,
  type NewAuditStepId,
  type StepValidationResult,
} from "@/lib/new-audit/step-validation";

type Props = {
  stepStatus: StepValidationResult;
  method?: CaptureMethod;
  assignToSelf?: boolean;
  assignmentMode?: AssignmentMode;
  className?: string;
};

export function NewAuditStepNav({
  stepStatus,
  method,
  assignToSelf,
  assignmentMode = "assign_now",
  className,
}: Props) {
  const steps = getNewAuditNavSteps(
    method ?? "digital",
    assignToSelf ?? false,
    assignmentMode,
  );
  return (
    <nav
      className={cn(
        "sticky top-0 z-30 -mx-1 mb-6 overflow-x-auto rounded-2xl border border-[var(--aislix-border)] bg-white/95 px-2 py-2 backdrop-blur",
        className,
      )}
      aria-label="New audit steps"
    >
      <ol className="flex min-w-max items-center gap-1">
        {steps.map((step) => {
          const complete = stepStatus[step.id as NewAuditStepId];
          return (
            <li key={step.id}>
              <button
                type="button"
                onClick={() => scrollToNewAuditStep(step.anchor)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                  complete
                    ? "bg-[var(--aislix-supermarket-bg)] text-[var(--aislix-primary)]"
                    : "text-[var(--aislix-secondary)] hover:bg-[var(--aislix-surface)]",
                )}
              >
                <span className="mr-1 opacity-70">{step.id}</span>
                {step.label}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
