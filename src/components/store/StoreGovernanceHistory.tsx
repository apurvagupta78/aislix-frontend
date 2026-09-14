import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Panel } from "@/components/org/StoreDashboardParts";
import { OrgStat } from "@/components/org/OrgParts";
import { Skeleton } from "@/components/States";
import { storeHealthLabel } from "@/lib/governance-dashboard";
import { fetchStoreGovernanceSnapshot } from "@/lib/store-governance-history";
import { formatScore } from "@/lib/organization";

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--card)",
  fontSize: 12,
} as const;

export function StoreGovernanceHistory({
  storeId,
  healthScore,
}: {
  storeId: string;
  healthScore?: number | null;
}) {
  const query = useQuery({
    queryKey: ["store-governance", storeId],
    queryFn: () => fetchStoreGovernanceSnapshot(storeId),
    staleTime: 60_000,
  });

  const data = query.data;
  const health = storeHealthLabel(healthScore);

  return (
    <div className="space-y-5">
      <Panel
        title="Store health & governance"
        description="Audit performance, inventory variance, findings and corrective action accountability."
      >
        {query.isLoading ? (
          <Skeleton className="h-32 rounded-xl" />
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Store health score</p>
                <p className={`text-3xl font-semibold tabular-nums ${health.className}`}>
                  {formatScore(healthScore)} <span className="text-base font-medium">/ 100</span>
                </p>
                <p className={`text-sm ${health.className}`}>{health.label}</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <OrgStat label="Open findings" value={String(data?.openFindings ?? 0)} />
              <OrgStat label="Critical findings" value={String(data?.criticalFindings ?? 0)} />
              <OrgStat label="Overdue actions" value={String(data?.overdueActions ?? 0)} />
              <OrgStat
                label="Potential value variance"
                value={`₹${Math.round(data?.totalValueVariance ?? 0).toLocaleString("en-IN")}`}
              />
            </div>
          </>
        )}
      </Panel>

      {query.isLoading ? (
        <Skeleton className="h-56 rounded-2xl" />
      ) : data?.varianceTrend.length ? (
        <Panel title="Inventory variance trend" description="Expected vs actual quantities from digital audits.">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.varianceTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                <Line type="monotone" dataKey="expected" stroke="var(--muted-foreground)" dot={false} name="Expected" />
                <Line type="monotone" dataKey="actual" stroke="var(--brand)" dot={false} name="Actual" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      ) : null}

      {data?.recurringIssues.length ? (
        <Panel title="Recurring issues" description="SKUs and finding types that repeat at this store.">
          <ul className="space-y-2 text-sm">
            {data.recurringIssues.map((row) => (
              <li key={`${row.sku}-${row.finding_type}`} className="flex flex-wrap justify-between gap-2 rounded-xl border border-border px-3 py-2">
                <span>
                  {row.product_name} — {row.finding_type} · {row.frequency}× in last 90 days
                </span>
                <span className="text-muted-foreground tabular-nums">
                  ₹{Math.round(row.total_impact).toLocaleString("en-IN")}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {data?.auditHistory.length ? (
        <Panel title="Audit history" description="Chronological audits with findings and open actions.">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  {["Date", "Health", "Findings", "Open actions", "Planogram", "Audit"].map((h) => (
                    <th key={h} className="px-2 py-1 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.auditHistory.map((row) => (
                  <tr key={row.scan_id} className="border-t border-border/60">
                    <td className="px-2 py-2 whitespace-nowrap">{new Date(row.date).toLocaleDateString()}</td>
                    <td className="px-2 py-2 tabular-nums">{row.health_score != null ? Math.round(row.health_score) : "—"}</td>
                    <td className="px-2 py-2 tabular-nums">{row.findings_count}</td>
                    <td className="px-2 py-2 tabular-nums">{row.open_actions}</td>
                    <td className="px-2 py-2 tabular-nums">
                      {row.planogram_compliance != null ? `${Math.round(row.planogram_compliance)}%` : "—"}
                    </td>
                    <td className="px-2 py-2">
                      <Link to="/results" search={{ scan: row.scan_id }} className="text-brand hover:underline">
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex gap-3 text-sm">
            <Link to="/findings" className="text-brand hover:underline">Finding history</Link>
            <Link to="/corrective-actions" className="text-brand hover:underline">Corrective action history</Link>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
