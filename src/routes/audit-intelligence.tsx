import { type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  AlertTriangle,
  Store,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Skeleton, ErrorState, EmptyState } from "@/components/States";
import { toUserMessage } from "@/lib/api/errors";
import { fetchAuditIntelligence } from "@/lib/audit-intelligence";
import { fetchAuditorPerformance } from "@/lib/auditor-performance";
import { isOrgManager } from "@/lib/assignments";
export const Route = createFileRoute("/audit-intelligence")({
  head: () => ({ meta: [{ title: "Audit Intelligence — Aislix" }] }),
  component: AuditIntelligencePage,
});

function AuditIntelligencePage() {
  const accessQuery = useQuery({
    queryKey: ["assignment-manager"],
    queryFn: () => isOrgManager(),
  });

  const intelQuery = useQuery({
    queryKey: ["audit-intelligence"],
    queryFn: () => fetchAuditIntelligence({ days: 90 }),
    enabled: accessQuery.data === true,
    retry: false,
  });

  const perfQuery = useQuery({
    queryKey: ["auditor-performance"],
    queryFn: () => fetchAuditorPerformance(90),
    enabled: accessQuery.data === true,
    retry: false,
  });

  if (accessQuery.isLoading) {
    return (
      <AppShell title="Audit Intelligence">
        <Skeleton className="h-48 w-full" />
      </AppShell>
    );
  }

  if (!accessQuery.data) {
    return (
      <AppShell title="Audit Intelligence">
        <ErrorState title="Manager access required" description="Only managers can view audit intelligence." />
      </AppShell>
    );
  }

  if (intelQuery.isError) {
    return (
      <AppShell title="Audit Intelligence">
        <ErrorState title="Could not load" description={toUserMessage(intelQuery.error)} />
      </AppShell>
    );
  }

  const data = intelQuery.data;
  if (!data?.total_audits) {
    return (
      <AppShell title="Audit Intelligence" description="Variance, health scores and auditor performance.">
        <EmptyState
          title="No audit data yet"
          description="Complete and approve digital audits to populate intelligence dashboards."
        />
      </AppShell>
    );
  }

  const trendChart = data.trends.map((t) => ({
    date: t.date.slice(5),
    compliance: t.compliance_percent ?? 0,
  }));

  const storeChart = data.by_store.slice(0, 8).map((s) => ({
    name: s.store_name.length > 12 ? `${s.store_name.slice(0, 12)}…` : s.store_name,
    variance: Math.abs(s.total_variance_value_inr),
    health: s.health_score ?? 0,
  }));

  return (
    <AppShell
      title="Audit Intelligence"
      description="Variance by store and SKU, health scores, trends and auditor performance."
    >
      <div className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={<BarChart3 className="size-4 text-brand" />}
            label="Total audits (90d)"
            value={String(data.total_audits)}
            sub={`${data.digital_audits} digital · ${data.ai_audits} AI`}
          />
          <StatCard
            icon={<TrendingUp className="size-4 text-brand" />}
            label="Total variance"
            value={`₹${Math.abs(data.total_variance_inr).toLocaleString("en-IN")}`}
          />
          <StatCard
            icon={<AlertTriangle className="size-4 text-warning" />}
            label="Critical exceptions"
            value={String(data.critical_exceptions)}
            sub={`${data.attention_exceptions} attention`}
          />
          <StatCard
            icon={<Store className="size-4 text-brand" />}
            label="Stores with variance"
            value={String(data.by_store.filter((s) => s.sku_variance_count > 0).length)}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-border bg-card p-4">
            <h3 className="font-semibold">Compliance trend</h3>
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendChart}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="compliance" stroke="var(--aislix-primary)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-4">
            <h3 className="font-semibold">Variance by store (₹)</h3>
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={storeChart}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="variance" fill="var(--aislix-darkstore-bg)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>

        <section className="rounded-xl border border-border bg-card p-4">
          <h3 className="font-semibold">Top SKU variances</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-2">Product</th>
                  <th className="p-2">Store</th>
                  <th className="p-2">Expected</th>
                  <th className="p-2">Actual</th>
                  <th className="p-2">₹ Value</th>
                  <th className="p-2">Tier</th>
                </tr>
              </thead>
              <tbody>
                {data.top_skus.map((row) => (
                  <tr key={`${row.sku}-${row.product_name}`} className="border-t border-border/60">
                    <td className="p-2 font-medium">{row.product_name}</td>
                    <td className="p-2 text-muted-foreground">{row.store_name}</td>
                    <td className="p-2 tabular-nums">{row.expected_qty}</td>
                    <td className="p-2 tabular-nums">{row.actual_qty}</td>
                    <td className="p-2 tabular-nums">₹{row.variance_value_inr.toFixed(2)}</td>
                    <td className="p-2">
                      <TierBadge tier={row.tier} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <h3 className="font-semibold">Auditor performance</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-2">Auditor</th>
                  <th className="p-2">Completion</th>
                  <th className="p-2">On-time</th>
                  <th className="p-2">Rejection</th>
                  <th className="p-2">Assigned</th>
                </tr>
              </thead>
              <tbody>
                {(perfQuery.data ?? []).map((row) => (
                  <tr key={row.user_id} className="border-t border-border/60">
                    <td className="p-2 font-medium">{row.name}</td>
                    <td className="p-2 tabular-nums">{row.completion_rate}%</td>
                    <td className="p-2 tabular-nums">{row.on_time_rate}%</td>
                    <td className="p-2 tabular-nums">{row.rejection_rate}%</td>
                    <td className="p-2 tabular-nums">{row.assignments_total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      {sub ? <p className="text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

function TierBadge({ tier }: { tier: "critical" | "attention" | "normal" }) {
  if (tier === "critical") return <Badge variant="destructive">Critical</Badge>;
  if (tier === "attention") return <Badge className="bg-warning text-warning-foreground">Attention</Badge>;
  return <Badge variant="secondary">Normal</Badge>;
}
