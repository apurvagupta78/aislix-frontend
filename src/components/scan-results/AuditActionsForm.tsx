import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ListChecks, Loader2, Plus, Send, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toUserMessage } from "@/lib/api/errors";
import { fetchAssignableMembers } from "@/lib/assignments";
import {
  SLA_CHOICES,
  draftProblem,
  emptyDraft,
  fetchAuditActionReview,
  itemsFromDrafts,
  submitAuditActions,
  type IssueDraft,
  type SlaChoice,
  type SlaUnit,
} from "@/lib/audit-action-form";
import { ISSUE_CATEGORIES, type IssueCategory } from "@/lib/corrective-action-catalog";
import { slaRemainingLabel } from "@/lib/corrective-action-lifecycle";
import { formatMinutes } from "@/lib/sla-insights";

export type AuditActionProduct = { key: string; name: string; sku?: string | null };

const INITIAL_ROWS = 8;
const NO_ISSUE = "none";
const ME = "me";

const when = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : "";

/**
 * End-of-audit step: pick a corrective action and SLA per product, assign them to one person
 * and submit — or submit for closure when nothing needs fixing.
 */
export function AuditActionsForm({
  scanId,
  products,
  auditSubmitted = false,
  submitAudit,
  className,
}: {
  scanId: string;
  products: AuditActionProduct[];
  /** The audit itself was already submitted to the assignor (AI audits). */
  auditSubmitted?: boolean;
  /** Notifies the assignor after the actions are saved (AI audits). */
  submitAudit?: (notes: string | null) => Promise<unknown>;
  className?: string;
}) {
  const queryClient = useQueryClient();
  const reviewQuery = useQuery({
    queryKey: ["audit-action-review", scanId],
    queryFn: () => fetchAuditActionReview(scanId),
    staleTime: 15_000,
  });
  const canSubmit = reviewQuery.data?.canSubmit === true && !reviewQuery.data?.status;
  const membersQuery = useQuery({
    queryKey: ["assignable-members"],
    queryFn: () => fetchAssignableMembers().catch(() => []),
    enabled: canSubmit,
    staleTime: 5 * 60_000,
  });
  const meQuery = useQuery({
    queryKey: ["auth-user-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
    staleTime: Infinity,
  });

  const [drafts, setDrafts] = useState<IssueDraft[]>(() =>
    products.map((p) => emptyDraft(p.key, p.name, p.sku ?? null)),
  );
  const productKeys = products.map((p) => p.key).join("|");
  useEffect(() => {
    setDrafts((list) => {
      const known = new Set(list.map((d) => d.key));
      const added = products.filter((p) => !known.has(p.key)).map((p) => emptyDraft(p.key, p.name, p.sku ?? null));
      return added.length ? [...list.filter((d) => !d.key.startsWith("general-")), ...added, ...list.filter((d) => d.key.startsWith("general-"))] : list;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productKeys]);
  const [generalCount, setGeneralCount] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [assignee, setAssignee] = useState(ME);
  const [notes, setNotes] = useState("");
  const [triedSubmit, setTriedSubmit] = useState(false);

  const update = (key: string, patch: Partial<IssueDraft>) =>
    setDrafts((list) => list.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  const addGeneral = () => {
    const key = `general-${generalCount + 1}`;
    setGeneralCount((n) => n + 1);
    setDrafts((list) => [...list, { ...emptyDraft(key, null, null), category: "other" }]);
  };

  const withIssue = drafts.filter((d) => d.category);
  const problems = withIssue.filter((d) => draftProblem(d));
  const productDrafts = drafts.filter((d) => !d.key.startsWith("general-"));
  const generalDrafts = drafts.filter((d) => d.key.startsWith("general-"));
  const visibleProducts = showAll
    ? productDrafts
    : productDrafts.filter((d, i) => i < INITIAL_ROWS || d.category);
  const members = (membersQuery.data ?? []).filter((m) => m.user_id && m.status === "active");

  const submit = useMutation({
    mutationFn: async () => {
      const res = await submitAuditActions({
        scanId,
        items: itemsFromDrafts(drafts),
        assigneeId: assignee === ME ? null : assignee,
        note: notes,
      });
      if (submitAudit && !auditSubmitted) await submitAudit(notes.trim() || null);
      return res;
    },
    onSuccess: (res) => {
      const who = assignee === ME ? "you" : (members.find((m) => m.user_id === assignee)?.name ?? "the owner");
      toast.success(
        res.created === 0
          ? "Audit submitted for closure. No corrective actions needed."
          : `${res.created} corrective action${res.created === 1 ? "" : "s"} assigned to ${who}. The SLA clock has started.`,
      );
    },
    onError: (e) => toast.error(toUserMessage(e)),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["audit-action-review", scanId] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-sla-actions-v1"] });
      void queryClient.invalidateQueries({ queryKey: ["scan-assignment-meta", scanId] });
      void queryClient.invalidateQueries({ queryKey: ["scan-result", scanId] });
      void queryClient.invalidateQueries({ queryKey: ["org-assignments"] });
      void queryClient.invalidateQueries({ queryKey: ["my-assignments"] });
    },
  });

  if (reviewQuery.isPending || reviewQuery.isError) return null;
  const review = reviewQuery.data;

  const shell = (body: React.ReactNode, subtitle: string) => (
    <section
      aria-label="Corrective actions and SLA"
      className={`rounded-xl border border-[#D9E2E8] bg-white ${className ?? ""}`}
    >
      <header className="flex items-start gap-3 border-b border-[#D9E2E8] px-4 py-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#F4F7F9] text-[#04203F]">
          <ListChecks className="size-4" />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-[#04203F]">Corrective actions & SLA</h2>
          <p className="mt-0.5 text-xs text-[#667085]">{subtitle}</p>
        </div>
      </header>
      {body}
    </section>
  );

  if (review.status) {
    return shell(
      <div className="space-y-3 px-4 py-3">
        <p className="flex items-center gap-2 text-sm text-[#04203F]">
          <CheckCircle2 className="size-4 text-[#79E2A8]" />
          {review.status === "closed_no_issue"
            ? "Submitted for closure: no corrective actions needed."
            : `${review.actions.length} corrective action${review.actions.length === 1 ? "" : "s"} assigned.`}
        </p>
        {review.note ? <p className="text-xs text-[#667085]">Notes: {review.note}</p> : null}
        {review.actions.length ? (
          <ul className="divide-y divide-[#EEF1F4] rounded-lg border border-[#D9E2E8]">
            {review.actions.map((a) => (
              <li key={a.id}>
                <Link
                  to="/corrective-actions/$actionId"
                  params={{ actionId: a.id }}
                  className="flex flex-col gap-1 px-3 py-2.5 transition-colors hover:bg-[#F4F7F9] sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-[#04203F]">{a.title}</span>
                    <span className="block text-xs text-[#667085]">
                      {a.code ?? "Action"} · {a.assignedTo ?? "Unassigned"}
                      {a.slaMinutes != null ? ` · SLA ${formatMinutes(a.slaMinutes)}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-[#04203F] sm:text-right">
                    {a.dueAt ? `Due ${when(a.dueAt)}` : "No due date"}
                    <span className="block text-[#667085]">{slaRemainingLabel(a.dueAt, a.status)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>,
      `Submitted${review.reviewedBy ? ` by ${review.reviewedBy}` : ""}${review.reviewedAt ? ` on ${when(review.reviewedAt)}` : ""}.`,
    );
  }

  if (!review.canSubmit) {
    return shell(
      <p className="px-4 py-3 text-sm text-[#667085]">
        Waiting for the auditor or a manager to choose corrective actions for this audit.
      </p>,
      "Each product gets a corrective action and a deadline when needed.",
    );
  }

  const showErrors = triedSubmit && problems.length > 0;
  return shell(
    <div className="space-y-4 px-4 py-3">
      <div className="hidden grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 text-xs font-medium text-[#667085] md:grid">
        <span>Product</span>
        <span>Corrective action</span>
        <span>SLA (fix within)</span>
      </div>
      <ul className="divide-y divide-[#EEF1F4]">
        {[...visibleProducts, ...generalDrafts].map((d) => (
          <IssueRow
            key={d.key}
            draft={d}
            general={d.key.startsWith("general-")}
            error={showErrors ? draftProblem(d) : null}
            onChange={(patch) => update(d.key, patch)}
            onRemove={() => setDrafts((list) => list.filter((x) => x.key !== d.key))}
          />
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        {productDrafts.length > visibleProducts.length ? (
          <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={() => setShowAll(true)}>
            Show all {productDrafts.length} products
          </Button>
        ) : null}
        <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={addGeneral}>
          <Plus className="size-4" /> Add general issue
        </Button>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`audit-notes-${scanId}`} className="text-xs text-[#667085]">
          Notes (optional)
        </Label>
        <Textarea
          id={`audit-notes-${scanId}`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Anything the team should know about this shelf…"
          className="min-h-[72px] rounded-lg"
          maxLength={2000}
        />
      </div>

      <div className="flex flex-col gap-3 border-t border-[#D9E2E8] pt-3 sm:flex-row sm:items-end sm:justify-between">
        {withIssue.length ? (
          <div className="w-full space-y-1 sm:max-w-xs">
            <Label className="text-xs text-[#667085]">Assign to</Label>
            <Select value={assignee} onValueChange={setAssignee}>
              <SelectTrigger className="h-9 rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ME}>Me</SelectItem>
                {members
                  .filter((m) => m.user_id !== meQuery.data)
                  .map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {m.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <p className="text-xs text-[#667085]">
            No issues picked. Submitting closes this audit with no corrective actions.
          </p>
        )}
        <Button
          type="button"
          className="rounded-lg bg-[#04203F] text-white hover:bg-[#04203F]/90"
          disabled={submit.isPending}
          onClick={() => {
            setTriedSubmit(true);
            if (problems.length) {
              toast.error("Finish the highlighted issues before submitting.");
              return;
            }
            submit.mutate();
          }}
        >
          {submit.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          {withIssue.length
            ? `Submit and assign ${withIssue.length} action${withIssue.length === 1 ? "" : "s"}`
            : "Submit for closure"}
        </Button>
      </div>
    </div>,
    "Pick what needs fixing on each product and by when. Leave “No issue” where the shelf is fine.",
  );
}

function IssueRow({
  draft,
  general,
  error,
  onChange,
  onRemove,
}: {
  draft: IssueDraft;
  general: boolean;
  error: string | null;
  onChange: (patch: Partial<IssueDraft>) => void;
  onRemove: () => void;
}) {
  const active = Boolean(draft.category);
  return (
    <li className="grid gap-2 py-3 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)] md:gap-3">
      <div className="min-w-0">
        {general ? (
          <div className="flex items-center gap-2">
            <Input
              value={draft.product ?? ""}
              onChange={(e) => onChange({ product: e.target.value })}
              placeholder="Product (optional)"
              className="h-9 rounded-lg"
              aria-label="Product for this issue"
            />
            <Button type="button" variant="ghost" size="icon" className="size-9 shrink-0" onClick={onRemove} aria-label="Remove issue">
              <X className="size-4" />
            </Button>
          </div>
        ) : (
          <>
            <p className="flex items-center gap-2 text-sm font-medium text-[#04203F]">
              <span
                className="size-1.5 shrink-0 rounded-full"
                style={{ background: active ? "#9B86D9" : "#EEF1F4" }}
              />
              <span className="truncate">{draft.product}</span>
            </p>
            {draft.sku ? <p className="pl-3.5 text-xs text-[#667085]">{draft.sku}</p> : null}
          </>
        )}
      </div>
      <div className="space-y-2">
        <Select
          value={draft.category ?? NO_ISSUE}
          onValueChange={(v) => onChange({ category: v === NO_ISSUE ? null : (v as IssueCategory) })}
        >
          <SelectTrigger className="h-9 rounded-lg" aria-label="Corrective action">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {general ? null : <SelectItem value={NO_ISSUE}>No issue</SelectItem>}
            {ISSUE_CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {draft.category === "other" ? (
          <Input
            value={draft.detail}
            onChange={(e) => onChange({ detail: e.target.value })}
            placeholder="Describe the issue"
            maxLength={500}
            className="h-9 rounded-lg"
            aria-label="Describe the issue"
          />
        ) : null}
      </div>
      <div className="space-y-2">
        <Select value={draft.sla} onValueChange={(v) => onChange({ sla: v as SlaChoice })} disabled={!active}>
          <SelectTrigger className="h-9 rounded-lg" aria-label="SLA">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SLA_CHOICES.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {active && draft.sla === "other" ? (
          <div className="flex gap-2">
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              value={draft.otherAmount}
              onChange={(e) => onChange({ otherAmount: e.target.value })}
              placeholder="e.g. 6"
              className="h-9 rounded-lg"
              aria-label="Deadline amount"
            />
            <Select value={draft.otherUnit} onValueChange={(v) => onChange({ otherUnit: v as SlaUnit })}>
              <SelectTrigger className="h-9 w-28 rounded-lg" aria-label="Deadline unit">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hours">Hours</SelectItem>
                <SelectItem value="days">Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ) : null}
        {error ? <p className="text-xs font-medium text-[#04203F]">
          <span className="mr-1.5 inline-block size-1.5 rounded-full bg-[#ECBDCC] align-middle" />
          {error}
        </p> : null}
      </div>
    </li>
  );
}
