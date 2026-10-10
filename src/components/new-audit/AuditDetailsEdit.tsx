import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, FileText, Lock, Store, Tag } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/design-system";
import { NewAuditStepSection } from "@/components/new-audit/NewAuditStepSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchAssignableMembers } from "@/lib/assignments";
import {
  fetchEditableAudit,
  saveScanDetails,
  saveStartedAssignmentEdit,
  type AuditEditTarget,
  type EditableAudit,
} from "@/lib/audit-edit";
import { utcToZonedDateTime, zonedDateTimeToUtc } from "@/lib/assignment-engine/recurrence";
import { toUserMessage } from "@/lib/api/errors";
import { requireUserId } from "@/lib/db/context";
import { formatScanDate } from "@/lib/scan-history";

const TIMEZONE = "Asia/Kolkata";
const NO_REVIEWER = "none";

function ReadOnlyRow({ icon: Icon, label, value }: { icon: typeof FileText; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[#D9E2E8] bg-white px-4 py-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#F4F7F9]">
        <Icon className="size-4 text-[#04203F]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-[#667085]">{label}</p>
        <p className="truncate text-sm font-semibold text-[#04203F]">{value}</p>
      </div>
    </div>
  );
}

function LockedNote({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 text-xs text-[#667085]">
      <Lock className="size-3.5 shrink-0" />
      {children}
    </p>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-[#04203F]">
        {label}
      </label>
      {children}
    </div>
  );
}

function modeLabel(audit: EditableAudit): string {
  return audit.auditMode === "ai" ? "AI audit" : "Digital audit";
}

/**
 * Edit page for audits that have started or finished, and for audits run without
 * an assignment. Their name, store, setup and evidence rules are fixed.
 */
export function AuditDetailsEdit({ target }: { target: AuditEditTarget }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const editQuery = useQuery({
    queryKey: ["audit-edit", target.kind, target.id],
    queryFn: () => fetchEditableAudit(target),
    retry: false,
  });
  const membersQuery = useQuery({
    queryKey: ["assignable-members", "new-audit"],
    queryFn: fetchAssignableMembers,
    enabled: target.kind === "assignment",
  });
  const meQuery = useQuery({ queryKey: ["current-user-id"], queryFn: requireUserId, staleTime: Infinity });
  const audit = editQuery.data ?? null;
  const userId = meQuery.data ?? "";

  const [prefilled, setPrefilled] = useState(false);
  const [assigneeId, setAssigneeId] = useState("");
  const [reviewerId, setReviewerId] = useState(NO_REVIEWER);
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [instructions, setInstructions] = useState("");
  const [shelfLabel, setShelfLabel] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!audit || prefilled) return;
    setPrefilled(true);
    if (audit.scan) {
      setShelfLabel(audit.scan.shelfLabel);
      setNotes(audit.scan.notes);
      return;
    }
    setAssigneeId(audit.assigneeIds[0] ?? "");
    setReviewerId(audit.reviewerId ?? NO_REVIEWER);
    setInstructions(audit.instructions);
    if (audit.dueAt) {
      const local = utcToZonedDateTime(audit.dueAt, TIMEZONE);
      setDueDate(local.date);
      setDueTime(local.time);
    }
  }, [audit, prefilled]);

  const members = [
    ...(userId ? [{ user_id: userId, name: "Me", role: "owner", status: "active" }] : []),
    ...(membersQuery.data ?? []).filter((m) => m.status === "active"),
  ];
  const nameOf = (id: string) => members.find((m) => m.user_id === id)?.name ?? "Team member";
  const reviewers = members.filter((m) => ["owner", "admin", "manager"].includes(m.role.toLowerCase()));

  const save = useMutation({
    mutationFn: async () => {
      if (!audit) throw new Error("This audit could not be loaded.");
      if (audit.scan) {
        await saveScanDetails({ scanId: audit.target.id, shelfLabel, notes });
        return;
      }
      if (dueTime && !dueDate) throw new Error("Choose a due date, or clear the due time.");
      const reviewer = reviewerId === NO_REVIEWER ? null : reviewerId;
      const doer = audit.finished ? (audit.assigneeIds[0] ?? null) : assigneeId;
      if (!audit.finished && !assigneeId) throw new Error("Choose who should do this audit.");
      if (reviewer && reviewer === doer) {
        throw new Error("The reviewer can't be the person doing the audit. Choose a different reviewer.");
      }
      await saveStartedAssignmentEdit({
        assignmentId: audit.target.id,
        auditName: audit.name,
        storeName: audit.storeName,
        previousAssigneeId: audit.assigneeIds[0] ?? null,
        assigneeId: audit.finished ? null : assigneeId,
        dueAt: dueDate ? zonedDateTimeToUtc(dueDate, dueTime || "23:59", TIMEZONE).toISOString() : null,
        instructions,
        reviewerId: reviewer,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["audit-history"] });
      void queryClient.invalidateQueries({ queryKey: ["audit-edit"] });
      toast.success("Audit updated.");
      void navigate({ to: "/history" });
    },
    onError: (error) => toast.error(toUserMessage(error) || "Could not save your changes. Please try again."),
  });

  const title = "Edit audit";
  if (editQuery.isLoading || editQuery.isError || (audit && !audit.canEdit)) {
    const message = editQuery.isLoading
      ? "Loading audit…"
      : editQuery.isError
        ? toUserMessage(editQuery.error) || "This audit could not be loaded."
        : "Only the person who created this audit, or an owner, admin or manager, can edit it.";
    return (
      <AppShell title="" hidePageHeader>
        <div className="play-canvas mx-auto max-w-4xl space-y-6 pb-36">
          <PageHeader title={title} />
          <div className="rounded-xl border border-[#D9E2E8] bg-white px-5 py-8 text-center">
            <p className="text-sm text-[#667085]">{message}</p>
            {editQuery.isLoading ? null : (
              <Button variant="outline" className="mt-4" onClick={() => void navigate({ to: "/history" })}>
                Back to audit history
              </Button>
            )}
          </div>
        </div>
      </AppShell>
    );
  }
  if (!audit) return null;

  const isScan = Boolean(audit.scan);
  const description = isScan
    ? "Rename this audit or add notes. Its photos and results stay exactly as they are."
    : audit.finished
      ? "This audit is finished. You can update its due date, instructions and reviewer; its results stay as they are."
      : "This audit has started. You can change who does it, the due date, instructions and reviewer.";

  return (
    <AppShell title="" hidePageHeader>
      <div className="play-canvas mx-auto max-w-4xl space-y-6 pb-36">
        <PageHeader title={title} description={description} />

        <NewAuditStepSection
          id="step-1-details"
          stepNumber={1}
          title="Audit details"
          description={isScan ? "How this audit is labelled in your history and reports." : "What this audit covers."}
          complete
        >
          <div className="space-y-3">
            {isScan ? (
              <>
                <Field label="Shelf or location" htmlFor="edit-shelf-label">
                  <Input
                    id="edit-shelf-label"
                    value={shelfLabel}
                    onChange={(e) => setShelfLabel(e.target.value)}
                    placeholder="e.g. Aisle 7 · Oral care"
                    maxLength={120}
                  />
                </Field>
                <Field label="Notes" htmlFor="edit-notes">
                  <Textarea
                    id="edit-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Anything your team should know about this audit…"
                    rows={3}
                    maxLength={2000}
                  />
                </Field>
              </>
            ) : (
              <ReadOnlyRow icon={Tag} label="Audit name" value={audit.name || "Untitled audit"} />
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <ReadOnlyRow icon={Store} label="Store" value={audit.storeName ?? "—"} />
              <ReadOnlyRow
                icon={FileText}
                label={isScan && audit.scan?.category ? "Type · category" : "Type · setup"}
                value={[modeLabel(audit), isScan ? audit.scan?.category : audit.setup?.label]
                  .filter(Boolean)
                  .join(" · ")}
              />
            </div>
            {isScan && audit.scan?.createdAt ? (
              <ReadOnlyRow icon={CalendarClock} label="Run on" value={formatScanDate(audit.scan.createdAt)} />
            ) : null}
            <LockedNote>
              {isScan
                ? "Store, type and results can't change once an audit has run."
                : "Name, store, setup and evidence rules are locked once an audit starts, so the report always matches what was audited."}
            </LockedNote>
          </div>
        </NewAuditStepSection>

        {isScan ? null : (
          <>
            <NewAuditStepSection
              id="step-5-who"
              stepNumber={2}
              title="Who?"
              description={audit.finished ? "Who did this audit and who reviews it." : "Who does this audit and who reviews it."}
              complete
            >
              <div className="grid gap-3 sm:grid-cols-2">
                {audit.finished ? (
                  <div className="space-y-1.5">
                    <ReadOnlyRow icon={Tag} label="Done by" value={assigneeId ? nameOf(assigneeId) : "—"} />
                  </div>
                ) : (
                  <Field label="Assigned to" htmlFor="edit-assignee">
                    <Select value={assigneeId} onValueChange={setAssigneeId}>
                      <SelectTrigger id="edit-assignee" className="h-10 rounded-lg">
                        <SelectValue placeholder="Choose a person" />
                      </SelectTrigger>
                      <SelectContent>
                        {members.map((m) => (
                          <SelectItem key={m.user_id} value={m.user_id}>
                            {m.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
                <Field label="Reviewer (optional)" htmlFor="edit-reviewer">
                  <Select value={reviewerId} onValueChange={setReviewerId}>
                    <SelectTrigger id="edit-reviewer" className="h-10 rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_REVIEWER}>No reviewer</SelectItem>
                      {reviewers.map((m) => (
                        <SelectItem key={m.user_id} value={m.user_id}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              {audit.finished ? (
                <div className="mt-3">
                  <LockedNote>Finished audits keep the person who did them.</LockedNote>
                </div>
              ) : null}
            </NewAuditStepSection>

            <NewAuditStepSection
              id="step-6-when"
              stepNumber={3}
              title="When?"
              description="When this audit is due."
              complete
            >
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Due date" htmlFor="edit-due-date">
                    <Input
                      id="edit-due-date"
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="h-10 rounded-lg"
                    />
                  </Field>
                  <Field label="Due time" htmlFor="edit-due-time">
                    <Input
                      id="edit-due-time"
                      type="time"
                      value={dueTime}
                      onChange={(e) => setDueTime(e.target.value)}
                      className="h-10 rounded-lg"
                    />
                  </Field>
                </div>
                <Field label="Instructions for the auditor" htmlFor="edit-instructions">
                  <Textarea
                    id="edit-instructions"
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    placeholder="Any special instructions for the team..."
                    rows={3}
                  />
                </Field>
              </div>
            </NewAuditStepSection>
          </>
        )}

        <div className="flex flex-col-reverse gap-2 border-t border-[#D9E2E8] pt-4 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => void navigate({ to: "/history" })} disabled={save.isPending}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
