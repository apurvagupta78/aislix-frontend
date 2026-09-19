import { Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { AssignableMember } from "@/lib/assignments";
import type { TeamScope } from "@/lib/assignment-engine";

type Props = {
  members: AssignableMember[];
  teamScope: TeamScope;
  onTeamChange: (scope: TeamScope) => void;
  singleAssignee?: boolean;
};

export function TeamAssignmentPanel({
  members,
  teamScope,
  onTeamChange,
  singleAssignee,
}: Props) {
  const toggleMember = (member: AssignableMember) => {
    if (singleAssignee) {
      onTeamChange({ assigneeIds: [member.user_id] });
      return;
    }
    const ids = new Set(teamScope.assigneeIds);
    if (ids.has(member.user_id)) ids.delete(member.user_id);
    else ids.add(member.user_id);
    onTeamChange({ ...teamScope, assigneeIds: [...ids] });
  };

  const selectAll = () => {
    onTeamChange({ ...teamScope, assigneeIds: members.map((member) => member.user_id) });
  };

  return (
    <div className="space-y-4 rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">Who?</p>
          <p className="text-sm text-muted-foreground">
            Choose team members to assign this audit to.
          </p>
        </div>
        <Badge variant="secondary">
          <Users className="mr-1 size-3" />
          {teamScope.assigneeIds.length} selected
        </Badge>
      </div>

      {!singleAssignee ? (
        <div className="flex gap-2">
          <button
            type="button"
            className="text-xs font-medium text-brand hover:underline"
            onClick={selectAll}
          >
            Select all
          </button>
          <button
            type="button"
            className="text-xs text-muted-foreground hover:underline"
            onClick={() => onTeamChange({ ...teamScope, assigneeIds: [] })}
          >
            Clear
          </button>
        </div>
      ) : null}

      <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border p-2">
        {members.map((member) => (
          <Label
            key={member.user_id}
            className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/50"
          >
            <Checkbox
              checked={teamScope.assigneeIds.includes(member.user_id)}
              onCheckedChange={() => toggleMember(member)}
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{member.name}</span>
              <span className="block text-xs capitalize text-muted-foreground">
                {member.role} · {member.email}
              </span>
            </span>
          </Label>
        ))}
      </div>
    </div>
  );
}
