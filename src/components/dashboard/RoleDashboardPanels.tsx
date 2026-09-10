import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ClipboardList, IndianRupee, ScanLine, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/States";
import { Panel, SectionHeader } from "@/components/dashboard/DashboardParts";
import type { RoleFamily } from "@/lib/customer-context";
import { fetchExecutionOpportunities, fetchOpenActionsSummary } from "@/lib/opportunity-engine";
import { formatInr } from "@/lib/pricing";
import { fetchMyAssignments } from "@/lib/assignments";

export function FieldDashboardPanel() {
  const assignments = useQuery({
    queryKey: ["my-assignments"],
    queryFn: fetchMyAssignments,
  });
  const actions = useQuery({
    queryKey: ["open-actions-summary"],
    queryFn: fetchOpenActionsSummary,
  });

  const pending =
    assignments.data?.filter((a) =>
      ["pending", "in_progress", "needs_correction"].includes(a.status),
    ) ?? [];

  return (
    <section className="mt-8 space-y-4">
      <SectionHeader
        title="Today's execution priorities"
        description="Assigned stores, open actions, and scans requiring your attention."
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card-surface p-4">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Assigned audits</p>
          {assignments.isPending ? (
            <Skeleton className="mt-2 h-8 w-12" />
          ) : (
            <p className="mt-1 text-2xl font-semibold tabular-nums">{pending.length}</p>
          )}
        </div>
        <div className="card-surface p-4">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Open actions</p>
          {actions.isPending ? (
            <Skeleton className="mt-2 h-8 w-12" />
          ) : (
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {(actions.data?.open ?? 0) + (actions.data?.in_progress ?? 0)}
            </p>
          )}
        </div>
        <div className="card-surface p-4">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Overdue</p>
          {actions.isPending ? (
            <Skeleton className="mt-2 h-8 w-12" />
          ) : (
            <p className="mt-1 text-2xl font-semibold tabular-nums text-destructive">
              {actions.data?.overdue_assignments ?? 0}
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="brand" size="sm" className="rounded-xl">
          <Link to="/my-scans">
            <ClipboardList className="mr-2 size-4" /> My assigned scans
          </Link>
        </Button>
        <Button asChild variant="subtle" size="sm" className="rounded-xl">
          <Link to="/scan">
            <ScanLine className="mr-2 size-4" /> Start scan
          </Link>
        </Button>
      </div>
    </section>
  );
}

export function ExecutiveOpportunityPanel() {
  const opportunities = useQuery({
    queryKey: ["execution-opportunities"],
    queryFn: () => fetchExecutionOpportunities(6),
  });

  return (
    <section className="mt-8">
      <SectionHeader
        title="Execution opportunities"
        description="Estimated revenue at risk from recent scans — clearly labeled as indicative unless planogram pricing is configured."
      />
      <Panel title="Top opportunities">
        {opportunities.isPending ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : !opportunities.data?.length ? (
          <p className="p-4 text-sm text-muted-foreground">
            No estimated opportunities yet. Run shelf audits with planogram pricing to quantify
            revenue at risk.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {opportunities.data.map((opp) => (
              <li key={opp.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                <div>
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <AlertTriangle className="size-3.5 text-warning" />
                    {opp.title}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {opp.store_name} · {opp.confidence === "priced" ? "Priced" : "Indicative estimate"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="flex items-center gap-1 text-sm font-semibold tabular-nums">
                    <IndianRupee className="size-3.5" />
                    {formatInr(opp.estimated_daily_impact_inr)}/day
                  </p>
                  <Button asChild variant="subtle" size="sm" className="mt-1 h-7 rounded-lg text-xs">
                    <Link to="/results" search={{ scan: opp.scan_id }}>
                      View scan
                    </Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </section>
  );
}

export function RoleDashboardExtras({ roleFamily }: { roleFamily: RoleFamily }) {
  if (roleFamily === "field") return <FieldDashboardPanel />;
  if (roleFamily === "executive" || roleFamily === "commercial")
    return <ExecutiveOpportunityPanel />;
  if (roleFamily === "merchandising" || roleFamily === "operations") {
    return (
      <section className="mt-8">
        <SectionHeader
          title="Category execution"
          description="Planogram compliance and share-of-shelf trends across your stores."
          action={
            <Button asChild variant="subtle" size="sm" className="rounded-xl">
              <Link to="/planogram-management">
                <TrendingUp className="mr-2 size-4" /> Planograms
              </Link>
            </Button>
          }
        />
      </section>
    );
  }
  return null;
}
