import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { SeverityBadge } from "@/components/audit/AuditStatusBadges";
import { AssignOwnerDialog } from "@/components/exceptions/AssignOwnerDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, ErrorState, Skeleton } from "@/components/States";
import { toUserMessage } from "@/lib/api/errors";
import {
  exceptionLifecycleLabel,
  fetchExceptions,
  type ExceptionLifecycle,
  type ExceptionRecord,
} from "@/lib/exceptions";
import { useGlobalFilters } from "@/lib/global-filters";
import { isOrgManager } from "@/lib/assignments";

export const Route = createFileRoute("/exceptions")({
  head: () => ({
    meta: [{ title: "Exceptions — Aislix" }],
  }),
  component: ExceptionsPage,
});

function ExceptionsPage() {
  return (
    <AppShell
      title="Exceptions & Corrective Actions"
      description="Prioritized issues with impact, owner, evidence links and lifecycle state."
    >
      <ExceptionsMain />
    </AppShell>
  );
}

function ExceptionsMain() {
  const { filters } = useGlobalFilters();
  const [lifecycle, setLifecycle] = useState<ExceptionLifecycle | "all">("all");
  const [severity, setSeverity] = useState<"all" | "critical" | "attention" | "normal">("all");
  const [assignTarget, setAssignTarget] = useState<ExceptionRecord | null>(null);

  const managerQuery = useQuery({
    queryKey: ["is-org-manager"],
    queryFn: () => isOrgManager(),
  });

  const query = useQuery({
    queryKey: ["exceptions", filters.storeId, lifecycle, severity],
    queryFn: () =>
      fetchExceptions({
        storeId: filters.storeId,
        lifecycle,
        severity,
      }),
    enabled: managerQuery.data === true,
  });

  if (managerQuery.isLoading) {
    return <Skeleton className="h-48 w-full" />;
  }

  if (!managerQuery.data) {
    return (
      <EmptyState
        title="Manager access required"
        description="Exception management is available to managers and admins."
      />
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        <Select value={severity} onValueChange={(v) => setSeverity(v as typeof severity)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All severity</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="attention">Attention</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
          </SelectContent>
        </Select>
        <Select value={lifecycle} onValueChange={(v) => setLifecycle(v as typeof lifecycle)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Lifecycle" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All states</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="action_assigned">Action assigned</SelectItem>
            <SelectItem value="investigating">Investigating</SelectItem>
            <SelectItem value="awaiting_verification">Awaiting verification</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {query.isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : query.isError ? (
        <ErrorState description={toUserMessage(query.error)} onRetry={() => void query.refetch()} />
      ) : !query.data?.length ? (
        <EmptyState
          icon={<AlertTriangle className="size-6" />}
          title="No exceptions match these filters"
          description="Critical variances, pending approvals and open corrective actions appear here."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3">Severity</th>
                <th className="p-3">Exception</th>
                <th className="p-3">Location / SKU</th>
                <th className="p-3">Impact</th>
                <th className="p-3">Owner / due</th>
                <th className="p-3">State</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {query.data.map((row) => (
                <tr key={row.id} className="border-b border-border/60 hover:bg-surface/50">
                  <td className="p-3">
                    <SeverityBadge tier={row.severity} />
                  </td>
                  <td className="p-3">
                    <Link
                      to="/exceptions/$exceptionId"
                      params={{ exceptionId: row.id }}
                      className="font-medium text-brand hover:underline"
                    >
                      {row.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">{row.description}</p>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {row.store_name}
                    <br />
                    {row.shelf_label} · {row.sku_label}
                  </td>
                  <td className="p-3 tabular-nums">{row.impact_label ?? "—"}</td>
                  <td className="p-3 text-xs">
                    {row.owner_name}
                    {row.due_at ? (
                      <>
                        <br />
                        {new Date(row.due_at).toLocaleDateString()}
                      </>
                    ) : null}
                  </td>
                  <td className="p-3">
                    <Badge variant="outline">{exceptionLifecycleLabel(row.lifecycle)}</Badge>
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-2">
                      {row.scan_id ? (
                        <Button asChild size="sm" variant="outline">
                          <Link to="/audit-review/$scanId" params={{ scanId: row.scan_id }}>
                            Review
                          </Link>
                        </Button>
                      ) : null}
                      <Button size="sm" onClick={() => setAssignTarget(row)}>
                        Assign owner
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AssignOwnerDialog
        exception={assignTarget}
        open={Boolean(assignTarget)}
        onOpenChange={(open) => !open && setAssignTarget(null)}
      />
    </>
  );
}
