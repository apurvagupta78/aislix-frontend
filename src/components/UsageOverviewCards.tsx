import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BadgeCheck,
  FileSpreadsheet,
  FileText,
  LayoutGrid,
  Package,
  ScanLine,
  Sparkles,
  Store,
  Users,
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
import {
  fetchUsageSummary,
  formatUsageLabel,
  masterSetupUsageLabel,
  usageRatio,
  usageWarningLevel,
} from "@/lib/subscription-limits";

function limitTone(level: ReturnType<typeof usageWarningLevel>): "brand" | "warning" | "green" {
  if (level === "full" || level === "strong") return "warning";
  if (level === "soft") return "brand";
  return "green";
}

/**
 * Usage analytics for the current billing period. Bound to
 * GET /billing/overview and get_org_usage_summary — no fabricated usage numbers.
 */
export function UsageOverviewCards() {
  const query = useQuery({
    queryKey: ["billing", "overview"],
    queryFn: ({ signal }) => fetchBillingOverview(signal),
    retry: false,
  });

  const limitsQuery = useQuery({
    queryKey: ["usage", "summary"],
    queryFn: ({ signal }) => fetchUsageSummary(signal),
    retry: false,
  });

  if (query.isPending || limitsQuery.isPending) {
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
  const limits = limitsQuery.data;
  if (!usage) {
    return (
      <EmptyState
        title="No usage this period yet"
        description="Run your first AI audit to start tracking usage and report volume."
        icon={<ScanLine className="size-5" />}
        action={
          <Button asChild variant="brand" size="sm" className="rounded-xl">
            <Link to="/scan">Start an audit</Link>
          </Button>
        }
      />
    );
  }

  const labels = formatUsageLabel(limits ?? (usage as unknown as Record<string, unknown>));
  const pct = usagePercent(usage);
  const left = remainingScans(usage);
  const health = normalizePercent(usage.average_shelf_health);
  const auditWarn = usageWarningLevel(pct);
  const storeRatio = limits ? usageRatio(limits.stores_used, limits.store_limit) : null;
  const seatRatio = limits ? usageRatio(limits.seats_used, limits.seats_included) : null;
  const masterRatio = limits
    ? usageRatio(limits.master_setups_used, limits.master_setups_included)
    : null;
  const isPayg = limits?.plan_code === "payg";
  const paygEstimate =
    isPayg && limits?.price_per_audit_inr != null
      ? limits.scans_used * limits.price_per_audit_inr
      : null;

  return (
    <div className="space-y-3">
      {usage.platform_bypass ? (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
          <BadgeCheck className="size-3.5" />
          Tester access — limits not enforced
        </span>
      ) : null}

      {(auditWarn === "full" || auditWarn === "strong") && !isPayg ? (
        <p className="text-sm text-amber-700">
          Plan limit {auditWarn === "full" ? "reached" : "almost reached"}.{" "}
          <Link to="/pricing" className="font-medium text-brand underline-offset-2 hover:underline">
            Upgrade plan →
          </Link>
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <RingCard
          label={
            usage.quota_period === "rolling_24h"
              ? "AI audits used in the last 24 hours"
              : isPayg
                ? "Completed AI audits (PAYG)"
                : "AI audits used this month"
          }
          ringValue={isPayg ? null : pct}
          ringLabel={isPayg ? formatNumber(usage.scans_used) : pct === null ? "∞" : `${pct}%`}
          ringSublabel={isPayg ? "billable audits" : pct === null ? "unlimited" : "of quota"}
          tone={limitTone(auditWarn)}
          footer={labels.scans}
        />
        <StatCard
          label="Remaining AI audits"
          value={isPayg ? "Pay per audit" : left === null ? "Unlimited" : formatNumber(left)}
          icon={<Zap className="size-4" />}
          accent={limitTone(auditWarn) === "warning" ? "brand" : "green"}
        />
        <StatCard
          label="Stores"
          value={labels.stores}
          icon={<Store className="size-4" />}
          hint={
            usageWarningLevel(storeRatio) === "full"
              ? "Plan limit reached"
              : usageWarningLevel(storeRatio) === "strong"
                ? "Near limit"
                : undefined
          }
        />
        <StatCard
          label="Team users"
          value={labels.seats}
          icon={<Users className="size-4" />}
          hint={
            usageWarningLevel(seatRatio) === "full"
              ? "Plan limit reached"
              : usageWarningLevel(seatRatio) === "strong"
                ? "Near limit"
                : undefined
          }
        />
        <StatCard
          label="Master shelf setups"
          value={limits ? masterSetupUsageLabel(limits) : labels.masterSetups}
          icon={<LayoutGrid className="size-4" />}
          hint={
            usageWarningLevel(masterRatio) === "full"
              ? "Plan limit reached"
              : usageWarningLevel(masterRatio) === "strong"
                ? "Near limit"
                : undefined
          }
        />
        {isPayg && paygEstimate !== null ? (
          <StatCard
            label="Estimated PAYG charges"
            value={`₹${paygEstimate.toLocaleString("en-IN")}`}
            hint={`₹${limits?.price_per_audit_inr ?? 29} per completed audit`}
            icon={<ScanLine className="size-4" />}
          />
        ) : null}
        <RingCard
          label="Average shelf health"
          ringValue={health ?? null}
          ringLabel={health === undefined ? "—" : `${Math.round(health)}`}
          ringSublabel="score"
          tone="green"
          footer="Across audits in this period"
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
          hint={labels.cooldown ?? "Current"}
          icon={<BadgeCheck className="size-4" />}
        />
      </div>
    </div>
  );
}
