import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Flag, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { EvidenceViewerPanel } from "@/components/audit/EvidenceViewerPanel";
import { CollectionMethodBadge, WorkflowBadge } from "@/components/audit/AuditStatusBadges";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton, ErrorState } from "@/components/States";
import { toUserMessage } from "@/lib/api/errors";
import {
  loadDigitalAuditSession,
  RCA_OPTIONS,
  reviewDigitalAudit,
  type DigitalAuditLine,
} from "@/lib/digital-audit";
import { fetchAiAssistedFlags } from "@/lib/ai-assisted-audit";
import { fetchAssignableMembers, isOrgManager } from "@/lib/assignments";
import { AuditLifecyclePanel } from "@/components/audit/AuditLifecyclePanel";
import { requestReaudit } from "@/lib/reaudit";
import { syncFindingsForScan } from "@/lib/findings";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/audit-review/$scanId")({
  head: () => ({ meta: [{ title: "Review Digital Audit — Aislix" }] }),
  component: AuditReviewPage,
});

function AuditReviewPage() {
  const { scanId } = Route.useParams();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");
  const [rejectMode, setRejectMode] = useState<"reopen_same" | "new_assignment">("reopen_same");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [selectedBin, setSelectedBin] = useState<string | null>(null);
  const [reauditReason, setReauditReason] = useState("");
  const [reauditAssignee, setReauditAssignee] = useState("");

  const accessQuery = useQuery({
    queryKey: ["assignment-manager"],
    queryFn: () => isOrgManager(),
    retry: 1,
    staleTime: 60_000,
  });

  const sessionQuery = useQuery({
    queryKey: ["audit-review", scanId],
    queryFn: async () => {
      return await Promise.race([
        loadDigitalAuditSession(scanId),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Timed out loading audit review.")), 20_000),
        ),
      ]);
    },
    retry: false,
  });

  const aiFlagsQuery = useQuery({
    queryKey: ["ai-assisted-flags", scanId],
    queryFn: () => fetchAiAssistedFlags(scanId),
  });

  const metaQuery = useQuery({
    queryKey: ["audit-review-meta", scanId],
    queryFn: async () => {
      const { data } = await supabase
        .from("shelf_scans")
        .select(
          "submitted_at, geofence_status, submitted_lat, submitted_lng, assignment_id, profiles:created_by (full_name)",
        )
        .eq("id", scanId)
        .maybeSingle();
      return data;
    },
  });

  const membersQuery = useQuery({
    queryKey: ["assignable-members"],
    queryFn: fetchAssignableMembers,
    enabled: accessQuery.data === true,
  });

  const reviewMutation = useMutation({
    mutationFn: (input: {
      action: "approved" | "rejected" | "flagged";
      rejectMode?: "reopen_same" | "new_assignment";
    }) =>
      reviewDigitalAudit({
        scanId,
        assignmentId: sessionQuery.data!.assignment_id,
        action: input.action,
        rejectMode: input.rejectMode,
        comment,
      }),
    onSuccess: (_, vars) => {
      toast.success(
        vars.action === "approved"
          ? "Audit approved."
          : vars.action === "flagged"
            ? "Audit flagged."
            : "Audit rejected.",
      );
      void queryClient.invalidateQueries({ queryKey: ["org-assignments"] });
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });

  if (accessQuery.isPending || sessionQuery.isPending) {
    return (
      <AppShell title="Review audit">
        <p className="mb-3 text-sm text-muted-foreground">Loading audit review…</p>
        <Skeleton className="h-48 w-full" />
      </AppShell>
    );
  }

  if (accessQuery.isError) {
    return (
      <AppShell title="Review audit">
        <ErrorState
          title="Could not verify access"
          description={toUserMessage(accessQuery.error)}
        />
      </AppShell>
    );
  }

  if (!accessQuery.data) {
    return (
      <AppShell title="Review audit">
        <ErrorState title="Access denied" description="Only managers can review audits." />
      </AppShell>
    );
  }

  if (sessionQuery.isError || !sessionQuery.data) {
    return (
      <AppShell title="Review audit">
        <ErrorState
          title="Audit not found"
          description={toUserMessage(sessionQuery.error)}
        />
        <Button asChild variant="outline" className="mt-4">
          <Link to="/results" search={{ scan: scanId }}>
            Open audit results instead
          </Link>
        </Button>
      </AppShell>
    );
  }

  const session = sessionQuery.data;
  // AI / FNV / photo audits have no digital lines — Review is the results page.
  if (session.lines.length === 0) {
    return (
      <AppShell title="Review audit">
        <ErrorState
          title="Open results to review this audit"
          description="This scan is not a Digital Audit form. Use Audit results for AI shelf, FNV and photo audits."
        />
        <Button asChild className="mt-4">
          <Link to="/results" search={{ scan: scanId }}>
            Open audit results
          </Link>
        </Button>
      </AppShell>
    );
  }
  const categories = [
    "all",
    ...new Set(session.lines.map((l) => l.category).filter(Boolean) as string[]),
  ];
  const filtered =
    categoryFilter === "all"
      ? session.lines
      : session.lines.filter((l) => l.category === categoryFilter);

  const totalVarianceValue = session.lines.reduce(
    (s, l) => s + (l.variance_value_inr ?? 0),
    0,
  );
  const varianceLines = session.lines.filter((l) => (l.variance_qty ?? 0) !== 0);
  const activeBin =
    selectedBin ?? session.evidence[0]?.bin_key ?? session.bins[0] ?? null;
  const auditorName =
    (metaQuery.data?.profiles as { full_name?: string } | null)?.full_name ?? null;

  return (
    <AppShell
      title="Review & Approval"
      description={`${session.store_name} · ${session.lines.length} SKUs · Digital Audit`}
    >
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/assigned-scans">
            <ArrowLeft className="size-4" /> Back to assignments
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <CollectionMethodBadge mode="digital" />
            <WorkflowBadge status={session.submission_status} />
            {metaQuery.data?.geofence_status ? (
              <Badge variant="outline">GPS: {String(metaQuery.data.geofence_status)}</Badge>
            ) : null}
            <Badge variant="secondary">
              Total variance value: ₹{Math.abs(totalVarianceValue).toFixed(2)}
            </Badge>
            <Badge variant="outline">{varianceLines.length} SKU(s) with variance</Badge>
            {(aiFlagsQuery.data?.length ?? 0) > 0 ? (
              <Badge variant="destructive">
                {aiFlagsQuery.data!.length} AI-assisted mismatch(es)
              </Badge>
            ) : null}
          </div>

          {(aiFlagsQuery.data?.length ?? 0) > 0 ? (
            <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
              <p className="font-medium">AI-Assisted verification</p>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {aiFlagsQuery.data!.map((f) => (
                  <li key={f.line_id}>
                    {f.product_name}: digital {f.actual_qty} vs AI {f.ai_suggested_qty} (Δ{f.delta})
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <Button
                key={cat}
                size="sm"
                variant={categoryFilter === cat ? "default" : "outline"}
                onClick={() => setCategoryFilter(cat)}
              >
                {cat === "all" ? "All categories" : cat}
              </Button>
            ))}
          </div>

          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-3">SKU / Product</th>
                  <th className="p-3">Location</th>
                  <th className="p-3">Expected</th>
                  <th className="p-3">System</th>
                  <th className="p-3">Actual</th>
                  <th className="p-3">Variance</th>
                  <th className="p-3">₹ Value</th>
                  <th className="p-3">RCA</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((line) => (
                  <VarianceRow
                    key={line.id}
                    line={line}
                    onSelectBin={() => setSelectedBin(line.bin_key)}
                    selected={line.bin_key === activeBin}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <EvidenceViewerPanel
            evidence={session.evidence}
            selectedBin={activeBin}
            onSelectBin={setSelectedBin}
            meta={{
              geofence_status: metaQuery.data?.geofence_status as string | null,
              submitted_at: metaQuery.data?.submitted_at as string | null,
              auditor_name: auditorName,
            }}
          />
        </div>

        <aside className="space-y-4 rounded-xl border border-border bg-card p-4 lg:sticky lg:top-4 lg:self-start">
          <h3 className="font-semibold">Review actions</h3>
          <p className="text-xs text-muted-foreground">
            Approving verifies the audit record. Open exceptions and corrective actions remain
            separate until verified.
          </p>
          <Textarea
            placeholder="Comment (optional)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
          />
          <Button
            className="w-full"
            onClick={() => reviewMutation.mutate({ action: "approved" })}
            disabled={reviewMutation.isPending}
          >
            {reviewMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            Approve
          </Button>
          <Button
            className="w-full"
            variant="outline"
            onClick={() => reviewMutation.mutate({ action: "flagged" })}
            disabled={reviewMutation.isPending}
          >
            <Flag className="size-4" /> Flag variance
          </Button>
          <div className="space-y-2 border-t border-border pt-3">
            <p className="text-xs font-medium text-muted-foreground">Reject audit</p>
            <Select
              value={rejectMode}
              onValueChange={(v) => setRejectMode(v as typeof rejectMode)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="reopen_same">Reopen same assignment</SelectItem>
                <SelectItem value="new_assignment">Require new assignment</SelectItem>
              </SelectContent>
            </Select>
            <Button
              className="w-full"
              variant="destructive"
              onClick={() =>
                reviewMutation.mutate({ action: "rejected", rejectMode })
              }
              disabled={reviewMutation.isPending}
            >
              <X className="size-4" /> Reject
            </Button>
          </div>
          <div className="space-y-2 border-t border-border pt-3">
            <p className="text-xs font-medium text-muted-foreground">Request re-audit</p>
            <p className="text-xs text-muted-foreground">The original audit stays locked. A new assignment is created.</p>
            <Textarea
              placeholder="Reason (required)"
              value={reauditReason}
              onChange={(e) => setReauditReason(e.target.value)}
              rows={2}
            />
            <Select value={reauditAssignee} onValueChange={setReauditAssignee}>
              <SelectTrigger><SelectValue placeholder="Assign auditor" /></SelectTrigger>
              <SelectContent>
                {(membersQuery.data ?? []).map((m) => (
                  <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              className="w-full"
              variant="outline"
              disabled={!reauditReason.trim() || !reauditAssignee}
              onClick={() => {
                const member = (membersQuery.data ?? []).find((m) => m.user_id === reauditAssignee);
                void requestReaudit({
                  scanId,
                  assignmentId: session.assignment_id,
                  reason: reauditReason,
                  assigneeId: reauditAssignee,
                  assigneeName: member?.name ?? "Auditor",
                })
                  .then(() => toast.success("Re-audit requested. Original audit is unchanged."))
                  .catch((e) => toast.error(toUserMessage(e)));
              }}
            >
              Request re-audit
            </Button>
          </div>
        </aside>
      </div>
      <div className="mt-6">
        <AuditLifecyclePanel scanId={scanId} />
      </div>
    </AppShell>
  );
}

function VarianceRow({
  line,
  onSelectBin,
  selected,
}: {
  line: DigitalAuditLine;
  onSelectBin?: () => void;
  selected?: boolean;
}) {
  const rcaLabel = RCA_OPTIONS.find((o) => o.code === line.rca_code)?.label ?? "—";
  const variance = line.variance_qty ?? 0;
  return (
    <tr
      className={`border-b border-border/60 ${selected ? "bg-brand-soft/40" : ""} ${onSelectBin ? "cursor-pointer hover:bg-surface/50" : ""}`}
      onClick={onSelectBin}
    >
      <td className="p-3">
        <p className="font-medium">{line.product_name}</p>
        <p className="text-xs text-muted-foreground">{line.sku ?? line.item_code ?? "—"}</p>
      </td>
      <td className="p-3 text-muted-foreground">{line.location || line.bin_key}</td>
      <td className="p-3 tabular-nums">{line.expected_qty}</td>
      <td className="p-3 tabular-nums">{line.system_qty ?? "—"}</td>
      <td className="p-3 tabular-nums">{line.actual_qty ?? "—"}</td>
      <td
        className={`p-3 tabular-nums ${variance !== 0 ? "font-medium text-warning" : ""}`}
      >
        {line.variance_qty ?? "—"}
        {line.variance_pct != null ? ` (${line.variance_pct.toFixed(0)}%)` : ""}
      </td>
      <td className="p-3 tabular-nums">
        {line.variance_value_inr != null ? `₹${line.variance_value_inr.toFixed(2)}` : "—"}
      </td>
      <td className="p-3 text-xs">{rcaLabel}</td>
    </tr>
  );
}
