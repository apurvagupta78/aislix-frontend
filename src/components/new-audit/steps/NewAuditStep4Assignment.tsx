import { useState } from "react";
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
import {
  canCoverStore,
  coveredStoreCount,
  isScopedMember,
  type StoreCoverage,
  type TeamScope,
} from "@/lib/assignment-engine";
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
  /** Stores each person covers; people only show for stores they cover. */
  coverage?: StoreCoverage;
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
  coverage,
  complete,
  error,
}: Props) {
  const [showEveryone, setShowEveryone] = useState(false);
  const storeIds = stores.map((s) => s.id);
  const filtering = Boolean(coverage) && storeIds.length > 0 && !showEveryone;
  const coversAny = (m: AssignableMember) => coveredStoreCount(coverage, m.user_id, storeIds) > 0;
  const visibleMembers = filtering
    ? members.filter((m) => coversAny(m) || teamScope.assigneeIds.includes(m.user_id))
    : members;
  const hiddenCount = members.length - visibleMembers.length;

  const memberNote = (m: AssignableMember): string | null => {
    if (!coverage || !storeIds.length) return null;
    if (!isScopedMember(coverage, m.user_id)) return "No store scope";
    const n = coveredStoreCount(coverage, m.user_id, storeIds);
    if (n === 0) return "Covers none of these stores";
    return storeIds.length === 1 ? "Covers this store" : `Covers ${n} of ${storeIds.length} stores`;
  };

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
          ? "Choose team members or assign the audits to yourself. Each store goes to someone who covers it — change the person for any store below."
          : "Choose team members or assign the audit to yourself."
      }
      complete={complete}
      error={error}
    >
      <div className="space-y-4">
        <TeamAssignmentPanel
          members={visibleMembers}
          teamScope={teamScope}
          onTeamChange={onTeamChange}
          singleAssignee={assignToSelf}
          memberNote={memberNote}
          footer={
            coverage && storeIds.length && (hiddenCount > 0 || showEveryone) ? (
              <button
                type="button"
                className="text-xs font-medium text-[var(--aislix-secondary)] hover:underline"
                onClick={() => setShowEveryone((v) => !v)}
              >
                {showEveryone
                  ? "Only show people who cover these stores"
                  : `Show everyone (${hiddenCount} more not tagged to these stores)`}
              </button>
            ) : null
          }
        />

        {showPerStore ? (
          <div className="rounded-xl border border-[var(--aislix-border)] p-4">
            <p className="font-semibold text-[var(--aislix-primary)]">Who audits each store</p>
            <p className="mt-0.5 text-sm text-[var(--aislix-secondary)]">
              Each store gets its own audit for the person shown.
            </p>
            <ul className="mt-3 divide-y divide-[var(--aislix-border)]">
              {stores.map((store) => {
                const coverers = selectedMembers.filter((m) => canCoverStore(coverage, m.user_id, store.id));
                const current = selectedMembers.find((m) => m.user_id === storeAssignees[store.id]);
                const options =
                  current && !coverers.includes(current) ? [...coverers, current] : coverers;
                return (
                  <li
                    key={store.id}
                    className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="min-w-0 text-sm font-medium text-[var(--aislix-primary)]">
                      <span className="flex items-center gap-2">
                        <Store className="size-4 shrink-0 text-[var(--aislix-secondary)]" />
                        <span className="truncate">{store.name}</span>
                      </span>
                      {!coverers.length ? (
                        <span className="mt-0.5 block pl-6 text-xs font-normal text-[var(--aislix-secondary)]">
                          Nobody selected covers this store — tag someone to it in Team, or pick anyone below.
                        </span>
                      ) : null}
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
                        {(options.length ? options : selectedMembers).map((m) => (
                          <SelectItem key={m.user_id} value={m.user_id}>
                            {m.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </li>
                );
              })}
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
