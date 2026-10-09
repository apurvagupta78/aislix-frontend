import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ClipboardCheck, Loader2, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toUserMessage } from "@/lib/api/errors";
import { hideModelNames } from "@/lib/ai-display-text";
import { formatMinutes, slaTypeLabel } from "@/lib/sla-insights";
import {
  fetchScanFixes,
  requestReauditForFixes,
  reviewScanFixes,
  type ProposedFix,
} from "@/lib/proposed-fixes";

const PRIORITY_DOT: Record<string, string> = {
  critical: "#ECBDCC",
  high: "#ECBDCC",
  medium: "#9B86D9",
  low: "#7DB7D6",
};

const PRIORITY_LABEL: Record<string, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

/**
 * Lets the auditor or a manager confirm the fixes an audit found before they become
 * corrective actions with an owner and an SLA.
 */
export function ProposedFixesPanel({ scanId, className }: { scanId: string; className?: string }) {
  const queryClient = useQueryClient();
  const [reauditOpen, setReauditOpen] = useState(false);
  const [reauditReason, setReauditReason] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["scan-fixes", scanId],
    queryFn: () => fetchScanFixes(scanId),
    staleTime: 15_000,
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["scan-fixes", scanId] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard-sla-actions-v1"] });
    void queryClient.invalidateQueries({ queryKey: ["corrective-actions"] });
    void queryClient.invalidateQueries({ queryKey: ["lifecycle-actions"] });
  };

  const review = useMutation({
    mutationFn: (input: { approve: string[]; reject: string[]; key: string }) =>
      reviewScanFixes({ scanId, approveIds: input.approve, rejectIds: input.reject }),
    onMutate: (input) => setBusyId(input.key),
    onSuccess: (res) => {
      if (res.approved > 0 && res.rejected === 0)
        toast.success(
          res.approved === 1
            ? "Fix approved. The owner has been told and the SLA has started."
            : `${res.approved} fixes approved. Owners have been told and SLAs have started.`,
        );
      else if (res.rejected > 0 && res.approved === 0)
        toast.success(res.rejected === 1 ? "Fix rejected." : `${res.rejected} fixes rejected.`);
      else toast.success("Review saved.");
      refresh();
    },
    onError: (e) => toast.error(toUserMessage(e)),
    onSettled: () => setBusyId(null),
  });

  const reaudit = useMutation({
    mutationFn: () => requestReauditForFixes({ scanId, reason: reauditReason }),
    onSuccess: (res) => {
      toast.success(
        res.assignmentCreated
          ? "Re-audit assigned to the auditor. The proposed fixes were discarded."
          : "Proposed fixes discarded. This audit has no store, so run a new scan to re-audit.",
      );
      setReauditOpen(false);
      setReauditReason("");
      refresh();
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });

  const fixes = query.data?.fixes ?? [];
  if (query.isPending || query.isError || fixes.length === 0) return null;

  const pending = fixes.filter((f) => f.review === "proposed");
  const approved = fixes.filter((f) => f.review === "approved").length;
  const rejected = fixes.filter((f) => f.review === "dismissed").length;
  const canReview = query.data?.canReview === true;
  const busy = review.isPending || reaudit.isPending;

  return (
    <section
      aria-label="Fixes to review"
      className={`rounded-xl border border-[#D9E2E8] bg-white ${className ?? ""}`}
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[#D9E2E8] px-4 py-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#F4F7F9] text-[#04203F]">
            <ClipboardCheck className="size-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-[#04203F]">Fixes to review</h2>
            <p className="mt-0.5 text-xs text-[#667085]">
              {pending.length > 0
                ? "This audit found these problems. Approve the ones that are real. Only approved fixes go to an owner with a deadline."
                : "Every fix from this audit has been reviewed."}
            </p>
            <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#667085]">
              <CountDot color="#9B86D9" label={`${pending.length} waiting`} />
              <CountDot color="#79E2A8" label={`${approved} approved`} />
              <CountDot color="#EEF1F4" label={`${rejected} rejected`} />
            </p>
          </div>
        </div>
        {canReview && pending.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              className="rounded-lg"
              disabled={busy}
              onClick={() => setReauditOpen((v) => !v)}
            >
              <RotateCcw className="size-4" /> Request re-audit
            </Button>
            <Button
              size="sm"
              className="rounded-lg bg-[#04203F] text-white hover:bg-[#04203F]/90"
              disabled={busy}
              onClick={() =>
                review.mutate({ approve: pending.map((f) => f.id), reject: [], key: "all" })
              }
            >
              {busyId === "all" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              Approve all ({pending.length})
            </Button>
          </div>
        ) : null}
      </header>

      {reauditOpen ? (
        <div className="space-y-2 border-b border-[#D9E2E8] px-4 py-3">
          <p className="text-xs text-[#667085]">
            All {pending.length} waiting fixes will be discarded and the person who ran this audit
            gets a new audit of the same store and shelf.
          </p>
          <Textarea
            rows={2}
            placeholder="What was wrong? (optional)"
            value={reauditReason}
            onChange={(e) => setReauditReason(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setReauditOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="rounded-lg bg-[#04203F] text-white hover:bg-[#04203F]/90"
              disabled={busy}
              onClick={() => reaudit.mutate()}
            >
              {reaudit.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Discard fixes and assign re-audit
            </Button>
          </div>
        </div>
      ) : null}

      {!canReview && pending.length > 0 ? (
        <p className="border-b border-[#D9E2E8] px-4 py-2 text-xs text-[#667085]">
          Waiting for the auditor or a manager to review these fixes.
        </p>
      ) : null}

      <ul className="divide-y divide-[#D9E2E8]">
        {fixes.map((fix) => (
          <FixRow
            key={fix.id}
            fix={fix}
            canReview={canReview}
            busy={busy}
            spinning={busyId === fix.id}
            onApprove={() => review.mutate({ approve: [fix.id], reject: [], key: fix.id })}
            onReject={() => review.mutate({ approve: [], reject: [fix.id], key: fix.id })}
          />
        ))}
      </ul>
    </section>
  );
}

function CountDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function FixRow({
  fix,
  canReview,
  busy,
  spinning,
  onApprove,
  onReject,
}: {
  fix: ProposedFix;
  canReview: boolean;
  busy: boolean;
  spinning: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const detail = fix.detail ? hideModelNames(fix.detail) : null;
  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-sm font-medium text-[#04203F]">
          <span
            className="size-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: PRIORITY_DOT[fix.priority] ?? "#EEF1F4" }}
          />
          <span className="truncate">{hideModelNames(fix.title)}</span>
        </p>
        {detail ? <p className="mt-0.5 line-clamp-2 text-xs text-[#667085]">{detail}</p> : null}
        <p className="mt-1 text-xs text-[#667085]">
          {PRIORITY_LABEL[fix.priority] ?? "Medium"} priority · {slaTypeLabel(fix.slaType, true)}
          {fix.slaMinutes != null ? ` · ${formatMinutes(fix.slaMinutes)} to fix once approved` : ""}
          {fix.code ? ` · ${fix.code}` : ""}
        </p>
        {fix.review === "dismissed" && fix.reviewNote ? (
          <p className="mt-1 text-xs text-[#667085]">Note: {fix.reviewNote}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {fix.review === "approved" ? (
          <Link
            to="/corrective-actions/$actionId"
            params={{ actionId: fix.id }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#D9E2E8] px-2.5 py-1 text-xs font-medium text-[#04203F] hover:bg-[#F4F7F9]"
          >
            <span className="size-1.5 rounded-full bg-[#79E2A8]" /> Approved · open action
          </Link>
        ) : fix.review === "dismissed" ? (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#EEF1F4] px-2.5 py-1 text-xs text-[#667085]">
            Rejected
          </span>
        ) : canReview ? (
          <>
            <Button
              size="sm"
              variant="outline"
              className="h-8 rounded-lg"
              disabled={busy}
              onClick={onReject}
            >
              <X className="size-4" /> Reject
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 rounded-lg border-[#04203F] text-[#04203F]"
              disabled={busy}
              onClick={onApprove}
            >
              {spinning ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Approve
            </Button>
          </>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#F4F7F9] px-2.5 py-1 text-xs text-[#667085]">
            <span className="size-1.5 rounded-full bg-[#9B86D9]" /> Waiting for review
          </span>
        )}
      </div>
    </li>
  );
}
