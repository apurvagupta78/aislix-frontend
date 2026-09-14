import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { CreateCorrectiveActionModal } from "@/components/audit-governance/CreateCorrectiveActionModal";
import {
  AiSuggestedBadge,
  FindingSeverityBadge,
  HumanConfirmedBadge,
  SourceBadge,
} from "@/components/audit-governance/GovernanceBadges";
import { SLAIndicator } from "@/components/audit-governance/SLAIndicator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { toUserMessage } from "@/lib/api/errors";
import { isOrgManager } from "@/lib/assignments";
import { RCA_OPTIONS, type RcaCode } from "@/lib/digital-audit";
import {
  confirmFinding,
  fetchFinding,
  findingTypeLabel,
  rcaLabel,
  updateFindingRca,
} from "@/lib/findings";
import { fetchLifecycleActions } from "@/lib/corrective-action-lifecycle";

export const Route = createFileRoute("/findings/$findingId")({
  head: () => ({ meta: [{ title: "Finding — Aislix" }] }),
  component: FindingDetailPage,
});

function FindingDetailPage() {
  const { findingId } = Route.useParams();
  const queryClient = useQueryClient();
  const [rca, setRca] = useState<RcaCode | "">("");
  const [notes, setNotes] = useState("");
  const [actionModalOpen, setActionModalOpen] = useState(false);

  const findingQuery = useQuery({
    queryKey: ["finding", findingId],
    queryFn: () => fetchFinding(findingId),
  });
  const actionsQuery = useQuery({
    queryKey: ["finding-actions", findingId],
    queryFn: () => fetchLifecycleActions({ findingId }),
  });
  const managerQuery = useQuery({
    queryKey: ["is-org-manager"],
    queryFn: () => isOrgManager(),
  });

  const finding = findingQuery.data;

  const rcaMutation = useMutation({
    mutationFn: () => updateFindingRca(findingId, rca as RcaCode, notes),
    onSuccess: () => {
      toast.success("RCA saved.");
      void queryClient.invalidateQueries({ queryKey: ["finding", findingId] });
    },
    onError: (err) => toast.error(toUserMessage(err)),
  });

  const confirmMutation = useMutation({
    mutationFn: () => confirmFinding(findingId),
    onSuccess: () => {
      toast.success("Finding confirmed.");
      void queryClient.invalidateQueries({ queryKey: ["finding", findingId] });
    },
  });

  return (
    <AppShell
      title={finding?.title ?? "Finding"}
      description="Audit → Finding → RCA → Corrective action → Verification"
    >
      <Link to="/findings" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> All findings
      </Link>

      {findingQuery.isPending ? (
        <Skeleton className="h-80" />
      ) : findingQuery.error || !finding ? (
        <ErrorState title="Finding not found" description={toUserMessage(findingQuery.error)} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <section className="rounded-2xl border border-border bg-card p-5">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">What happened?</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <FindingSeverityBadge severity={finding.severity} />
                <Badge variant="outline">{findingTypeLabel(finding.finding_type)}</Badge>
                <SourceBadge mode={finding.audit_origin} />
                {finding.confirmation_state === "ai_suggested" ? (
                  <AiSuggestedBadge />
                ) : (
                  <HumanConfirmedBadge />
                )}
              </div>
              <h2 className="mt-3 text-xl font-semibold">{finding.product_name || finding.sku || finding.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {finding.store_name} · {finding.shelf_label || "Shelf"} · {finding.category || "Category"}
              </p>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div><dt className="text-muted-foreground">Expected</dt><dd className="font-semibold tabular-nums">{finding.expected_value ?? "—"}</dd></div>
                <div><dt className="text-muted-foreground">Actual</dt><dd className="font-semibold tabular-nums">{finding.actual_value ?? "—"}</dd></div>
                <div><dt className="text-muted-foreground">Variance</dt><dd className="font-semibold tabular-nums">{finding.variance_units ?? "—"}</dd></div>
                <div>
                  <dt className="text-muted-foreground">Potential inventory value variance</dt>
                  <dd className="font-semibold tabular-nums">
                    {finding.variance_value_inr != null
                      ? `₹${Math.round(Math.abs(finding.variance_value_inr)).toLocaleString("en-IN")}`
                      : "—"}
                  </dd>
                </div>
              </dl>
              {finding.scan_id ? (
                <Button asChild variant="outline" size="sm" className="mt-4 rounded-xl">
                  <Link to="/results" search={{ scan: finding.scan_id }}>Open original audit</Link>
                </Button>
              ) : null}
            </section>

            <section className="rounded-2xl border border-border bg-card p-5">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Why? (RCA)</p>
              <p className="mt-2 text-sm">Current: {rcaLabel(finding.rca_code)}{finding.rca_notes ? ` — ${finding.rca_notes}` : ""}</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Root cause</Label>
                  <Select value={rca} onValueChange={(v) => setRca(v as RcaCode)}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select RCA" /></SelectTrigger>
                    <SelectContent>
                      {RCA_OPTIONS.map((opt) => (
                        <SelectItem key={opt.code} value={opt.code}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Notes {rca === "other" ? "(required)" : ""}</Label>
                  <Textarea className="mt-1" value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Button size="sm" disabled={!rca || rcaMutation.isPending} onClick={() => rcaMutation.mutate()}>
                  {rcaMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null} Save RCA
                </Button>
                {finding.confirmation_state === "ai_suggested" ? (
                  <Button size="sm" variant="outline" onClick={() => confirmMutation.mutate()}>
                    Confirm AI suggestion
                  </Button>
                ) : null}
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card p-5">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Corrective actions</p>
              {(actionsQuery.data ?? []).length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">No corrective action yet.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {(actionsQuery.data ?? []).map((action) => (
                    <li key={action.id} className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm">
                      <div>
                        <Link to="/corrective-actions/$actionId" params={{ actionId: action.id }} className="font-medium hover:underline">
                          {action.title}
                        </Link>
                        <SLAIndicator dueAt={action.due_at} status={action.status} className="mt-1" />
                        <p className="text-xs text-muted-foreground">{action.assigned_name}</p>
                      </div>
                      <Badge variant="outline" className="capitalize">{action.status.replaceAll("_", " ")}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {managerQuery.data ? (
            <section className="h-fit rounded-2xl border border-border bg-card p-5">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Corrective action</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Assign an owner, set SLA and escalation for this finding.
              </p>
              <Button className="mt-4 w-full" onClick={() => setActionModalOpen(true)}>
                Create corrective action
              </Button>
            </section>
          ) : null}
        </div>
      )}

      {finding ? (
        <CreateCorrectiveActionModal
          finding={finding}
          open={actionModalOpen}
          onOpenChange={setActionModalOpen}
          onCreated={() => {
            void queryClient.invalidateQueries({ queryKey: ["finding-actions", findingId] });
            void queryClient.invalidateQueries({ queryKey: ["finding", findingId] });
          }}
        />
      ) : null}
    </AppShell>
  );
}
