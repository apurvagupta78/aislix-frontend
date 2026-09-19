import { UserCheck } from "lucide-react";

import { TeamAssignmentPanel } from "@/components/assignment-engine/TeamAssignmentPanel";
import { NewAuditStepSection } from "@/components/new-audit/NewAuditStepSection";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { TeamScope } from "@/lib/assignment-engine";
import type { AssignableMember } from "@/lib/assignments";

type Props = {
  members: AssignableMember[];
  teamScope: TeamScope;
  assignToSelf: boolean;
  onTeamChange: (scope: TeamScope) => void;
  onAssignToSelfChange: (value: boolean) => void;
  complete?: boolean;
  error?: string | null;
};

export function NewAuditStep4Assignment({
  members,
  teamScope,
  assignToSelf,
  onTeamChange,
  onAssignToSelfChange,
  complete,
  error,
}: Props) {
  return (
    <NewAuditStepSection
      id="step-4-who"
      stepNumber={4}
      title="Who?"
      description="Choose team members or assign the audit to yourself."
      complete={complete}
      error={error}
    >
      <div className="space-y-4">
        <TeamAssignmentPanel
          members={members}
          teamScope={teamScope}
          onTeamChange={onTeamChange}
          singleAssignee={assignToSelf}
        />
        <Label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--aislix-local-border)] bg-[var(--aislix-local-bg)] p-4">
          <Checkbox
            checked={assignToSelf}
            onCheckedChange={(v) => onAssignToSelfChange(v === true)}
          />
          <span className="flex items-center gap-2 text-sm font-semibold text-[var(--aislix-primary)]">
            <UserCheck className="size-4" />
            Assign to myself and start now
          </span>
        </Label>
      </div>
    </NewAuditStepSection>
  );
}
