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
import { KpiCard } from "@/components/audit-governance/KpiCard";
import { MpBadge } from "@/components/design-system/MpBadge";
import { PageHeader } from "@/components/design-system/PageHeader";
import {
  MpTableShell,
  mpTableCellClassName,
  mpTableClassName,
  mpTableHeadClassName,
  mpTableRowClassName,
} from "@/components/design-system/MpTableShell";
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
      <AppShell title="" hidePageHeader>
        <PageHeader eyebrow="Intelligence" title="Audit Intelligence" />
        <Skeleton className="mt-6 h-48 w-full" />
      </AppShell>
    );
  }

  if (!accessQuery.data) {
    return (
      <AppShell title="" hidePageHeader>
        <PageHeader eyebrow="Intelligence" title="Audit Intelligence" />
        <ErrorState title="Manager access required" description="Only managers can view audit intelligence." />
      </AppShell>
    );
  }

  if (intelQuery.isError) {
    return (
      <AppShell title="" hidePageHeader>
        <PageHeader eyebrow="Intelligence" title="Audit Intelligence" />
        <ErrorState title="Could not load" description={toUserMessage(intelQuery.error)} />
      </AppShell>
    );
  }

  const data = intelQuery.data;
  if (!data?.total_audits) {
    return (
      <AppShell title="" hidePageHeader>
        <PageHeader
          eyebrow="Intelligence"
          title="Audit Intelligence"
          description="Variance, health scores and auditor performance."
        />
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
    <AppShell title="" hidePageHeader>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Intelligence"
          title="Audit Intelligence"
          description="Variance by store and SKU, health scores, trends and auditor performance."
          meta={
            <MpBadge tone="healthy" dot>
              90-day window
            </MpBadge>
          }
        />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            icon={BarChart3}
            label="Total audits (90d)"
            value={String(data.total_audits)}
            hint={`${data.digital_audits} digital · ${data.ai_audits} AI`}
            tone="info"
          />
          <KpiCard
            icon={TrendingUp}
            label="Total variance"
            value={`₹${Math.abs(data.total_variance_inr).toLocaleString("en-IN")}`}
            tone="neutral"
          />
          <KpiCard
            icon={AlertTriangle}
            label="Critical exceptions"
            value={String(data.critical_exceptions)}
            hint={`${data.attention_exceptions} attention`}
            tone="danger"
          />
          <KpiCard
            icon={Store}
            label="Stores with variance"
            value={String(data.by_store.filter((s) => s.sku_variance_count > 0).length)}
            tone="warn"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="overflow-hidden rounded-xl border border-line bg-white p-4 shadow-card sm:p-5">
            <h3 className="font-display text-[15px] font-semibold text-navy">Compliance trend</h3>
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

          <section className="overflow-hidden rounded-xl border border-line bg-white p-4 shadow-card sm:p-5">
            <h3 className="font-display text-[15px] font-semibold text-navy">Variance by store (₹)</h3>
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

        <MpTableShell title="Top SKU variances">
          <table className={mpTableClassName()}>
            <thead className={mpTableHeadClassName()}>
              <tr>
                <th className="px-3 py-2.5">Product</th>
                <th className="px-3 py-2.5">Store</th>
                <th className="px-3 py-2.5">Expected</th>
                <th className="px-3 py-2.5">Actual</th>
                <th className="px-3 py-2.5">₹ Value</th>
                <th className="px-3 py-2.5">Tier</th>
              </tr>
            </thead>
            <tbody>
              {data.top_skus.map((row) => (
                <tr key={`${row.sku}-${row.product_name}`} className={mpTableRowClassName()}>
                  <td className={`${mpTableCellClassName()} font-medium`}>{row.product_name}</td>
                  <td className={`${mpTableCellClassName()} text-mp-muted`}>{row.store_name}</td>
                  <td className={`${mpTableCellClassName()} tabular-nums`}>{row.expected_qty}</td>
                  <td className={`${mpTableCellClassName()} tabular-nums`}>{row.actual_qty}</td>
                  <td className={`${mpTableCellClassName()} tabular-nums`}>₹{row.variance_value_inr.toFixed(2)}</td>
                  <td className={mpTableCellClassName()}>
                    <TierBadge tier={row.tier} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </MpTableShell>

        <MpTableShell title="Auditor performance">
          <table className={mpTableClassName()}>
            <thead className={mpTableHeadClassName()}>
              <tr>
                <th className="px-3 py-2.5">Auditor</th>
                <th className="px-3 py-2.5">Completion</th>
                <th className="px-3 py-2.5">On-time</th>
                <th className="px-3 py-2.5">Rejection</th>
                <th className="px-3 py-2.5">Assigned</th>
              </tr>
            </thead>
            <tbody>
              {(perfQuery.data ?? []).map((row) => (
                <tr key={row.user_id} className={mpTableRowClassName()}>
                  <td className={`${mpTableCellClassName()} font-medium`}>{row.name}</td>
                  <td className={`${mpTableCellClassName()} tabular-nums`}>{row.completion_rate}%</td>
                  <td className={`${mpTableCellClassName()} tabular-nums`}>{row.on_time_rate}%</td>
                  <td className={`${mpTableCellClassName()} tabular-nums`}>{row.rejection_rate}%</td>
                  <td className={`${mpTableCellClassName()} tabular-nums`}>{row.assignments_total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </MpTableShell>
      </div>
    </AppShell>
  );
}

function TierBadge({ tier }: { tier: "critical" | "attention" | "normal" }) {
  if (tier === "critical") return <MpBadge tone="attention">Critical</MpBadge>;
  if (tier === "attention") return <MpBadge tone="warehouse">Attention</MpBadge>;
  return <MpBadge tone="neutral">Normal</MpBadge>;
}
