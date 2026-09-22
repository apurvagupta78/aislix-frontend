import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { BeforeAfterEvidence } from "@/components/audit-governance/BeforeAfterEvidence";
import { ActionStatusBadge, PriorityBadge } from "@/components/audit-governance/GovernanceBadges";
import { SLAIndicator } from "@/components/audit-governance/SLAIndicator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ErrorState, Skeleton } from "@/components/States";
import { toUserMessage } from "@/lib/api/errors";
import { isOrgManager } from "@/lib/assignments";
import { fetchFinding, rcaLabel } from "@/lib/findings";
import {
  approveAndClose,
  fetchLifecycleAction,
  rejectResolution,
  startAction,
  submitResolution,
} from "@/lib/corrective-action-lifecycle";
import { fetchResolutionEvidence, uploadResolutionPhoto } from "@/lib/reaudit";

export const Route = createFileRoute("/corrective-actions/$actionId")({
  head: () => ({ meta: [{ title: "Corrective Action — Aislix" }] }),
  component: ActionDetailPage,
});

function Step({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function ActionDetailPage() {
  const { actionId } = Route.useParams();
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState("");
  const [qty, setQty] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const actionQuery = useQuery({
    queryKey: ["lifecycle-action", actionId],
    queryFn: async () => {
      return await Promise.race([
        fetchLifecycleAction(actionId),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Timed out loading this action.")), 20_000),
        ),
      ]);
    },
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

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["lifecycle-action", actionId] });
    void queryClient.invalidateQueries({ queryKey: ["finding", action?.finding_id] });
    void queryClient.invalidateQueries({ queryKey: ["resolution-evidence", actionId] });
  };

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
      });
    },
    onSuccess: () => {
      toast.success("Resolution submitted for manager verification.");
      invalidate();
    },
    onError: (err) => toast.error(toUserMessage(err)),
  });

  const finding = findingQuery.data;
  const resolutionEvidence = evidenceQuery.data ?? [];
  const afterUrl = resolutionEvidence.find((e) => (e as any).signed_url)?.signed_url ?? null;

  return (
    <AppShell title={action?.title ?? "Corrective action"} description="Before → Action → After → Verification">
      <Link to="/corrective-actions" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> All corrective actions
      </Link>

      {actionQuery.isPending ? (
        <Skeleton className="h-80" />
      ) : !action ? (
        <ErrorState title="Action not found" />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <PriorityBadge priority={action.priority} />
            <ActionStatusBadge status={action.status} />
            <SLAIndicator dueAt={action.due_at} status={action.status} />
            {action.rejection_reason ? (
              <Badge variant="destructive" className="rounded-full">
                Rejected: {action.rejection_reason}
              </Badge>
            ) : null}
          </div>

          <Step label="Before — original issue">
            {finding ? (
              <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div><dt className="text-muted-foreground">SKU</dt><dd>{finding.product_name || finding.sku}</dd></div>
                <div><dt className="text-muted-foreground">Expected</dt><dd className="tabular-nums">{finding.expected_value ?? "—"}</dd></div>
                <div><dt className="text-muted-foreground">Actual</dt><dd className="tabular-nums">{finding.actual_value ?? "—"}</dd></div>
                <div><dt className="text-muted-foreground">RCA</dt><dd>{rcaLabel(finding.rca_code)}</dd></div>
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">{action.suggestion}</p>
            )}
            {finding?.scan_id ? (
              <Button asChild size="sm" variant="outline" className="mt-3 rounded-xl">
                <Link to="/results" search={{ scan: finding.scan_id }}>Original audit evidence</Link>
              </Button>
            ) : null}
          </Step>

          <Step label="Action — who / SLA">
            <p className="text-sm">{action.assigned_name} · due {action.due_at ? new Date(action.due_at).toLocaleString() : "not set"} · SLA {action.sla_hours ?? "—"}h</p>
            {action.status === "assigned" || action.status === "open" ? (
              <Button size="sm" className="mt-3" onClick={() => void startAction(action.id).then(invalidate)}>
                Start work
              </Button>
            ) : null}
          </Step>

          <Step label="After — resolution evidence">
            <BeforeAfterEvidence
              beforeUrl={null}
              afterUrl={afterUrl}
              afterCaption={
                resolutionEvidence[0]
                  ? `${new Date(resolutionEvidence[0].created_at).toLocaleString()}${resolutionEvidence[0].notes ? ` · ${resolutionEvidence[0].notes}` : ""}`
                  : undefined
              }
            />
            {action.resolution_notes ? <p className="mt-3 text-sm">{action.resolution_notes}</p> : null}
            {["in_progress", "rejected", "assigned", "open", "overdue"].includes(action.status) ? (
              <div className="mt-3 space-y-3">
                <div>
                  <Label>Resolution notes</Label>
                  <Textarea className="mt-1" value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
                <div>
                  <Label>Resolution quantity (optional)</Label>
                  <Input className="mt-1" value={qty} onChange={(e) => setQty(e.target.value)} />
                </div>
                <div>
                  <Label>Resolution photo</Label>
                  <Input className="mt-1" type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                </div>
                <Button disabled={resolveMutation.isPending} onClick={() => resolveMutation.mutate()}>
                  {resolveMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null} Submit for verification
                </Button>
              </div>
            ) : null}
          </Step>

          <Step label="Verification">
            {action.verified_at ? (
              <p className="text-sm">Verified {new Date(action.verified_at).toLocaleString()}</p>
            ) : action.status === "pending_verification" && managerQuery.data ? (
              <div className="space-y-3">
                <Button onClick={() => void approveAndClose({ actionId, findingId: action.finding_id }).then(() => { toast.success("Closed."); invalidate(); })}>
                  Approve & close
                </Button>
                <Textarea placeholder="Rejection reason" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
                <Button
                  variant="outline"
                  onClick={() =>
                    void rejectResolution({ actionId, findingId: action.finding_id, reason: rejectReason }).then(() => {
                      toast.success("Returned to in progress.");
                      invalidate();
                    })
                  }
                >
                  Reject resolution
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Waiting for manager verification.</p>
            )}
          </Step>
        </div>
      )}
    </AppShell>
  );
}
