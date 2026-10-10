import type { ReactNode } from "react";
import { FileText, Lock, Store } from "lucide-react";

import { NewAuditStepSection } from "@/components/new-audit/NewAuditStepSection";
import { STEP_3_TITLE } from "@/components/new-audit/steps/NewAuditStep2StartMethod";

function SetupRow({
  icon: Icon,
  label,
  value,
  action,
}: {
  icon: typeof FileText;
  label: string;
  value: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[#D9E2E8] bg-white px-4 py-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#F4F7F9]">
        <Icon className="size-4 text-[#04203F]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-[#667085]">{label}</p>
        <p className="truncate text-sm font-semibold text-[#04203F]">{value}</p>
      </div>
      {action}
    </div>
  );
}

function LockedNote({ children }: { children: ReactNode }) {
  return (
    <p className="mt-2 flex items-center gap-1.5 text-xs text-[#667085]">
      <Lock className="size-3.5" />
      {children}
    </p>
  );
}

/** Step 3 while editing: the audit keeps its saved setup unless the user changes it. */
export function NewAuditCurrentSetup({
  setupLabel,
  locked,
  onChangeSetup,
  evidenceSettings,
  complete,
  error,
}: {
  setupLabel: string;
  /** The audit has started — its setup can no longer change. */
  locked: boolean;
  onChangeSetup: () => void;
  evidenceSettings?: ReactNode;
  complete?: boolean;
  error?: string | null;
}) {
  return (
    <NewAuditStepSection
      id="step-3-start"
      stepNumber={3}
      title={STEP_3_TITLE}
      description="This audit keeps its current setup unless you change it."
      complete={complete}
      error={error}
    >
      <SetupRow
        icon={FileText}
        label="Current setup"
        value={setupLabel}
        action={
          locked ? null : (
            <button
              type="button"
              onClick={onChangeSetup}
              className="shrink-0 rounded-md border border-[#D9E2E8] px-2.5 py-1 text-xs font-semibold text-[#04203F] transition-colors hover:bg-[#F4F7F9]"
            >
              Change setup
            </button>
          )
        }
      />
      {locked ? <LockedNote>This audit has started, so its setup can't change.</LockedNote> : null}
      {evidenceSettings ? <div className="mt-6 border-t border-[#D9E2E8] pt-6">{evidenceSettings}</div> : null}
    </NewAuditStepSection>
  );
}

/** Step 4 while editing a started audit: the store is fixed. */
export function NewAuditLockedStore({ storeName }: { storeName: string }) {
  return (
    <NewAuditStepSection
      id="step-4-where"
      stepNumber={4}
      title="Where?"
      description="The store this audit runs in."
      complete
    >
      <SetupRow icon={Store} label="Store" value={storeName} />
      <LockedNote>This audit has started, so its store can't change.</LockedNote>
    </NewAuditStepSection>
  );
}
