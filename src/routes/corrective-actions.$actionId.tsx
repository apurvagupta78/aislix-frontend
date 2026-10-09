import { useEffect, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Bot, Camera, Check, CheckCircle2, Loader2, ScanLine, ShieldAlert, UserRound } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { BeforeAfterEvidence } from "@/components/audit-governance/BeforeAfterEvidence";
import { ActionAuditPhoto } from "@/components/corrective-actions/ActionAuditPhoto";
import { CA_PINK_BAR } from "@/components/corrective-actions/CaCharts";
import { PriorityPill, SourcePill, StagePill } from "@/components/corrective-actions/CaParts";
import { MpCard } from "@/components/design-system/MpCard";
import { GuidedSweepCamera } from "@/components/guided-capture/GuidedSweepCamera";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ErrorState, Skeleton } from "@/components/States";
import { hideModelNames } from "@/lib/ai-display-text";
import { ACCENT_TINT, AISLIX_PALETTE } from "@/lib/ai-audit/kpi-palette";
import { toUserMessage } from "@/lib/api/errors";
import { fetchAssignableMembers, isOrgManager } from "@/lib/assignments";
import {
  ROOT_CAUSE_OPTIONS,
  actionStage,
  actionTypeLabel,
  escalationLabel,
  evidenceLabel,
  isUnreviewedAction,
  requiresRootCause,
  verificationMethodLabel,
} from "@/lib/corrective-action-catalog";
import {
  approveAndClose,
  closeVerifiedAction,
  evaluateAiRecheck,
  fetchLifecycleAction,
  reassignAction,
  rejectResolution,
  runAiRecheck,
  saveActionPlan,
  saveDelayReason,
  slaRemainingLabel,
  startAction,
  startAiRecheck,
  submitResolution,
  type LifecycleAction,
  type RecheckResult,
} from "@/lib/corrective-action-lifecycle";
import { fetchFinding } from "@/lib/findings";
import type { SweepCaptureMeta } from "@/lib/guided-capture";
import { fetchResolutionEvidence, resolutionPhotoUrl, uploadResolutionPhoto } from "@/lib/reaudit";
import {
  actualMinutes,
  formatMinutes,
  slaOutcome,
  slaTypeLabel,
  slaTypeOf,
  targetMinutes,
} from "@/lib/sla-insights";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/corrective-actions/$actionId")({
  head: () => ({ meta: [{ title: "Corrective action — Aislix" }] }),
  component: ActionDetailPage,
});

const LOOP = ["Detect", "Assign", "Fix", "Evidence", "Verify", "Close"] as const;

function loopIndex(action: LifecycleAction): number {
  const stage = actionStage(action.status);
  if (stage === "closed") return 6;
  if (stage === "verified") return 5;
  if (stage === "submitted") return 4;
  if (stage === "in_progress") return 2;
  return action.assigned_to ? 2 : 1;
}

function LifecycleStepper({ action }: { action: LifecycleAction }) {
  const current = loopIndex(action);
  return (
    <ol className="flex flex-wrap items-center gap-y-3" aria-label="Action progress">
      {LOOP.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex items-center">
            <span className="flex items-center gap-2">
              <span
                className="flex size-7 items-center justify-center rounded-full border text-xs font-semibold text-navy"
                style={{
                  background: done ? AISLIX_PALETTE.green : active ? ACCENT_TINT.purple : AISLIX_PALETTE.card,
                  borderColor: done ? AISLIX_PALETTE.green : active ? AISLIX_PALETTE.purple : AISLIX_PALETTE.border,
                }}
              >
                {done ? <Check className="size-3.5" /> : i + 1}
              </span>
              <span className={cn("text-xs font-semibold", done || active ? "text-navy" : "text-mp-muted")}>{label}</span>
            </span>
            {i < LOOP.length - 1 ? (
              <span
                className="mx-2 h-px w-6 sm:w-10"
                style={{ background: done ? AISLIX_PALETTE.green : AISLIX_PALETTE.border }}
                aria-hidden
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function Section({
  title,
  description,
  accent,
  children,
  aside,
}: {
  title: string;
  description?: string;
  accent: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <MpCard className="relative overflow-hidden p-5">
      <span className="absolute inset-x-0 top-0 h-1" style={{ background: accent }} aria-hidden />
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-[15px] font-semibold text-navy">{title}</h2>
          {description ? <p className="mt-0.5 text-[13px] text-mp-muted">{description}</p> : null}
        </div>
        {aside}
      </div>
      <div className="mt-4">{children}</div>
    </MpCard>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-mp-muted">{label}</dt>
      <dd className="mt-1 text-sm text-navy">{value}</dd>
    </div>
  );
}

const RECHECK_MESSAGE: Record<RecheckResult["status"], string> = {
  passed: "AI re-check passed — the issue is no longer on the shelf.",
  failed: "AI re-check still found this issue. Fix it and upload a new photo.",
  pending: "AI re-check is still running.",
  needs_review: "The new photo could not be compared to the plan. A manager will review it.",
  scan_failed: "The new photo could not be analysed. Try a clearer photo.",
  no_scan: "No AI re-check has been started yet.",
  not_found: "Action not found.",
  forbidden: "You cannot verify this action.",
};

function ActionDetailPage() {
  const { actionId } = Route.useParams();
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState("");
  const [qty, setQty] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [recheckFiles, setRecheckFiles] = useState<File[]>([]);
  const [recheckMeta, setRecheckMeta] = useState<SweepCaptureMeta | null>(null);
  const [sweepOpen, setSweepOpen] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rootCause, setRootCause] = useState("");
  const [rootCauseOther, setRootCauseOther] = useState("");
  const [preventive, setPreventive] = useState("");
  const [recheck, setRecheck] = useState<RecheckResult | null>(null);
  const [delayReason, setDelayReason] = useState("");
  const [delayOther, setDelayOther] = useState("");

  const actionQuery = useQuery({
    queryKey: ["lifecycle-action", actionId],
    queryFn: async () =>
      await Promise.race([
        fetchLifecycleAction(actionId),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Timed out loading this action.")), 20_000),
        ),
      ]),
    retry: 1,
  });
  const action = actionQuery.data;
  const findingQuery = useQuery({
    queryKey: ["finding", action?.finding_id],
    queryFn: () => (action?.finding_id ? fetchFinding(action.finding_id) : Promise.resolve(null)),
    enabled: Boolean(action?.finding_id),
  });
  const evidenceQuery = useQuery({
    queryKey: ["resolution-evidence", actionId],
    queryFn: () => fetchResolutionEvidence(actionId),
  });
  const managerQuery = useQuery({ queryKey: ["is-org-manager"], queryFn: () => isOrgManager() });
  const membersQuery = useQuery({
    queryKey: ["assignable-members"],
    queryFn: fetchAssignableMembers,
    enabled: Boolean(managerQuery.data),
  });

  useEffect(() => {
    if (!action) return;
    const saved = action.root_cause ?? "";
    const known = (ROOT_CAUSE_OPTIONS as readonly string[]).includes(saved);
    setRootCause(saved ? (known ? saved : "Other") : "");
    setRootCauseOther(saved && !known ? saved : "");
    setPreventive(action.preventive_action ?? "");
  }, [action?.id, action?.root_cause, action?.preventive_action]); // eslint-disable-line react-hooks/exhaustive-deps

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["lifecycle-action", actionId] });
    void queryClient.invalidateQueries({ queryKey: ["lifecycle-actions"] });
    void queryClient.invalidateQueries({ queryKey: ["finding", action?.finding_id] });
    void queryClient.invalidateQueries({ queryKey: ["resolution-evidence", actionId] });
  };

  const rootCauseValue = rootCause === "Other" ? rootCauseOther.trim() : rootCause;
  const delayValue = delayReason === "Other" ? delayOther.trim() : delayReason;
  const pastDeadline = Boolean(action?.due_at && new Date(action.due_at).getTime() < Date.now());
  const needsDelayReason = pastDeadline && !action?.delay_reason?.trim();
  const delayMissing = needsDelayReason && !delayValue;

  const planMutation = useMutation({
    mutationFn: () => saveActionPlan({ actionId, rootCause: rootCauseValue, preventiveAction: preventive }),
    onSuccess: () => {
      toast.success("Root cause saved.");
      invalidate();
    },
    onError: (err) => toast.error(toUserMessage(err)),
  });

  const resolveMutation = useMutation({
    mutationFn: async () => {
      let storagePath: string | null = null;
      if (file) storagePath = await uploadResolutionPhoto(file);
      await submitResolution({
        actionId,
        findingId: action?.finding_id,
        notes,
        qty: qty ? Number(qty) : null,
        storagePath,
        priority: action?.priority,
        rootCause: action?.root_cause,
        preventiveAction: action?.preventive_action,
        delayReason: needsDelayReason ? delayValue : null,
      });
    },
    onSuccess: () => {
      toast.success("Fix submitted for verification.");
      setNotes("");
      setFile(null);
      invalidate();
    },
    onError: (err) => toast.error(toUserMessage(err)),
  });

  const recheckMutation = useMutation({
    mutationFn: async () => {
      if (!action) throw new Error("Action not loaded.");
      if (!recheckFiles.length) throw new Error("Add at least one after photo.");
      if (delayMissing) throw new Error("Pick the reason for the delay first.");
      if (needsDelayReason) await saveDelayReason(actionId, delayValue);
      setRecheck({ status: "pending" });
      const scanId = await startAiRecheck({
        action,
        files: recheckFiles,
        onUploadProgress: setUploadPct,
        captureMeta: recheckMeta,
      });
      setUploadPct(null);
      invalidate();
      return runAiRecheck(actionId, scanId);
    },
    onSuccess: (result) => {
      setRecheck(result);
      setRecheckFiles([]);
      setRecheckMeta(null);
      if (result.status === "passed") toast.success("AI re-check passed.");
      else if (result.status === "failed") toast.error("AI re-check still found the issue.");
      invalidate();
    },
    onError: (err) => {
      setUploadPct(null);
      setRecheck(null);
      toast.error(toUserMessage(err));
      invalidate();
    },
  });

  const refreshRecheck = useMutation({
    mutationFn: () => evaluateAiRecheck(actionId),
    onSuccess: (result) => {
      setRecheck(result);
      invalidate();
    },
    onError: (err) => toast.error(toUserMessage(err)),
  });

  const finding = findingQuery.data;
  const resolutionEvidence = evidenceQuery.data ?? [];
  const afterPath = resolutionEvidence.find((e) => e.storage_path)?.storage_path ?? null;
  const afterUrlQuery = useQuery({
    queryKey: ["resolution-photo", afterPath],
    queryFn: () => (afterPath ? resolutionPhotoUrl(afterPath) : Promise.resolve(null)),
    enabled: Boolean(afterPath),
  });
  const afterUrl = afterUrlQuery.data ?? null;
  const isManager = Boolean(managerQuery.data);

  return (
    <AppShell title="" hidePageHeader>
      <Link
        to="/corrective-actions"
        className="mb-4 inline-flex items-center gap-1 text-sm text-mp-muted hover:text-navy"
      >
        <ArrowLeft className="size-4" /> All corrective actions
      </Link>

      {actionQuery.isPending ? (
        <Skeleton className="h-80" />
      ) : !action ? (
        <ErrorState title="Action not found" />
      ) : (
        renderBody()
      )}
    </AppShell>
  );

  function renderBody() {
    if (!action) return null;
    const stage = actionStage(action.status);
    const open = stage === "open" || stage === "in_progress";
    const needsPlan = requiresRootCause(action.priority);
    const planDone = Boolean(action.root_cause?.trim() && action.preventive_action?.trim());
    const aiVerify = action.verification_method === "ai_rescan" && Boolean(action.scan_id);
    const escalation = escalationLabel(action.escalation_level);
    const recheckStatus: RecheckResult["status"] | null =
      recheck?.status ??
      (action.verification_status === "passed"
        ? "passed"
        : action.verification_status === "failed"
          ? "failed"
          : action.verification_status === "pending" && action.verification_scan_id
            ? "pending"
            : null);
    const before = recheck?.before ?? action.before_score;
    const after = recheck?.after ?? action.after_score;

    return (
      <div className="space-y-4">
        {isUnreviewedAction(action.status) ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#D9E2E8] bg-white p-4">
            <p className="flex items-center gap-2 text-sm text-navy">
              <span
                className="size-1.5 rounded-full"
                style={{ background: action.status === "proposed" ? AISLIX_PALETTE.purple : "#EEF1F4" }}
              />
              {action.status === "proposed"
                ? "This fix is waiting for review. It gets an owner and a deadline once the auditor or a manager approves it."
                : "This fix was rejected at review, so no one needs to act on it."}
            </p>
            {action.scan_id ? (
              <Button asChild size="sm" variant="outline" className="rounded-lg">
                <Link to="/results" search={{ scan: action.scan_id }}>
                  {action.status === "proposed" ? "Review on the audit" : "Open the audit"}
                </Link>
              </Button>
            ) : null}
          </div>
        ) : null}
        <MpCard className="p-5">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-mp-muted">{action.code ?? "—"}</span>
            <PriorityPill priority={action.priority} />
            <StagePill action={action} />
            <SourcePill source={action.source} />
            {escalation ? (
              <span
                className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold text-navy"
                style={{ background: AISLIX_PALETTE.card, borderColor: CA_PINK_BAR }}
              >
                <ShieldAlert className="size-3" /> {escalation}
              </span>
            ) : null}
          </div>
          <h1 className="mt-2 font-display text-xl font-semibold text-navy">{hideModelNames(action.title)}</h1>
          {action.suggestion && action.suggestion !== action.title ? (
            <p className="mt-1 text-sm text-mp-muted">{hideModelNames(action.suggestion)}</p>
          ) : null}
          <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <Fact label="Type" value={actionTypeLabel(action.action_type)} />
            <Fact label="Store" value={action.store_name ?? "No store"} />
            <Fact label="Owner" value={action.assigned_name} />
            <Fact
              label="Due"
              value={
                action.due_at ? (
                  <>
                    {new Date(action.due_at).toLocaleString([], {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    <span className="block text-xs text-mp-muted">{slaRemainingLabel(action.due_at, action.status)}</span>
                  </>
                ) : (
                  "Not set"
                )
              }
            />
            <Fact label="SLA" value={<SlaFactValue action={action} />} />
            <Fact label="Verified by" value={verificationMethodLabel(action.verification_method)} />
          </dl>
          <div className="mt-5 border-t border-line pt-4">
            <LifecycleStepper action={action} />
          </div>
        </MpCard>

        {action.scan_id ? (
          <Section
            title="Audit photo"
            description={`${action.source === "digital" ? "Digital audit" : "AI audit"}${
              action.store_name ? ` at ${action.store_name}` : ""
            } that raised this action.`}
            accent={AISLIX_PALETTE.cyan}
            aside={
              <Button asChild size="sm" variant="outline" className="rounded-lg">
                <Link to="/results" search={{ scan: action.scan_id }}>
                  Open full audit
                </Link>
              </Button>
            }
          >
            <ActionAuditPhoto
              scanId={action.scan_id}
              source={action.source}
              sku={finding?.sku ?? action.sku}
              productName={finding?.product_name ?? null}
            />
          </Section>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <Section title="What was found" description="The finding that raised this action." accent={AISLIX_PALETTE.blue}>
            {finding ? (
              <>
                <dl className="grid grid-cols-2 gap-4">
                  <Fact label="Finding" value={hideModelNames(finding.title)} />
                  {finding.product_name || finding.sku ? (
                    <Fact label="Product" value={finding.product_name || finding.sku} />
                  ) : null}
                  {finding.expected_value != null ? (
                    <Fact label="Expected" value={<span className="tabular-nums">{finding.expected_value}</span>} />
                  ) : null}
                  {finding.actual_value != null ? (
                    <Fact label="Found" value={<span className="tabular-nums">{finding.actual_value}</span>} />
                  ) : null}
                </dl>
                {finding.description ? (
                  <p className="mt-3 text-sm text-navy">{hideModelNames(finding.description)}</p>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-mp-muted">{hideModelNames(action.description ?? action.suggestion)}</p>
            )}
          </Section>

          <Section
            title="Root cause & prevention"
            description={
              needsPlan ? "Required for critical and high priority before submitting." : "Optional for this priority."
            }
            accent={AISLIX_PALETTE.purple}
            aside={
              planDone ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-navy">
                  <CheckCircle2 className="size-3.5" style={{ color: AISLIX_PALETTE.green }} /> Recorded
                </span>
              ) : needsPlan ? (
                <span
                  className="rounded-full border px-2 py-0.5 text-[11px] font-semibold text-navy"
                  style={{ background: AISLIX_PALETTE.card, borderColor: CA_PINK_BAR }}
                >
                  Required
                </span>
              ) : null
            }
          >
            <div className="space-y-3">
              <div>
                <Label>Root cause</Label>
                <Select value={rootCause} onValueChange={setRootCause} disabled={!open}>
                  <SelectTrigger className="mt-1 h-9 rounded-lg">
                    <SelectValue placeholder="Why did this happen?" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROOT_CAUSE_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {rootCause === "Other" ? (
                  <Input
                    className="mt-2"
                    placeholder="Describe the root cause"
                    value={rootCauseOther}
                    onChange={(e) => setRootCauseOther(e.target.value)}
                    disabled={!open}
                  />
                ) : null}
              </div>
              <div>
                <Label>Preventive action</Label>
                <Textarea
                  className="mt-1"
                  placeholder="What will stop this happening again?"
                  value={preventive}
                  onChange={(e) => setPreventive(e.target.value)}
                  disabled={!open}
                />
              </div>
              {open ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={planMutation.isPending || !rootCauseValue || !preventive.trim()}
                  onClick={() => planMutation.mutate()}
                >
                  {planMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null} Save
                </Button>
              ) : null}
            </div>
          </Section>
        </div>

        <Section
          title="Fix & evidence"
          description="Fix the shelf, then send the evidence for verification."
          accent={AISLIX_PALETTE.cyan}
          aside={
            action.status === "assigned" || action.status === "open" || action.status === "overdue" ? (
              <Button size="sm" onClick={() => void startAction(action.id).then(invalidate)}>
                Start work
              </Button>
            ) : null
          }
        >
          {action.evidence_required.length ? (
            <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-mp-muted">Evidence needed:</span>
              {action.evidence_required.map((item) => (
                <span
                  key={item}
                  className="rounded-full border px-2 py-0.5 font-semibold text-navy"
                  style={{ background: ACCENT_TINT.cyan, borderColor: AISLIX_PALETTE.cyan }}
                >
                  {evidenceLabel(item)}
                </span>
              ))}
            </div>
          ) : null}

          {rejectReasonBanner(action)}

          {open && needsPlan && !planDone ? (
            <p className="mb-4 rounded-lg border px-3 py-2 text-sm text-navy" style={{ background: AISLIX_PALETTE.card, borderColor: CA_PINK_BAR }}>
              Save the root cause and preventive action above before submitting this fix.
            </p>
          ) : null}

          {open && needsDelayReason ? (
            <div className="mb-4 rounded-xl border p-4" style={{ borderColor: CA_PINK_BAR, background: AISLIX_PALETTE.card }}>
              <Label>Reason for delay</Label>
              <p className="mt-0.5 text-[12px] text-mp-muted">
                The SLA deadline has passed. Pick why so the SLA dashboard can show where delays come from.
              </p>
              <Select value={delayReason} onValueChange={setDelayReason}>
                <SelectTrigger className="mt-2 h-9 max-w-sm rounded-lg">
                  <SelectValue placeholder="Why is this late?" />
                </SelectTrigger>
                <SelectContent>
                  {ROOT_CAUSE_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {delayReason === "Other" ? (
                <Input
                  className="mt-2 max-w-sm"
                  placeholder="Describe the delay"
                  value={delayOther}
                  onChange={(e) => setDelayOther(e.target.value)}
                />
              ) : null}
            </div>
          ) : null}

          {open && aiVerify ? (
            <div className="rounded-xl border p-4" style={{ borderColor: AISLIX_PALETTE.border, background: AISLIX_PALETTE.card }}>
              <p className="flex items-center gap-2 text-sm font-semibold text-navy">
                <Bot className="size-4" /> AI re-check
              </p>
              <p className="mt-1 text-[13px] text-mp-muted">
                Take a photo of the same shelf after the fix. AI audits it again and closes the loop if the issue is gone.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="bg-white"
                  disabled={recheckMutation.isPending}
                  onClick={() => setSweepOpen(true)}
                >
                  <ScanLine className="size-4" /> Guided sweep
                </Button>
                <Input
                  type="file"
                  accept="image/*"
                  multiple
                  className="max-w-xs bg-white"
                  onChange={(e) => {
                    setRecheckFiles(Array.from(e.target.files ?? []));
                    setRecheckMeta(null);
                  }}
                  disabled={recheckMutation.isPending}
                />
                {recheckMeta && recheckFiles.length ? (
                  <span className="text-[12px] text-mp-muted">
                    {recheckFiles.length} sweep photo{recheckFiles.length === 1 ? "" : "s"} ready
                  </span>
                ) : null}
                <Button
                  disabled={
                    recheckMutation.isPending || !recheckFiles.length || (needsPlan && !planDone) || delayMissing
                  }
                  onClick={() => recheckMutation.mutate()}
                >
                  {recheckMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
                  {recheckMutation.isPending
                    ? uploadPct != null && uploadPct < 100
                      ? `Uploading ${uploadPct}%`
                      : "AI is checking…"
                    : "Run AI re-check"}
                </Button>
              </div>
              <GuidedSweepCamera
                open={sweepOpen}
                onOpenChange={setSweepOpen}
                maxPhotos={8}
                onComplete={(result) => {
                  setRecheckFiles(result.files);
                  setRecheckMeta(result.meta);
                }}
              />
            </div>
          ) : null}

          {open ? (
            <details className="mt-4 rounded-xl border p-4" style={{ borderColor: AISLIX_PALETTE.border }} open={!aiVerify}>
              <summary className="cursor-pointer text-sm font-semibold text-navy">
                {aiVerify ? "Send to a manager instead" : "Submit fix for manager review"}
              </summary>
              <div className="mt-3 space-y-3">
                <div>
                  <Label>What did you do?</Label>
                  <Textarea className="mt-1" value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Quantity fixed (optional)</Label>
                    <Input className="mt-1" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} />
                  </div>
                  <div>
                    <Label>After photo or document</Label>
                    <Input
                      className="mt-1"
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    />
                  </div>
                </div>
                <Button
                  disabled={resolveMutation.isPending || !notes.trim() || (needsPlan && !planDone) || delayMissing}
                  onClick={() => resolveMutation.mutate()}
                >
                  {resolveMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null} Submit for verification
                </Button>
              </div>
            </details>
          ) : null}

          {!open ? (
            <BeforeAfterEvidence
              beforeUrl={null}
              afterUrl={afterUrl}
              afterCaption={
                resolutionEvidence[0]
                  ? `${new Date(resolutionEvidence[0].created_at).toLocaleString()}${resolutionEvidence[0].notes ? ` · ${resolutionEvidence[0].notes}` : ""}`
                  : undefined
              }
            />
          ) : null}
          {action.resolution_notes && !open ? <p className="mt-3 text-sm text-navy">{action.resolution_notes}</p> : null}
        </Section>

        <div className="grid gap-4 lg:grid-cols-2">
          <Section title="Verification" description={verificationMethodLabel(action.verification_method)} accent={AISLIX_PALETTE.green}>
            {recheckStatus ? (
              <div
                className="rounded-xl border p-4"
                style={{
                  borderColor: recheckStatus === "passed" ? AISLIX_PALETTE.green : recheckStatus === "failed" ? CA_PINK_BAR : AISLIX_PALETTE.border,
                  background: AISLIX_PALETTE.card,
                }}
              >
                <p className="text-sm font-semibold text-navy">{RECHECK_MESSAGE[recheckStatus]}</p>
                {before != null || after != null ? (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <ScoreBar label="Before" value={before} max={Math.max(before ?? 0, after ?? 0)} color={AISLIX_PALETTE.border} />
                    <ScoreBar label="After" value={after} max={Math.max(before ?? 0, after ?? 0)} color={AISLIX_PALETTE.green} />
                  </div>
                ) : null}
                {recheckStatus === "pending" && !recheckMutation.isPending ? (
                  <Button size="sm" variant="outline" className="mt-3" onClick={() => refreshRecheck.mutate()} disabled={refreshRecheck.isPending}>
                    {refreshRecheck.isPending ? <Loader2 className="size-4 animate-spin" /> : null} Check result
                  </Button>
                ) : null}
                {action.verification_scan_id ? (
                  <Button asChild size="sm" variant="ghost" className="mt-3">
                    <Link to="/results" search={{ scan: action.verification_scan_id }}>
                      Open re-check audit
                    </Link>
                  </Button>
                ) : null}
              </div>
            ) : null}

            {action.verified_at && stage !== "submitted" ? (
              <p className="mt-3 text-sm text-navy">Verified {new Date(action.verified_at).toLocaleString()}</p>
            ) : null}

            {stage === "submitted" && action.resolved_by_verification ? (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-[#D9E2E8] bg-white p-3">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#7DB7D6]" aria-hidden />
                <div className="text-sm">
                  <p className="font-semibold text-navy">Resolved by verification</p>
                  <p className="text-mp-muted">
                    {action.resolution_notes ?? "A human check on the shelf disproved the AI finding."} No shelf
                    correction was made — approve to close it without a fix, or send it back.
                  </p>
                </div>
              </div>
            ) : null}

            {stage === "submitted" && isManager && recheckStatus !== "pending" ? (
              <div className="mt-3 space-y-3">
                <Button
                  onClick={() =>
                    void approveAndClose({ actionId, findingId: action.finding_id })
                      .then(() => {
                        toast.success("Verified and closed.");
                        invalidate();
                      })
                      .catch((err) => toast.error(toUserMessage(err)))
                  }
                >
                  Approve & close
                </Button>
                <Textarea placeholder="Why is the fix not accepted?" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
                <Button
                  variant="outline"
                  disabled={!rejectReason.trim()}
                  onClick={() =>
                    void rejectResolution({ actionId, findingId: action.finding_id, reason: rejectReason })
                      .then(() => {
                        toast.success("Sent back to the owner.");
                        setRejectReason("");
                        invalidate();
                      })
                      .catch((err) => toast.error(toUserMessage(err)))
                  }
                >
                  Send back
                </Button>
              </div>
            ) : stage === "submitted" && !recheckStatus ? (
              <p className="text-sm text-mp-muted">Waiting for a manager to verify the fix.</p>
            ) : null}

            {stage === "verified" ? (
              <Button
                className="mt-3"
                onClick={() =>
                  void closeVerifiedAction({ actionId, findingId: action.finding_id })
                    .then(() => {
                      toast.success("Action closed.");
                      invalidate();
                    })
                    .catch((err) => toast.error(toUserMessage(err)))
                }
              >
                Close action
              </Button>
            ) : null}

            {open && !recheckStatus ? (
              <p className="text-sm text-mp-muted">Verification starts after the fix is submitted.</p>
            ) : null}
            {stage === "closed" ? (
              <p className="mt-2 text-sm text-navy">
                Closed {action.closed_at ? new Date(action.closed_at).toLocaleString() : ""}
              </p>
            ) : null}
          </Section>

          <Section title="Owner" description="Who fixes this and who it escalates to." accent={AISLIX_PALETTE.purple}>
            <p className="flex items-center gap-2 text-sm text-navy">
              <UserRound className="size-4 text-mp-muted" /> {action.assigned_name}
            </p>
            <p className="mt-2 text-xs text-mp-muted">
              {escalation
                ? `${escalation}${action.escalated_at ? ` on ${new Date(action.escalated_at).toLocaleDateString()}` : ""}.`
                : "If this goes past its due date it escalates to the owner's manager, then to admins."}
            </p>
            {isManager && stage !== "closed" ? (
              <div className="mt-4">
                <Label>Reassign</Label>
                <Select
                  value={action.assigned_to ?? ""}
                  onValueChange={(value) =>
                    void reassignAction({ actionId, assigneeId: value })
                      .then(() => {
                        toast.success("Action reassigned.");
                        invalidate();
                      })
                      .catch((err) => toast.error(toUserMessage(err)))
                  }
                >
                  <SelectTrigger className="mt-1 h-9 rounded-lg">
                    <SelectValue placeholder="Choose a person" />
                  </SelectTrigger>
                  <SelectContent>
                    {(membersQuery.data ?? []).map((member) => (
                      <SelectItem key={member.user_id} value={member.user_id}>
                        {member.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </Section>
        </div>
      </div>
    );
  }
}

const SLA_OUTCOME_FACT: Partial<Record<ReturnType<typeof slaOutcome>, { label: string; color: string }>> = {
  met: { label: "Met", color: AISLIX_PALETTE.green },
  breached: { label: "Breached", color: CA_PINK_BAR },
  late_open: { label: "Overdue", color: CA_PINK_BAR },
  awaiting: { label: "Awaiting check", color: AISLIX_PALETTE.blue },
};

function SlaFactValue({ action }: { action: LifecycleAction }) {
  const target = targetMinutes(action);
  const took = actualMinutes(action);
  const outcome = SLA_OUTCOME_FACT[slaOutcome(action)];
  return (
    <>
      {slaTypeLabel(slaTypeOf(action), true)}
      <span className="block text-xs text-mp-muted">
        Target {formatMinutes(target)}
        {took != null ? ` · took ${formatMinutes(took)}` : ""}
      </span>
      {outcome ? (
        <span className="mt-0.5 inline-flex items-center gap-1 text-xs text-navy">
          <span className="size-1.5 rounded-full" style={{ background: outcome.color }} />
          {outcome.label}
        </span>
      ) : null}
      {action.delay_reason ? (
        <span className="block text-xs text-mp-muted">Delay: {action.delay_reason}</span>
      ) : null}
    </>
  );
}

function rejectReasonBanner(action: LifecycleAction) {
  if (!action.rejection_reason || actionStage(action.status) !== "in_progress") return null;
  return (
    <p className="mb-4 rounded-lg border px-3 py-2 text-sm text-navy" style={{ background: AISLIX_PALETTE.card, borderColor: CA_PINK_BAR }}>
      Sent back: {hideModelNames(action.rejection_reason)}
    </p>
  );
}

function ScoreBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number | null | undefined;
  max: number;
  color: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-mp-muted">{label}</span>
        <span className="font-semibold tabular-nums text-navy">
          {value == null ? "N/A" : `${value} shelf issue${value === 1 ? "" : "s"}`}
        </span>
      </div>
      <div className="mt-1 h-2 rounded-full" style={{ background: AISLIX_PALETTE.grey }}>
        {value != null && max > 0 ? (
          <div className="h-2 rounded-full" style={{ width: `${(value / max) * 100}%`, background: color }} />
        ) : null}
      </div>
    </div>
  );
}
