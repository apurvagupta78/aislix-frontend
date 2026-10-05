import { Store, UserCheck } from "lucide-react";

import { TeamAssignmentPanel } from "@/components/assignment-engine/TeamAssignmentPanel";
import { NewAuditStepSection } from "@/components/new-audit/NewAuditStepSection";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TeamScope } from "@/lib/assignment-engine";
import type { AssignableMember } from "@/lib/assignments";

type Props = {
  members: AssignableMember[];
  teamScope: TeamScope;
  assignToSelf: boolean;
  onTeamChange: (scope: TeamScope) => void;
  onAssignToSelfChange: (value: boolean) => void;
  /** Stores chosen in Where — one audit is created for each. */
  stores?: Array<{ id: string; name: string }>;
  /** Person who audits each store (store id → user id). */
  storeAssignees?: Record<string, string>;
  onStoreAssigneeChange?: (storeId: string, userId: string) => void;
  complete?: boolean;
  error?: string | null;
};

export function NewAuditStep4Assignment({
  members,
  teamScope,
  assignToSelf,
  onTeamChange,
  onAssignToSelfChange,
  stores = [],
  storeAssignees = {},
  onStoreAssigneeChange,
  complete,
  error,
}: Props) {
  const selectedMembers = members.filter((m) => teamScope.assigneeIds.includes(m.user_id));
  const showPerStore = !assignToSelf && selectedMembers.length > 1 && stores.length > 0;
  const idle = selectedMembers.filter(
    (m) => !stores.some((s) => storeAssignees[s.id] === m.user_id),
  );

  return (
    <NewAuditStepSection
      id="step-5-who"
      stepNumber={5}
      title="Who?"
      description={
        stores.length > 1
          ? "Choose team members or assign the audits to yourself. Stores are split evenly — change the person for any store below."
          : "Choose team members or assign the audit to yourself."
      }
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

        {showPerStore ? (
          <div className="rounded-xl border border-[var(--aislix-border)] p-4">
            <p className="font-semibold text-[var(--aislix-primary)]">Who audits each store</p>
            <p className="mt-0.5 text-sm text-[var(--aislix-secondary)]">
              Each store gets its own audit for the person shown.
            </p>
            <ul className="mt-3 divide-y divide-[var(--aislix-border)]">
              {stores.map((store) => (
                <li
                  key={store.id}
                  className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-[var(--aislix-primary)]">
                    <Store className="size-4 shrink-0 text-[var(--aislix-secondary)]" />
                    <span className="truncate">{store.name}</span>
                  </span>
                  <Select
                    value={storeAssignees[store.id] ?? ""}
                    onValueChange={(userId) => onStoreAssigneeChange?.(store.id, userId)}
                  >
                    <SelectTrigger
                      className="w-full rounded-xl sm:w-60"
                      aria-label={`Person auditing ${store.name}`}
                    >
                      <SelectValue placeholder="Choose a person" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedMembers.map((m) => (
                        <SelectItem key={m.user_id} value={m.user_id}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </li>
              ))}
            </ul>
            {idle.length ? (
              <p className="mt-2 text-xs text-[var(--aislix-secondary)]">
                No store for {idle.map((m) => m.name).join(", ")} — they will not get an audit.
              </p>
            ) : null}
          </div>
        ) : null}

        <Label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--aislix-local-border)] bg-[var(--aislix-local-bg)] p-4">
          <Checkbox
            checked={assignToSelf}
            onCheckedChange={(v) => onAssignToSelfChange(v === true)}
          />
          <span className="flex items-center gap-2 text-sm font-semibold text-[var(--aislix-primary)]">
            <UserCheck className="size-4" />
            {stores.length > 1
              ? `Assign all ${stores.length} stores to myself and start now`
              : "Assign to myself and start now"}
          </span>
        </Label>
      </div>
    </NewAuditStepSection>
  );
}
