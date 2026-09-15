import { useState } from "react";
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
import { Skeleton } from "@/components/States";
import { FindingSeverityBadge } from "@/components/audit-governance/GovernanceBadges";
import { fetchSkuHistory } from "@/lib/sku-history";
import { findingTypeLabel } from "@/lib/findings";
import { useGlobalFilters } from "@/lib/global-filters";
import { Button } from "@/components/ui/button";

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--card)",
  fontSize: 12,
} as const;

export function SkuHistoryPanel({ sku }: { sku: string }) {
  const { filters } = useGlobalFilters();
  const [auditCount, setAuditCount] = useState<5 | 10>(5);
  const query = useQuery({
    queryKey: ["sku-history", sku, filters.storeId],
    queryFn: () => fetchSkuHistory(sku, filters.storeId),
    enabled: Boolean(sku),
  });

  const data = query.data;

  if (query.isLoading) return <Skeleton className="h-64 rounded-xl" />;
  if (!data) return null;

  const chartData = data.trend.slice(-auditCount).map((p) => ({
    date: p.date,
    expected: p.expected,
    actual: p.actual,
  }));

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Potential inventory value variance
        </p>
        <p className="text-2xl font-semibold tabular-nums">
          ₹{Math.round(data.totalVarianceValue).toLocaleString("en-IN")}
        </p>
        <p className="text-xs text-muted-foreground">
          Observed shelf variance — not confirmed financial loss
        </p>
      </div>

      {chartData.length ? (
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">Expected vs actual</p>
            <div className="flex rounded-lg border p-0.5">
              {[5, 10].map((count) => (
                <Button
                  key={count}
                  type="button"
                  size="sm"
                  variant={auditCount === count ? "secondary" : "ghost"}
                  className="h-7 rounded-md px-2 text-xs"
                  onClick={() => setAuditCount(count as 5 | 10)}
                >
                  Last {count}
                </Button>
              ))}
            </div>
          </div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} width={32} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="expected"
                  stroke="var(--muted-foreground)"
                  dot={false}
                  name="Expected"
                />
                <Line
                  type="monotone"
                  dataKey="actual"
                  stroke="var(--brand)"
                  dot={false}
                  name="Actual"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : null}

      {data.rcaHistory.length ? (
        <div>
          <p className="mb-2 text-sm font-semibold">RCA history</p>
          <ul className="space-y-1 text-xs">
            {data.rcaHistory.map((r) => (
              <li key={r.code} className="flex justify-between gap-2">
                <span>{r.label}</span>
                <span className="tabular-nums text-muted-foreground">{r.count}×</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {data.findings.length ? (
        <div>
          <p className="mb-2 text-sm font-semibold">Finding history</p>
          <ul className="max-h-40 space-y-2 overflow-y-auto text-xs">
            {data.findings.slice(0, 8).map((f) => (
              <li key={f.id} className="rounded-lg border border-border/60 p-2">
                <Link
                  to="/findings/$findingId"
                  params={{ findingId: f.id }}
                  className="font-medium hover:underline"
                >
                  {findingTypeLabel(f.finding_type)} · {f.store_name}
                </Link>
                <div className="mt-1 flex items-center gap-2">
                  <FindingSeverityBadge severity={f.severity} />
                  <span className="text-muted-foreground capitalize">
                    {f.status.replaceAll("_", " ")}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {data.actions.length ? (
        <div>
          <p className="mb-2 text-sm font-semibold">Corrective actions</p>
          <ul className="space-y-1 text-xs">
            {data.actions.slice(0, 5).map((a) => (
              <li key={a.id}>
                <Link
                  to="/corrective-actions/$actionId"
                  params={{ actionId: a.id }}
                  className="hover:underline"
                >
                  {a.title}
                </Link>
                <span className="ml-2 text-muted-foreground capitalize">
                  {a.status.replaceAll("_", " ")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
