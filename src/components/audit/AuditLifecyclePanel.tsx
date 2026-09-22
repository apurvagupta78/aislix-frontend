import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ActivityTimeline } from "@/components/audit-governance/ActivityTimeline";
import { FindingSeverityBadge } from "@/components/audit-governance/GovernanceBadges";
import { SLAIndicator } from "@/components/audit-governance/SLAIndicator";
import { fetchAuditActivity } from "@/lib/audit-activity";
import { fetchFindings, findingTypeLabel } from "@/lib/findings";
import { fetchLifecycleActions } from "@/lib/corrective-action-lifecycle";

export function AuditLifecyclePanel({ scanId }: { scanId: string }) {
  const findingsQuery = useQuery({
    queryKey: ["scan-findings", scanId],
    queryFn: () => fetchFindings({ scanId }),
  });
  const actionsQuery = useQuery({
    queryKey: ["scan-actions", scanId],
    queryFn: () => fetchLifecycleActions({ scanId }),
  });
  const activityQuery = useQuery({
    queryKey: ["scan-activity", scanId],
    queryFn: () => fetchAuditActivity(scanId),
  });

  const findings = findingsQuery.data ?? [];
  const actions = actionsQuery.data ?? [];
  const events = activityQuery.data ?? [];

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">
            Findings
            {findingsQuery.isPending
              ? " (…)"
              : findingsQuery.isError
                ? " (!)"
                : ` (${findings.length})`}
          </h3>
          <Link to="/findings" className="text-xs text-brand hover:underline">All</Link>
        </div>
        {findingsQuery.isPending ? (
          <p className="mt-2 text-sm text-muted-foreground">Loading findings…</p>
        ) : findingsQuery.isError ? (
          <p className="mt-2 text-sm text-destructive">Could not load findings.</p>
        ) : findings.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No findings on this audit yet.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm">
            {findings.slice(0, 8).map((row) => (
                <li key={row.id} className="flex items-start justify-between gap-2">
                  <Link to="/findings/$findingId" params={{ findingId: row.id }} className="hover:underline">
                    {row.product_name || row.sku || findingTypeLabel(row.finding_type)}
                  </Link>
                  <FindingSeverityBadge severity={row.severity} className="shrink-0" />
                </li>
              ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">
            Corrective actions
            {actionsQuery.isPending ? " (…)" : ` (${actions.length})`}
          </h3>
          <Link to="/corrective-actions" className="text-xs text-brand hover:underline">All</Link>
        </div>
        {actionsQuery.isPending ? (
          <p className="mt-2 text-sm text-muted-foreground">Loading actions…</p>
        ) : actions.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No actions assigned yet.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm">
            {actions.slice(0, 8).map((row) => (
              <li key={row.id}>
                <Link to="/corrective-actions/$actionId" params={{ actionId: row.id }} className="hover:underline">
                  {row.title}
                </Link>
                <SLAIndicator dueAt={row.due_at} status={row.status} className="mt-0.5" />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold">Activity</h3>
        {events.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Timeline appears as the audit moves through the lifecycle.</p>
        ) : (
          <div className="mt-2">
            <ActivityTimeline events={events.slice(-12)} />
          </div>
        )}
      </section>
    </div>
  );
}
