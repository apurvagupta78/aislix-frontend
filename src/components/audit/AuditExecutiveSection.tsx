import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
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
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/States";
import { ActionRequiredQueue } from "@/components/audit/ActionRequiredQueue";
import { OperationalScorecards } from "@/components/audit/OperationalScorecards";
import { fetchActionRequiredQueue, fetchExecutiveScorecards } from "@/lib/audit-executive";
import { fetchAuditIntelligence } from "@/lib/audit-intelligence";
import { isOrgManager } from "@/lib/assignments";

export function AuditExecutiveSection() {
  const managerQuery = useQuery({
    queryKey: ["assignment-manager"],
    queryFn: () => isOrgManager(),
  });

  const scorecardsQuery = useQuery({
    queryKey: ["executive-scorecards"],
    queryFn: () => fetchExecutiveScorecards(7),
    enabled: managerQuery.data === true,
  });

  const queueQuery = useQuery({
    queryKey: ["action-required-queue"],
    queryFn: () => fetchActionRequiredQueue(10),
    enabled: managerQuery.data === true,
  });

  const intelQuery = useQuery({
    queryKey: ["audit-intelligence-embedded"],
    queryFn: () => fetchAuditIntelligence({ days: 90 }),
    enabled: managerQuery.data === true,
  });

  if (managerQuery.isLoading) return <Skeleton className="h-48 w-full rounded-xl" />;
  if (!managerQuery.data) return null;

  if (scorecardsQuery.isLoading) {
    return <Skeleton className="h-64 w-full rounded-xl" />;
  }

  const intel = intelQuery.data;
  const trendChart =
    intel?.trends.map((t) => ({
      date: t.date.slice(5),
      compliance: t.compliance_percent ?? 0,
    })) ?? [];

  const storeChart =
    intel?.by_store.slice(0, 6).map((s) => ({
      name: s.store_name.length > 10 ? `${s.store_name.slice(0, 10)}…` : s.store_name,
      variance: Math.abs(s.total_variance_value_inr),
    })) ?? [];

  return (
    <section id="executive-overview" className="mt-8 space-y-8 border-t border-border pt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Retail Audit & Shelf Intelligence
          </p>
          <h2 className="text-xl font-semibold tracking-tight">Executive Overview</h2>
          <p className="text-sm text-muted-foreground">
            Digital and AI audits in one accountable workflow — exceptions first.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="rounded-xl">
          <Link to="/audit-intelligence">Full intelligence →</Link>
        </Button>
      </div>

      {scorecardsQuery.data ? <OperationalScorecards data={scorecardsQuery.data} /> : null}

      {queueQuery.data ? <ActionRequiredQueue items={queueQuery.data} /> : null}

      {intel && intel.total_audits > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold">Compliance trend</h3>
            <p className="text-xs text-muted-foreground">Approved audit outcomes · click bars in full intelligence for drilldown</p>
            <div className="mt-3 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendChart}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="compliance" stroke="var(--aislix-primary)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold">Signed variance by store (₹)</h3>
            <p className="text-xs text-muted-foreground">Not confirmed financial loss — observation vs baseline</p>
            <div className="mt-3 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={storeChart}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="variance" fill="var(--aislix-darkstore-bg)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
