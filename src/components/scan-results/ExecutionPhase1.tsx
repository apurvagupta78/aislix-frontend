import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowDown, ArrowUp, Minus, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/States";
import { cn } from "@/lib/utils";
import {
  buildActionCenterItems,
  buildAiSummaryParagraph,
  buildKpiStrip,
  executionScore,
  formatScoreDelta,
  formatConfidenceSecondary,
  priorityRecommendations,
  recognitionCoverage,
  shareOfShelfTopBrand,
  totalActionCount,
  totalFacings,
  type ActionCenterItem,
} from "@/lib/scan-execution";
import type { ScanResult } from "@/lib/scan-results";
import { formatScanDate } from "@/lib/scan-results";
import type { CompetitorSnapshot } from "@/lib/brand-intel";
import {
  VIEW_MODE_LABELS,
  type ResultViewMode,
} from "@/lib/customer-context";

const severityStyles: Record<ActionCenterItem["severity"], string> = {
  critical: "text-red-600",
  high: "text-orange-600",
  medium: "text-amber-600",
  low: "text-muted-foreground",
};

const severityIcon: Record<ActionCenterItem["severity"], string> = {
  critical: "🔴",
  high: "🟠",
  medium: "🟡",
  low: "⚪",
};

export function ExecutionAuditHeader({
  data,
  loading,
}: {
  data?: ScanResult;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="card-surface p-5">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>
    );
  }
  const context = [data?.store, data?.location, data?.scan_sub_category || data?.scan_category]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="card-surface p-5 sm:p-6">
      <p className="text-xs font-medium uppercase tracking-widest text-brand">Aislix shelf audit</p>
      <h2 className="mt-2 text-lg font-semibold tracking-tight sm:text-xl">
        {context || "Shelf scan"}
      </h2>
      {data?.created_at && (
        <p className="mt-1 text-sm text-muted-foreground">{formatScanDate(data.created_at)}</p>
      )}
    </div>
  );
}

export function ExecutionScoreHero({
  data,
  loading,
  previousScore,
}: {
  data?: ScanResult;
  loading?: boolean;
  previousScore?: number;
}) {
  const score = executionScore(data);
  const delta = formatScoreDelta(score, previousScore);
  const rising = score !== undefined && previousScore !== undefined && score > previousScore;

  return (
    <div className="card-surface p-5 sm:p-6">
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
        Shelf execution score
      </p>
      {loading ? (
        <Skeleton className="mt-3 h-12 w-32" />
      ) : (
        <div className="mt-2 flex flex-wrap items-end gap-3">
          <p className="text-5xl font-semibold tabular-nums tracking-tight">
            {score ?? "—"}
            {score !== undefined && (
              <span className="text-2xl font-normal text-muted-foreground"> / 100</span>
            )}
          </p>
          {delta && (
            <span
              className={cn(
                "inline-flex items-center gap-1 text-sm font-medium",
                rising ? "text-accent-green" : score === previousScore ? "text-muted-foreground" : "text-orange-600",
              )}
            >
              {rising ? <ArrowUp className="size-4" /> : score === previousScore ? <Minus className="size-4" /> : <ArrowDown className="size-4" />}
              {delta}
            </span>
          )}
        </div>
      )}
      {!loading && recognitionCoverage(data) !== undefined && (
        <p className="mt-3 text-sm text-muted-foreground">
          Recognition coverage: <strong>{recognitionCoverage(data)}%</strong>
          {data?.summary?.average_confidence !== undefined && (
            <span className="ml-2 text-xs">
              ({formatConfidenceSecondary(data.summary.average_confidence)})
            </span>
          )}
        </p>
      )}
    </div>
  );
}

export function ExecutionKpiStripPanel({ data, loading }: { data?: ScanResult; loading?: boolean }) {
  const kpis = buildKpiStrip(data);
  return (
    <div className="grid gap-2 sm:grid-cols-5">
      {kpis.map((kpi) => (
        <div key={kpi.key} className="card-surface px-4 py-3">
          <p className="text-[0.65rem] font-medium uppercase tracking-widest text-muted-foreground">
            {kpi.label}
          </p>
          {loading ? (
            <Skeleton className="mt-2 h-6 w-16" />
          ) : (
            <p className="mt-1 text-lg font-semibold tabular-nums">{kpi.value}</p>
          )}
        </div>
      ))}
    </div>
  );
}

export function ActionCenterPanel({ data, loading }: { data?: ScanResult; loading?: boolean }) {
  const items = buildActionCenterItems(data);
  const total = totalActionCount(items);

  return (
    <div className="card-surface p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">
            {total > 0 ? `${total} issue${total === 1 ? "" : "s"} require action` : "No critical issues detected"}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Prioritized from availability, placement, and planogram compliance
          </p>
        </div>
        {total > 0 && (
          <Badge variant="outline" className="rounded-full border-orange-200 text-orange-700">
            <AlertTriangle className="mr-1 size-3" /> Action required
          </Badge>
        )}
      </div>
      {loading ? (
        <div className="mt-4 space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : items.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Shelf execution looks healthy for this scan. Review inventory below for details.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3"
            >
              <div>
                <p className={cn("text-sm font-medium", severityStyles[item.severity])}>
                  {severityIcon[item.severity]} {item.count} {item.label}
                </p>
                {item.detail && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AiSummaryBlock({ data, loading }: { data?: ScanResult; loading?: boolean }) {
  const text = buildAiSummaryParagraph(data);
  return (
    <div className="card-surface p-5 sm:p-6">
      <h3 className="text-sm font-semibold tracking-tight">AI summary</h3>
      {loading ? (
        <div className="mt-3 space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
        </div>
      ) : (
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{text || "Summary unavailable."}</p>
      )}
    </div>
  );
}

export function ResultViewSwitcher({
  value,
  onChange,
}: {
  value: ResultViewMode;
  onChange: (mode: ResultViewMode) => void;
}) {
  const modes: ResultViewMode[] = ["execution", "merchandising", "brand", "executive"];
  return (
    <div className="flex flex-wrap gap-2">
      {modes.map((mode) => (
        <Button
          key={mode}
          type="button"
          variant={value === mode ? "brand" : "subtle"}
          size="sm"
          className="rounded-xl"
          onClick={() => onChange(mode)}
        >
          {VIEW_MODE_LABELS[mode]}
        </Button>
      ))}
    </div>
  );
}

export function CompetitorIntelPanel({
  snapshot,
  loading,
}: {
  snapshot?: CompetitorSnapshot | null;
  loading?: boolean;
}) {
  return (
    <div className="card-surface p-5 sm:p-6">
      <h3 className="text-sm font-semibold tracking-tight">Competitor intelligence</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Own brand vs tracked competitors on this shelf
      </p>
      {loading ? (
        <div className="mt-4 space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      ) : !snapshot?.primary_brand ? (
        <div className="mt-4">
          <p className="text-sm text-muted-foreground">
            Configure your primary brand and competitors in Settings → Company to unlock competitor
            share tracking.
          </p>
          <Button asChild variant="subtle" size="sm" className="mt-3 rounded-xl">
            <Link to="/settings">Open brand settings</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="rounded-xl border border-brand/20 bg-brand-soft/30 px-4 py-3">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Your brand</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {snapshot.primary_brand}{" "}
              <span className="text-lg text-muted-foreground">
                {snapshot.own_brand_share_percent.toFixed(1)}% share
              </span>
            </p>
          </div>
          <ul className="space-y-2">
            {snapshot.competitor_shares
              .filter((row) => !row.is_primary)
              .map((row) => (
                <li
                  key={row.brand}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm"
                >
                  <span className="font-medium">{row.brand}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {row.share > 0 ? `${row.share.toFixed(1)}%` : "Not detected"}
                  </span>
                </li>
              ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            {snapshot.competitors_detected} of {snapshot.competitors_configured} tracked competitors
            present on shelf
          </p>
        </div>
      )}
    </div>
  );
}

export function ShareOfShelfPanel({ data, loading }: { data?: ScanResult; loading?: boolean }) {
  const brands = data?.charts?.top_brands ?? [];
  const topShare = shareOfShelfTopBrand(data);

  return (
    <div className="card-surface p-5 sm:p-6">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold tracking-tight">Share of shelf</h3>
        {topShare !== undefined && (
          <Badge className="rounded-full bg-brand-soft text-brand hover:bg-brand-soft">
            Top brand {topShare.toFixed(0)}%
          </Badge>
        )}
      </div>
      {loading ? (
        <div className="mt-4 space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      ) : brands.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No brand share data for this scan.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {brands.slice(0, 8).map((row) => (
            <li key={row.brand} className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate font-medium">{row.brand}</span>
              <span className="tabular-nums text-muted-foreground">{row.share.toFixed(1)}%</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function FacingsSummaryStrip({ data, loading }: { data?: ScanResult; loading?: boolean }) {
  const facings = totalFacings(data);
  const s = data?.summary;
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {[
        { label: "Facings detected", value: facings },
        { label: "Unique SKUs", value: s?.unique_skus },
        { label: "Brands", value: s?.unique_brands },
      ].map(({ label, value }) => (
        <div key={label} className="card-surface px-4 py-3">
          <p className="text-[0.65rem] font-medium uppercase tracking-widest text-muted-foreground">
            {label}
          </p>
          {loading ? (
            <Skeleton className="mt-2 h-7 w-12" />
          ) : (
            <p className="mt-1 text-2xl font-semibold tabular-nums">{value ?? "—"}</p>
          )}
        </div>
      ))}
    </div>
  );
}

export function SkuAvailabilityPanel({
  data,
  loading,
  matched,
  expected,
}: {
  data?: ScanResult;
  loading?: boolean;
  matched?: number | null;
  expected?: number | null;
}) {
  const hasAssortment = expected !== null && expected !== undefined && expected > 0;
  const pct =
    hasAssortment && matched !== null && matched !== undefined
      ? Math.round((matched / expected) * 100)
      : data?.planogram?.sku_match_percent ?? data?.planogram?.percent ?? null;

  return (
    <div className="card-surface p-5 sm:p-6">
      <h3 className="text-sm font-semibold tracking-tight">SKU availability</h3>
      {loading ? (
        <Skeleton className="mt-3 h-8 w-40" />
      ) : !hasAssortment && pct === null ? (
        <div className="mt-3">
          <p className="text-sm text-muted-foreground">
            Upload or assign a planogram to measure expected vs actual SKU availability.
          </p>
          <Button asChild variant="subtle" size="sm" className="mt-3 rounded-xl">
            <Link to="/planogram-management">Configure planogram</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-3xl font-semibold tabular-nums">
            {hasAssortment ? `${matched}/${expected}` : pct !== null ? `${Math.round(pct)}%` : "—"}
          </p>
          {pct !== null && (
            <p className="mt-1 text-sm text-muted-foreground">{Math.round(pct)}% of expected SKUs detected</p>
          )}
        </div>
      )}
    </div>
  );
}

export function RecommendedActionsPanel({ data, loading }: { data?: ScanResult; loading?: boolean }) {
  const recs = priorityRecommendations(data?.recommendations);
  return (
    <div className="card-surface p-5 sm:p-6">
      <h3 className="text-sm font-semibold tracking-tight">Recommended actions</h3>
      {loading ? (
        <div className="mt-4 space-y-3">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : recs.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No prioritized actions for this scan.</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {recs.map((rec, index) => (
            <li key={rec.id} className="rounded-xl border border-border bg-surface px-4 py-3">
              <p className="text-sm font-medium">
                {rec.impact === "high" ? "🔴" : rec.impact === "medium" ? "🟠" : "🟡"} {index + 1}. {rec.title}
              </p>
              {rec.detail && (
                <p className="mt-1 text-xs text-muted-foreground">{rec.detail}</p>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function ScanDetailsAccordion({
  data,
  loading,
  onExportJson,
}: {
  data?: ScanResult;
  loading?: boolean;
  onExportJson?: () => void;
}) {
  const s = data?.summary;
  if (loading) return null;
  return (
    <details className="card-surface p-5 sm:p-6">
      <summary className="cursor-pointer text-sm font-semibold tracking-tight">Scan details</summary>
      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Processing time</dt>
          <dd className="font-medium tabular-nums">
            {s?.processing_time_ms ? `${(s.processing_time_ms / 1000).toFixed(1)}s` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Shelf utilization</dt>
          <dd className="font-medium tabular-nums">
            {s?.share_of_shelf_percent !== undefined ? `${s.share_of_shelf_percent.toFixed(1)}%` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Legacy shelf health</dt>
          <dd className="font-medium tabular-nums">{s?.shelf_health_score ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Scan ID</dt>
          <dd className="font-mono text-xs">{data?.scan_id}</dd>
        </div>
      </dl>
      {onExportJson && (
        <Button variant="subtle" size="sm" className="mt-4 rounded-xl" onClick={onExportJson}>
          Export JSON payload
        </Button>
      )}
    </details>
  );
}

export function ExecutionImprovementBanner({
  current,
  previous,
  loading,
}: {
  current?: number;
  previous?: number;
  loading?: boolean;
}) {
  if (loading || current === undefined || previous === undefined) return null;
  const delta = Math.round(current - previous);
  if (delta === 0) return null;
  return (
    <div className="card-surface flex items-center gap-3 border-brand/20 bg-brand-soft/30 p-4 sm:p-5">
      <TrendingUp className="size-5 shrink-0 text-brand" />
      <div>
        <p className="text-sm font-semibold">Execution improvement</p>
        <p className="text-sm text-muted-foreground">
          {previous} → {current} ({delta > 0 ? "+" : ""}
          {delta} points vs previous scan at this store)
        </p>
      </div>
    </div>
  );
}
