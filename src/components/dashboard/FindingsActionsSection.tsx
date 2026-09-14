import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { fetchFindings, findingSeverityMeta, findingsKpis } from "@/lib/findings";
import { daysOpen, fetchLifecycleActions, slaRemainingLabel } from "@/lib/corrective-action-lifecycle";
import type { DashboardFilterState } from "@/lib/dashboard-filters";

export function FindingsActionsSection({ filters }: { filters: DashboardFilterState }) {
  const findingsQuery = useQuery({
    queryKey: ["dashboard-findings", filters.storeId, filters.category],
    queryFn: () => fetchFindings({ filters }),
    staleTime: 60_000,
  });
  const actionsQuery = useQuery({
    queryKey: ["dashboard-actions", filters.storeId],
    queryFn: () => fetchLifecycleActions({ storeId: filters.storeId }),
    staleTime: 60_000,
  });

  const findings = findingsQuery.data ?? [];
  const actions = actionsQuery.data ?? [];
  const kpis = findingsKpis(findings);
  const openActions = actions.filter((a) => !["resolved", "closed"].includes(a.status));
  const overdue = openActions.filter((a) => a.status === "overdue" || slaRemainingLabel(a.due_at, a.status).startsWith("Overdue"));
  const dueToday = openActions.filter((a) => {
    if (!a.due_at) return false;
    const d = new Date(a.due_at);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  });
  const pending = actions.filter((a) => a.status === "pending_verification");
  const closedSla = actions.filter((a) => a.closed_at && a.due_at);
  const onTime = closedSla.filter((a) => new Date(a.closed_at!).getTime() <= new Date(a.due_at!).getTime());
  const slaPct = closedSla.length ? (onTime.length / closedSla.length) * 100 : null;
  const avgHours =
    closedSla.length === 0
      ? null
      : closedSla.reduce((sum, a) => sum + (new Date(a.closed_at!).getTime() - new Date(a.created_at).getTime()) / 36e5, 0) /
        closedSla.length;

  const recurring = Object.values(
    findings.reduce<Record<string, { sku: string; store: string; type: string; count: number; value: number; last: string }>>(
      (acc, row) => {
        const key = `${row.store_id}|${row.sku}|${row.finding_type}`;
        const cur = acc[key] ?? {
          sku: row.product_name || row.sku || "SKU",
          store: row.store_name,
          type: row.finding_type,
          count: 0,
          value: 0,
          last: row.created_at,
        };
        cur.count += 1;
        cur.value += Math.abs(row.variance_value_inr || 0);
        if (row.created_at > cur.last) cur.last = row.created_at;
        acc[key] = cur;
        return acc;
      },
      {},
    ),
  )
    .filter((row) => row.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return (
    <section className="mt-8 space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Findings & actions</p>
          <h2 className="text-lg font-semibold">Audit → Finding → Action → Closure</h2>
        </div>
        <Link to="/findings" className="text-sm text-brand hover:underline">View findings</Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card label="Critical findings" value={String(kpis.critical)} extra={`${kpis.open} open · ${kpis.overdue} overdue`} />
        <Card
          label="Corrective actions"
          value={String(openActions.length)}
          extra={`${overdue.length} overdue · ${dueToday.length} due today · ${pending.length} pending verification`}
        />
        <Card
          label="SLA compliance"
          value={slaPct == null ? "—" : `${slaPct.toFixed(1)}%`}
          extra={avgHours == null ? "No closures yet" : `Avg resolution ${avgHours.toFixed(1)} hours`}
        />
        <Card
          label="Inventory value at risk"
          value={`₹${Math.round(kpis.value_at_risk).toLocaleString("en-IN")}`}
          extra="Potential variance, not confirmed loss"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {FINDING_SEVERITY_COUNTS(findings).map((row) => (
          <div key={row.label} className="rounded-xl border border-border px-3 py-2 text-sm">
            <Badge className={`rounded-full border-0 ${row.className}`}>{row.label}</Badge>
            <p className="mt-1 text-lg font-semibold tabular-nums">{row.count}</p>
          </div>
        ))}
      </div>

      {recurring.length ? (
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm font-semibold">Top recurring findings</p>
          <ul className="mt-2 space-y-1 text-sm">
            {recurring.map((row) => (
              <li key={`${row.store}-${row.sku}`} className="flex flex-wrap justify-between gap-2">
                <span>
                  {row.sku} · {row.store} · {row.type.replaceAll("_", " ")} · {row.count} times
                </span>
                <span className="text-muted-foreground">₹{Math.round(row.value).toLocaleString("en-IN")}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {openActions.length ? (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                {["Action", "Priority", "Due", "SLA", "Days open", "Status"].map((h) => (
                  <th key={h} className="px-3 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {openActions.slice(0, 8).map((action) => (
                <tr key={action.id} className="border-t border-border/70">
                  <td className="px-3 py-2">
                    <Link to="/corrective-actions/$actionId" params={{ actionId: action.id }} className="hover:underline">
                      {action.title}
                    </Link>
                  </td>
                  <td className="px-3 py-2 capitalize">{action.priority}</td>
                  <td className="px-3 py-2">{action.due_at ? new Date(action.due_at).toLocaleDateString() : "—"}</td>
                  <td className="px-3 py-2">{slaRemainingLabel(action.due_at, action.status)}</td>
                  <td className="px-3 py-2">{daysOpen(action.created_at, action.closed_at)}</td>
                  <td className="px-3 py-2 capitalize">{action.status.replaceAll("_", " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function Card({ label, value, extra }: { label: string; value: string; extra: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{extra}</p>
    </div>
  );
}

function FINDING_SEVERITY_COUNTS(findings: { severity: string }[]) {
  return ["critical", "high", "medium", "low"].map((sev) => {
    const meta = findingSeverityMeta(sev);
    return { ...meta, count: findings.filter((f) => f.severity === sev).length };
  });
}
