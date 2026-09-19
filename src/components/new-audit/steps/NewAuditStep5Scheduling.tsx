import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AssignmentSchedulePanel } from "@/components/assignment-engine/AssignmentSchedulePanel";
import { NewAuditStepSection } from "@/components/new-audit/NewAuditStepSection";
import type {
  AssignmentMode,
  DueConfig,
  RecurrenceRule,
} from "@/lib/assignment-engine";

type Props = {
  assignmentMode: AssignmentMode;
  publishAt: string;
  dueConfig: DueConfig;
  recurrence: RecurrenceRule;
  instructions: string;
  onAssignmentModeChange: (mode: AssignmentMode) => void;
  onPublishAtChange: (value: string) => void;
  onDueConfigChange: (value: DueConfig) => void;
  onRecurrenceChange: (value: RecurrenceRule) => void;
  onInstructionsChange: (value: string) => void;
  complete?: boolean;
  error?: string | null;
};

export function NewAuditStep5Scheduling({
  assignmentMode,
  publishAt,
  dueConfig,
  recurrence,
  instructions,
  onAssignmentModeChange,
  onPublishAtChange,
  onDueConfigChange,
  onRecurrenceChange,
  onInstructionsChange,
  complete,
  error,
}: Props) {
  return (
    <NewAuditStepSection
      id="step-5-when"
      stepNumber={5}
      title="When?"
      description="Assign immediately or schedule for later."
      complete={complete}
      error={error}
    >
      <div className="space-y-5">
        <AssignmentSchedulePanel
          mode={assignmentMode}
          onModeChange={onAssignmentModeChange}
          publishAt={publishAt}
          onPublishAtChange={onPublishAtChange}
          dueConfig={dueConfig}
          onDueConfigChange={onDueConfigChange}
          recurrence={recurrence}
          onRecurrenceChange={onRecurrenceChange}
        />
        <div className="space-y-1.5">
          <Label>Instructions for the auditor</Label>
          <Textarea
            value={instructions}
            onChange={(e) => onInstructionsChange(e.target.value)}
            className="min-h-[88px] rounded-xl"
            placeholder="Any special instructions for the team..."
          />
        </div>
      </div>
    </NewAuditStepSection>
  );
}
