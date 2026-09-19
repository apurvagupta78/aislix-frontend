import { ChevronDown } from "lucide-react";

import { AssignmentPreviewPanel } from "@/components/assignment-engine/AssignmentPreviewPanel";
import { AssignmentSchedulePanel } from "@/components/assignment-engine/AssignmentSchedulePanel";
import { TeamAssignmentPanel } from "@/components/assignment-engine/TeamAssignmentPanel";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type {
  AssignmentMode,
  AssignmentPreview,
  DistributionStrategy,
  DueConfig,
  RecurrenceRule,
  TeamScope,
} from "@/lib/assignment-engine";
import type { AssignableMember } from "@/lib/assignments";

type Props = {
  locationCount: number;
  members: AssignableMember[];
  teamScope: TeamScope;
  distributionStrategy: DistributionStrategy;
  assignToSelf: boolean;
  assignmentMode: AssignmentMode;
  publishAt: string;
  dueConfig: DueConfig;
  recurrence: RecurrenceRule;
  reviewerId: string;
  instructions: string;
  campaignName: string;
  preview: AssignmentPreview | null;
  onTeamChange: (scope: TeamScope) => void;
  onStrategyChange: (strategy: DistributionStrategy) => void;
  onAssignToSelfChange: (value: boolean) => void;
  onAssignmentModeChange: (mode: AssignmentMode) => void;
  onPublishAtChange: (value: string) => void;
  onDueConfigChange: (value: DueConfig) => void;
  onRecurrenceChange: (value: RecurrenceRule) => void;
  onReviewerChange: (value: string) => void;
  onInstructionsChange: (value: string) => void;
  onCampaignNameChange: (value: string) => void;
};

export function SimpleAssignmentPanel({
  locationCount,
  members,
  teamScope,
  distributionStrategy,
  assignToSelf,
  assignmentMode,
  publishAt,
  dueConfig,
  recurrence,
  reviewerId,
  instructions,
  campaignName,
  preview,
  onTeamChange,
  onStrategyChange,
  onAssignToSelfChange,
  onAssignmentModeChange,
  onPublishAtChange,
  onDueConfigChange,
  onRecurrenceChange,
  onReviewerChange,
  onInstructionsChange,
  onCampaignNameChange,
}: Props) {
  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Who should perform it?</h2>
          <p className="text-sm text-muted-foreground">
            Choose team members to run this audit.
          </p>
        </div>
        <TeamAssignmentPanel
          members={members}
          teamScope={teamScope}
          onTeamChange={onTeamChange}
          singleAssignee={assignToSelf}
        />
        <Label className="flex items-center gap-2 rounded-xl border p-4">
          <Checkbox
            checked={assignToSelf}
            onCheckedChange={(v) => onAssignToSelfChange(v === true)}
          />
          Assign to myself and start now
        </Label>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">When?</h2>
          <p className="text-sm text-muted-foreground">Assign now or schedule for later.</p>
        </div>
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
      </section>

      <section className="rounded-xl border border-border bg-muted/20 p-4">
        <p className="text-sm font-medium">{locationCount} location{locationCount === 1 ? "" : "s"} in this audit</p>
        <p className="text-xs text-muted-foreground">
          Distribution settings are optional for most audits.
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Campaign name (optional)</Label>
          <Input
            value={campaignName}
            onChange={(e) => onCampaignNameChange(e.target.value)}
            placeholder="e.g. September store audit"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Reviewer (optional)</Label>
          <Select value={reviewerId} onValueChange={onReviewerChange}>
            <SelectTrigger>
              <SelectValue placeholder="Optional reviewer" />
            </SelectTrigger>
            <SelectContent>
              {members.map((member) => (
                <SelectItem key={member.user_id} value={member.user_id}>
                  {member.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Instructions for the auditor</Label>
        <Textarea value={instructions} onChange={(e) => onInstructionsChange(e.target.value)} />
      </div>

      <Collapsible defaultOpen={false}>
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left">
          <span className="text-sm font-semibold">Advanced assignment</span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3">
          {preview ? (
            <AssignmentPreviewPanel preview={preview} />
          ) : (
            <div className="rounded-xl border p-4 text-sm text-muted-foreground">
              Select at least one location and one auditor to preview assignments.
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
