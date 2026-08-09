import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BadgeCheck,
  FileSpreadsheet,
  FileText,
  Package,
  ScanLine,
  Sparkles,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardSkeleton, EmptyState, ErrorState } from "@/components/States";
import { RingCard, StatCard } from "@/components/UsageStats";
import {
  fetchBillingOverview,
  formatNumber,
  formatPercent,
  normalizePercent,
  remainingScans,
  usagePercent,
} from "@/lib/billing";

/**
 * Usage analytics for the current billing period. Bound to
 * GET /billing/overview — no fabricated usage numbers.
 */
export function UsageOverviewCards() {
  const query = useQuery({
    queryKey: ["billing", "overview"],
    queryFn: ({ signal }) => fetchBillingOverview(signal),
    retry: false,
  });

  if (query.isPending) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  if (query.isError) {
    return (
      <ErrorState
        title="Usage data unavailable"
        description={(query.error as Error).message}
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  }

  const usage = query.data?.usage;
  if (!usage) {
    return (
      <EmptyState
        title="No usage this period yet"
        description="Run your first shelf scan to start tracking usage and report volume."
        icon={<ScanLine className="size-5" />}
        action={
          <Button asChild variant="brand" size="sm" className="rounded-xl">
            <Link to="/scan">Start a scan</Link>
          </Button>
        }
      />
    );
  }

  const pct = usagePercent(usage);
  const left = remainingScans(usage);
  const health = normalizePercent(usage.average_shelf_health);

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <RingCard
        label={usage.quota_period === "rolling_24h" ? "Scans used in the last 24 hours" : "Scans used this month"}
        ringValue={pct}
        ringLabel={pct === null ? "∞" : `${pct}%`}
        ringSublabel={pct === null ? "unlimited" : "of quota"}
        tone={pct !== null && pct >= 90 ? "warning" : "brand"}
        footer={`${formatNumber(usage.scans_used)} / ${
          usage.scans_included ? formatNumber(usage.scans_included) : "Unlimited"
        }`}
      />
      <RingCard
        label="Average shelf health"
        ringValue={health ?? null}
        ringLabel={health === undefined ? "—" : `${Math.round(health)}`}
        ringSublabel="score"
        tone="green"
        footer="Across scans in this period"
      />
      <StatCard
        label="Remaining scans"
        value={left === null ? "Unlimited" : formatNumber(left)}
        icon={<Zap className="size-4" />}
        accent="green"
      />
      <StatCard
        label="Total products detected"
        value={formatNumber(usage.products_detected)}
        icon={<Package className="size-4" />}
      />
      <StatCard
        label="Average AI confidence"
        value={formatPercent(usage.average_confidence)}
        icon={<Sparkles className="size-4" />}
        accent="green"
      />
      <StatCard
        label="PDF reports generated"
        value={formatNumber(usage.pdf_reports)}
        icon={<FileText className="size-4" />}
      />
      <StatCard
        label="CSV reports generated"
        value={formatNumber(usage.csv_reports)}
        icon={<FileSpreadsheet className="size-4" />}
      />
      <StatCard
        label="Plan"
        value={query.data?.plan_name ?? query.data?.plan_id ?? "—"}
        hint="Current"
        icon={<BadgeCheck className="size-4" />}
      />
    </div>
  );
}
