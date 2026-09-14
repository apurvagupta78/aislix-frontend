import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Skeleton } from "@/components/States";
import { KpiCard } from "@/components/audit-governance/KpiCard";
import { FindingSeverityBadge } from "@/components/audit-governance/GovernanceBadges";
import { SLAIndicator } from "@/components/audit-governance/SLAIndicator";
import { CommandSectionHeader } from "@/components/dashboard/WorkspaceDashboardView";
import type { DashboardFilterState } from "@/lib/dashboard-filters";
import { fetchGovernanceCommandCenter } from "@/lib/governance-dashboard";
import { findingTypeLabel } from "@/lib/findings";

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--card)",
  fontSize: 12,
} as const;

export function DashboardCommandCenter({
  filters,
  planogramCompliance,
}: {
  filters: DashboardFilterState;
  planogramCompliance?: number | null;
}) {
  const query = useQuery({
    queryKey: ["governance-command-center", filters, planogramCompliance],
    queryFn: () => fetchGovernanceCommandCenter(filters, planogramCompliance),
    staleTime: 60_000,
  });

  const data = query.data;

  if (query.isLoading) {
    return (
      <section className="mt-8 space-y-4">
        <CommandSectionHeader eyebrow="Operations command center" description="Loading audit governance metrics…" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      </section>
    );
  }

  if (!data) return null;

  const { findingsKpis: fk, actionKpis: ak } = data;

  return (
    <section className="mt-8 space-y-6">
      <CommandSectionHeader
        eyebrow="Operations command center"
        description="Audits, inventory variance, findings, corrective actions and SLA performance across your operation."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Stores" value={String(data.storeCount)} />
        <KpiCard
          label="Active audits"
          value={String(data.auditStatus.assigned + data.auditStatus.in_progress)}
          hint={`${data.auditStatus.submitted} submitted · ${data.auditStatus.approved} approved`}
        />
        <KpiCard
          label="Completion %"
          value={data.completionPct != null ? `${data.completionPct.toFixed(0)}%` : "—"}
        />
        <KpiCard label="Inventory variance (units)" value={String(data.inventoryVarianceUnits)} />
        <KpiCard
          label="Potential value variance"
          value={`₹${Math.round(fk.value_at_risk).toLocaleString("en-IN")}`}
          hint="Not confirmed financial loss"
        />
        <KpiCard label="Critical findings" value={String(fk.critical)} />
        <KpiCard label="Open corrective actions" value={String(ak.open)} />
        <KpiCard label="Overdue actions" value={String(ak.overdue)} />
        <KpiCard
          label="SLA compliance"
          value={data.slaCompliancePct != null ? `${data.slaCompliancePct.toFixed(0)}%` : "—"}
        />
        <KpiCard
          label="Planogram compliance"
          value={data.planogramCompliance != null ? `${Math.round(data.planogramCompliance)}%` : "—"}
        />
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="text-sm font-semibold">Audit status</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-5">
          {(
            [
              ["Assigned", data.auditStatus.assigned],
              ["In progress", data.auditStatus.in_progress],
              ["Submitted", data.auditStatus.submitted],
              ["Approved", data.auditStatus.approved],
              ["Overdue", data.auditStatus.overdue],
            ] as const
          ).map(([label, count]) => (
            <div key={label} className="rounded-xl border border-border bg-surface px-3 py-2">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-xl font-semibold tabular-nums">{count}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <RankPanel
          title="Top variance stores"
          empty="No store-level variance in the selected period."
          rows={data.topVarianceStores}
          linkTo={(id) => ({ to: "/stores/$storeId", params: { storeId: id } })}
        />
        <RankPanel
          title="Top variance SKUs"
          empty="No SKU-level variance recorded yet."
          rows={data.topVarianceSkus}
          linkTo={(id) => ({ to: "/sku-intelligence", search: { sku: id } })}
        />
      </div>

      {data.criticalFindings.length ? (
        <div className="rounded-2xl border border-destructive/20 bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">Critical findings</p>
            <Link to="/findings" className="text-xs text-brand hover:underline">View all</Link>
          </div>
          <ul className="mt-3 space-y-2">
            {data.criticalFindings.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <Link to="/findings/$findingId" params={{ findingId: f.id }} className="font-medium hover:underline">
                  {f.product_name || f.sku || findingTypeLabel(f.finding_type)} · {f.store_name}
                </Link>
                <div className="flex items-center gap-2">
                  <FindingSeverityBadge severity={f.severity} />
                  {f.due_at ? <SLAIndicator dueAt={f.due_at} status={f.status} /> : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm font-semibold">Corrective actions</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <ActionBucket label="Due today" value={ak.dueToday} />
            <ActionBucket label="Overdue" value={ak.overdue} highlight />
            <ActionBucket label="Pending verification" value={ak.pending_verification} />
          </div>
          <Link to="/corrective-actions" className="mt-3 inline-block text-xs text-brand hover:underline">
            Open corrective actions →
          </Link>
        </div>

        {data.rcaBreakdown.length ? (
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-sm font-semibold">RCA breakdown</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Root causes across open and recent findings</p>
            <div className="mt-3 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.rcaBreakdown} layout="vertical" margin={{ left: 8, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="label" width={120} tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="count" fill="var(--brand)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : null}
      </div>

      {data.recurringIssues.length ? (
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm font-semibold">Recurring issues</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Repeated problems detected across stores and SKUs</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  {["Issue", "Frequency", "Store", "SKU", "Last seen", "Impact"].map((h) => (
                    <th key={h} className="px-2 py-1 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.recurringIssues.map((row) => (
                  <tr key={row.key} className="border-t border-border/60">
                    <td className="px-2 py-2">{row.issue}</td>
                    <td className="px-2 py-2 tabular-nums">{row.frequency}×</td>
                    <td className="px-2 py-2">
                      {row.store_id ? (
                        <Link to="/stores/$storeId" params={{ storeId: row.store_id }} className="hover:underline">
                          {row.store}
                        </Link>
                      ) : (
                        row.store
                      )}
                    </td>
                    <td className="px-2 py-2">{row.sku ?? "—"}</td>
                    <td className="px-2 py-2 whitespace-nowrap">{new Date(row.last_seen).toLocaleDateString()}</td>
                    <td className="px-2 py-2 tabular-nums">₹{Math.round(row.total_impact).toLocaleString("en-IN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function RankPanel({
  title,
  empty,
  rows,
  linkTo,
}: {
  title: string;
  empty: string;
  rows: { id: string; label: string; value: number; count: number }[];
  linkTo: (id: string) => { to: string; params?: Record<string, string>; search?: Record<string, string> };
}) {
  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-2 text-sm text-muted-foreground">{empty}</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-sm font-semibold">{title}</p>
      <ul className="mt-3 space-y-2">
        {rows.map((row) => {
          const link = linkTo(row.id);
          return (
            <li key={row.id} className="flex items-center justify-between gap-2 text-sm">
              <Link
                to={link.to}
                params={link.params}
                search={link.search}
                className="min-w-0 truncate font-medium hover:underline"
              >
                {row.label}
              </Link>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                ₹{Math.round(row.value).toLocaleString("en-IN")} · {row.count} finding{row.count === 1 ? "" : "s"}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ActionBucket({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-3 py-2 ${highlight && value > 0 ? "border-destructive/30 bg-destructive/5" : "border-border bg-surface"}`}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
