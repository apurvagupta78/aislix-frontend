import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowDown, ArrowUp, IndianRupee, Lock, Minus, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/States";
import { cn } from "@/lib/utils";
import {
  buildActionCenterItems,
  buildAiSummaryParagraph,
  buildAllDemoActions,
  buildDetailedActions,
  buildRoleSummary,
  buildKpiStrip,
  computeRetailExecutionScore,
  executionScore,
  formatLostSales,
  formatScoreDelta,
  formatConfidenceSecondary,
  priorityRecommendations,
  recognitionCoverage,
  resolveFinancialImpact,
  shareOfShelfTopBrand,
  totalActionCount,
  totalFacings,
  type ActionCenterItem,
} from "@/lib/scan-execution";
import type { FinancialImpact } from "@/lib/scan-results";
import { PLAN_TIER_LABELS, planTier } from "@/lib/plan-features";
import type { ScanResult } from "@/lib/scan-results";
import { formatScanDate } from "@/lib/scan-results";
import { formatCompetitorBrandLabel, type CompetitorSnapshot } from "@/lib/brand-intel";
import {
  allowedViewModes,
  VIEW_MODE_DESCRIPTIONS,
  VIEW_MODE_LABELS,
  VIEW_MODE_THEME,
  type ResultViewMode,
  type RoleFamily,
} from "@/lib/customer-context";
import { formatInr } from "@/lib/pricing";

const severityStyles: Record<ActionCenterItem["severity"], string> = {
  critical: "text-destructive",
  high: "text-warning",
  medium: "text-warning",
  low: "text-muted-foreground",
};

const severityDot: Record<ActionCenterItem["severity"], string> = {
  critical: "bg-destructive",
  high: "bg-warning",
  medium: "bg-warning",
  low: "bg-muted-foreground",
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
  const scoreDetail = computeRetailExecutionScore(data);
  const delta = formatScoreDelta(score, previousScore);
  const rising = score !== undefined && previousScore !== undefined && score > previousScore;
  const notScoreable = score === undefined || scoreDetail.overall == null;
  const facings = totalFacings(data);
  const recognized =
    facings > 0 && recognitionCoverage(data) !== undefined
      ? Math.round((facings * (recognitionCoverage(data) ?? 0)) / 100)
      : undefined;

  return (
    <div className="card-surface p-5 sm:p-6">
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
        Retail execution score
      </p>
      {loading ? (
        <Skeleton className="mt-3 h-12 w-32" />
      ) : notScoreable ? (
        <div className="mt-2">
          <p className="text-2xl font-semibold tracking-tight text-muted-foreground">Not scoreable</p>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            {scoreDetail.withhold_reason ??
              "Configure planogram facings, placement rules, or target assortment to compute a defensible execution score."}
          </p>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap items-end gap-3">
          <p className="text-5xl font-semibold tabular-nums tracking-tight">
            {score}
            <span className="text-2xl font-normal text-muted-foreground"> / 100</span>
          </p>
          {delta && (
            <span
              className={cn(
                "inline-flex items-center gap-1 text-sm font-medium",
                rising ? "text-accent-green" : score === previousScore ? "text-muted-foreground" : "text-warning",
              )}
            >
              {rising ? <ArrowUp className="size-4" /> : score === previousScore ? <Minus className="size-4" /> : <ArrowDown className="size-4" />}
              {delta}
            </span>
          )}
        </div>
      )}
      {!loading && scoreDetail.components.length > 0 && (
        <ScoreBreakdownPanel scoreDetail={scoreDetail} showOverall={!notScoreable} />
      )}
      {!loading && recognitionCoverage(data) !== undefined && (
        <p className="mt-3 text-sm text-muted-foreground">
          Recognition coverage: <strong>{recognitionCoverage(data)}%</strong>
          {recognized !== undefined && facings > 0 && (
            <span className="text-xs"> ({recognized}/{facings} facings confidently recognized)</span>
          )}
          {data?.summary?.average_confidence !== undefined && (
            <span className="ml-2 text-xs">
              · Detection confidence: {formatConfidenceSecondary(data.summary.average_confidence)}
            </span>
          )}
        </p>
      )}
    </div>
  );
}

function ScoreBreakdownPanel({
  scoreDetail,
  showOverall,
}: {
  scoreDetail: ReturnType<typeof computeRetailExecutionScore>;
  showOverall: boolean;
}) {
  const [open, setOpen] = useState(false);
  const scorable = scoreDetail.components.filter((c) => c.score !== null);
  const totalWeight = scorable.reduce((n, c) => n + (c.weight ?? 0), 0);

  return (
    <div className="mt-3">
      {scoreDetail.withhold_reason && (
        <p className="text-xs text-muted-foreground">{scoreDetail.withhold_reason}</p>
      )}
      <button
        type="button"
        className="mt-2 text-xs font-medium text-brand underline-offset-2 hover:underline"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Hide score breakdown" : "View score breakdown"}
      </button>
      {open && (
        <div className="mt-3 overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[28rem] text-left text-xs">
            <thead>
              <tr className="border-b border-border bg-surface text-muted-foreground">
                <th className="px-3 py-2 font-medium">KPI</th>
                <th className="px-3 py-2 font-medium text-right">Result</th>
                <th className="px-3 py-2 font-medium text-right">Weight</th>
                {showOverall && <th className="px-3 py-2 font-medium text-right">Contribution</th>}
                <th className="px-3 py-2 font-medium">State</th>
              </tr>
            </thead>
            <tbody>
              {scoreDetail.components.map((row) => {
                const contribution =
                  showOverall &&
                  row.score !== null &&
                  totalWeight > 0 &&
                  (row.state === "available" || row.state === "estimated" || row.state === "calculated")
                    ? Math.round((row.score * (row.weight ?? 0)) / totalWeight)
                    : null;
                return (
                  <tr key={row.key} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2 font-medium">{row.label}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {row.score !== null ? `${Math.round(row.score)}%` : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.weight ?? "—"}%</td>
                    {showOverall && (
                      <td className="px-3 py-2 text-right tabular-nums">
                        {contribution !== null ? contribution : "—"}
                      </td>
                    )}
                    <td className="px-3 py-2 capitalize text-muted-foreground">{row.state.replace(/_/g, " ")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function ExecutionKpiStripPanel({
  data,
  loading,
  compact = false,
}: {
  data?: ScanResult;
  loading?: boolean;
  /** Narrow columns (demo panel) — 2-up grid instead of 5. */
  compact?: boolean;
}) {
  const kpis = buildKpiStrip(data);
  const gridCols =
    kpis.length >= 6
      ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6"
      : kpis.length === 4
        ? "grid-cols-2 sm:grid-cols-4"
        : compact
          ? "grid-cols-2 sm:grid-cols-3"
          : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5";
  return (
    <div className={cn("grid gap-2", gridCols)}>
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

const DEMO_ACTION_PREVIEW = 5;

export function ActionCenterPanel({
  data,
  loading,
  view,
  demoMode = false,
}: {
  data?: ScanResult;
  loading?: boolean;
  view?: ResultViewMode;
  /** Guest demo — expand actions inline instead of linking to login. */
  demoMode?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const items = buildActionCenterItems(data);
  const detailed = demoMode ? buildAllDemoActions(data, view) : buildDetailedActions(data, view);
  const issueCount = demoMode ? detailed.length : Math.max(totalActionCount(items), detailed.length);
  const previewCount = demoMode ? (expanded ? detailed.length : DEMO_ACTION_PREVIEW) : 8;
  const visibleActions = detailed.slice(0, previewCount);

  return (
    <div className="card-surface p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">
            {issueCount > 0
              ? `${issueCount} issue${issueCount === 1 ? "" : "s"} require action`
              : "No critical issues detected"}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Next-best actions from availability, placement, and planogram compliance
          </p>
        </div>
        {issueCount > 0 && (
          <Badge variant="outline" className="rounded-full border-warning/40 text-warning">
            <AlertTriangle className="mr-1 size-3" /> Action required
          </Badge>
        )}
      </div>
      {loading ? (
        <div className="mt-4 space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : visibleActions.length > 0 ? (
        <>
        <ol className="mt-4 space-y-3">
          {visibleActions.map((action, index) => (
            <li
              key={action.action_id}
              className="rounded-xl border border-border bg-surface px-4 py-3"
            >
              <p className="flex items-center gap-2 text-sm font-medium">
                <span
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    severityDot[action.priority === "critical" ? "critical" : action.priority],
                  )}
                />
                {index + 1}. {action.title}
              </p>
              {action.reason ? (
                <p className="mt-1 text-xs text-muted-foreground">{action.reason}</p>
              ) : null}
              {(action.expected_state || action.actual_state) && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Expected: {action.expected_state ?? "—"} · Actual: {action.actual_state ?? "—"}
                </p>
              )}
              {action.estimated_daily_impact_inr ? (
                <p className="mt-1 text-xs font-medium text-warning">
                  Est. opportunity: {formatInr(action.estimated_daily_impact_inr)}/day
                </p>
              ) : null}
              <p className="mt-1 text-xs font-medium text-foreground">
                → {action.recommended_action}
              </p>
            </li>
          ))}
        </ol>
        {demoMode && detailed.length > DEMO_ACTION_PREVIEW ? (
          <Button
            variant="subtle"
            size="sm"
            className="mt-4 rounded-xl"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "Show fewer actions" : `View all ${detailed.length} actions`}
          </Button>
        ) : !demoMode && detailed.length > 8 ? (
          <Button asChild variant="subtle" size="sm" className="mt-4 rounded-xl">
            <Link to="/corrective-actions">View all actions</Link>
          </Button>
        ) : null}
        </>
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
                <p className={cn("flex items-center gap-2 text-sm font-medium", severityStyles[item.severity])}>
                  <span className={cn("size-2 shrink-0 rounded-full", severityDot[item.severity])} />
                  {item.count} {item.label}
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

export function AiSummaryBlock({
  data,
  loading,
  view,
}: {
  data?: ScanResult;
  loading?: boolean;
  view?: import("@/lib/customer-context").ResultViewMode;
}) {
  const text = view ? buildRoleSummary(data, view) : buildAiSummaryParagraph(data);
  const hero =
    view === "executive"
      ? "Executive summary"
      : view
        ? VIEW_MODE_DESCRIPTIONS[view]
        : "Retail execution summary";
  return (
    <div className="card-surface p-5 sm:p-6">
      <h3
        className={cn(
          "font-semibold tracking-tight",
          view === "executive" ? "text-base sm:text-lg" : "text-sm",
        )}
      >
        {hero}
      </h3>
      {loading ? (
        <div className="mt-3 space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
        </div>
      ) : (
        <p
          className={cn(
            "text-sm leading-relaxed text-muted-foreground",
            view === "executive" ? "mt-4 space-y-3" : "mt-3",
          )}
        >
          {text || "Summary unavailable."}
        </p>
      )}
    </div>
  );
}

export function ResultViewSwitcher({
  value,
  onChange,
  roleFamily,
  customerType,
}: {
  value: ResultViewMode;
  onChange: (mode: ResultViewMode) => void;
  roleFamily?: RoleFamily;
  customerType?: import("@/lib/customer-context").CustomerType;
  /** @deprecated — tabs always wrap for readability */
  compact?: boolean;
}) {
  const allModes: ResultViewMode[] = ["execution", "merchandising", "brand", "executive"];
  const modes = roleFamily ? allowedViewModes(roleFamily, customerType) : allModes;
  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Result view">
      {modes.map((mode) => {
        const theme = VIEW_MODE_THEME[mode];
        const active = value === mode;
        return (
          <button
            key={mode}
            type="button"
            role="tab"
            aria-selected={active}
            className={cn(
              "rounded-xl px-3 py-1.5 text-xs font-medium transition-colors sm:px-3.5 sm:py-2 sm:text-sm",
              active ? theme.tabActive : theme.tabInactive,
            )}
            onClick={() => onChange(mode)}
          >
            {VIEW_MODE_LABELS[mode]}
          </button>
        );
      })}
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
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-brand/20 bg-brand-soft/30 px-4 py-3">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Share of facings</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {snapshot.primary_brand}{" "}
                <span className="text-lg text-muted-foreground">
                  {snapshot.own_brand_share_percent.toFixed(1)}%
                </span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">All {snapshot.primary_brand} SKUs on shelf</p>
            </div>
            {snapshot.product_share_percent !== undefined && snapshot.product_label ? (
              <div className="rounded-xl border border-border bg-surface px-4 py-3">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Product share</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {snapshot.product_label}{" "}
                  <span className="text-lg text-muted-foreground">
                    {snapshot.product_share_percent.toFixed(1)}%
                  </span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">This SKU only — not all brand variants</p>
              </div>
            ) : null}
          </div>
          {snapshot.upper_hand?.length ? (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-widest text-brand">
                Where competitors lead
              </p>
              {snapshot.upper_hand.map((edge) => (
                <div
                  key={edge.brand}
                  className="rounded-xl border border-brand/15 bg-brand-soft/30 px-4 py-3 text-sm"
                >
                  <p className="font-medium">
                    {formatCompetitorBrandLabel(edge.brand, edge.different_category)}{" "}
                    <span className="tabular-nums text-muted-foreground">{edge.share.toFixed(1)}% share</span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{edge.note}</p>
                </div>
              ))}
            </div>
          ) : null}
          <ul className="space-y-2">
            {snapshot.competitor_shares
              .filter((row) => !row.is_primary)
              .map((row) => (
                <li
                  key={row.brand}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm"
                >
                  <span className="font-medium">
                    {formatCompetitorBrandLabel(row.brand, row.different_category)}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {row.share > 0 ? `${row.share.toFixed(1)}%` : "Not detected"}
                  </span>
                </li>
              ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            {snapshot.competitors_detected} of {snapshot.competitors_configured} tracked competitors
            detected on shelf
          </p>
          {snapshot.unclassified_facings ? (
            <p className="text-xs text-muted-foreground">
              Unclassified: {snapshot.unclassified_facings} facing
              {snapshot.unclassified_facings === 1 ? "" : "s"}
              {snapshot.unclassified_share_percent !== undefined
                ? ` (${snapshot.unclassified_share_percent}% of category facings)`
                : ""}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function ShareOfShelfPanel({ data, loading }: { data?: ScanResult; loading?: boolean }) {
  const brands = data?.charts?.top_brands ?? [];
  const topShare = shareOfShelfTopBrand(data);
  const s = data?.summary;
  const brandShare = s?.brand_share_percent;
  const productShare = s?.product_share_percent;

  return (
    <div className="card-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold tracking-tight">Share of facings</h3>
        <div className="flex flex-wrap gap-2">
          {brandShare !== undefined && (
            <Badge className="rounded-full bg-brand-soft text-brand hover:bg-brand-soft">
              {brandShare.toFixed(1)}% of facings
            </Badge>
          )}
          {productShare !== undefined && s?.product_share_label && (
            <Badge variant="secondary" className="rounded-full tabular-nums">
              {s.product_share_label} {productShare.toFixed(1)}%
            </Badge>
          )}
          {brandShare === undefined && topShare !== undefined && (
            <Badge className="rounded-full bg-brand-soft text-brand hover:bg-brand-soft">
              Top brand {topShare.toFixed(0)}%
            </Badge>
          )}
        </div>
      </div>
      {(brandShare !== undefined || productShare !== undefined) && (
        <p className="mt-2 text-xs text-muted-foreground">
          Share of facings counts every facing for that brand vs total category facings. Product share counts only the planogram SKU
          (e.g. Colgate Max Fresh), not other Colgate variants.
        </p>
      )}
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
  const summary = data?.planogram?.summary as
    | { expected_sku_count?: number; missing?: number; correct?: number }
    | undefined;
  const planExpected = summary?.expected_sku_count ?? expected ?? 0;
  const planMissing = summary?.missing;
  const targetDetected =
    matched ??
    (planMissing !== undefined ? Math.max(0, planExpected - planMissing) : summary?.correct ?? null);
  const hasTargetAssortment = planExpected > 0;
  const targetPct =
    hasTargetAssortment && targetDetected !== null
      ? Math.round((targetDetected / planExpected) * 100)
      : null;

  const categoryOsaConfigured =
    (data?.retail_intelligence?.assortment as { state?: string } | undefined)?.state === "available";
  const categoryPct = data?.summary?.availability_percent ?? data?.summary?.osa_percent;

  return (
    <div className="card-surface p-5 sm:p-6">
      <h3 className="text-sm font-semibold tracking-tight">Availability</h3>
      {loading ? (
        <Skeleton className="mt-3 h-8 w-40" />
      ) : !hasTargetAssortment ? (
        <div className="mt-3">
          <p className="text-sm text-muted-foreground">
            Upload or assign a planogram to measure target SKU availability.
          </p>
          <Button asChild variant="subtle" size="sm" className="mt-3 rounded-xl">
            <Link to="/planogram-management">Configure planogram</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-surface px-4 py-3">
            <p className="text-[0.65rem] font-medium uppercase tracking-widest text-muted-foreground">
              Target SKU availability
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {targetDetected ?? 0}/{planExpected}
            </p>
            {targetPct !== null && (
              <p className="mt-1 text-sm text-muted-foreground">{targetPct}% of configured target SKUs detected</p>
            )}
          </div>
          <div className="rounded-xl border border-border bg-surface px-4 py-3">
            <p className="text-[0.65rem] font-medium uppercase tracking-widest text-muted-foreground">
              Category OSA
            </p>
            {categoryOsaConfigured && categoryPct !== undefined ? (
              <>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{Math.round(categoryPct)}%</p>
                <p className="mt-1 text-sm text-muted-foreground">Full category assortment configured</p>
              </>
            ) : (
              <>
                <p className="mt-1 text-lg font-semibold text-muted-foreground">Not configured</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Configure the complete category assortment to measure category OSA.
                </p>
              </>
            )}
          </div>
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
              <p className="flex items-center gap-2 text-sm font-medium">
                <span
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    rec.impact === "high"
                      ? "bg-destructive"
                      : rec.impact === "medium"
                        ? "bg-warning"
                        : "bg-muted-foreground",
                  )}
                />
                {index + 1}. {rec.title}
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

export function FinancialImpactPanel({
  data,
  loading,
  locked = false,
  planCode,
}: {
  data?: ScanResult;
  loading?: boolean;
  locked?: boolean;
  planCode?: string | null;
}) {
  const impact = resolveFinancialImpact(data);
  const tier = planTier(planCode);

  if (loading) {
    return (
      <div className="card-surface p-5 sm:p-6">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="mt-4 h-16 w-full" />
      </div>
    );
  }

  const body = impact ? (
    <FinancialImpactBody impact={impact} competitorIntel={data?.competitor_intel} />
  ) : (
    <p className="mt-3 text-sm text-muted-foreground">No revenue-at-risk signals for this scan.</p>
  );

  return (
    <div className="card-surface relative overflow-hidden p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            <IndianRupee className="size-3.5" /> Financial impact
          </p>
          <h3 className="mt-1 text-sm font-semibold tracking-tight">Revenue at risk</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Commercial impact from OOS, low stock, and facing gaps
          </p>
        </div>
        <Badge variant="outline" className="rounded-full capitalize">
          {PLAN_TIER_LABELS[tier]} plan
        </Badge>
      </div>

      <div className={cn("mt-4", locked && "select-none blur-sm")}>{body}</div>

      {locked && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/70 px-6 text-center backdrop-blur-[2px]">
          <Lock className="size-5 text-muted-foreground" />
          <p className="text-sm font-medium">Financial impact is available on Pro plans</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Upgrade to Growth or Professional to see daily, weekly, and monthly lost-sales estimates.
          </p>
          <Button asChild variant="brand" size="sm" className="rounded-xl">
            <Link to="/pricing">View plans</Link>
          </Button>
        </div>
      )}
    </div>
  );
}

function FinancialImpactBody({
  impact,
  competitorIntel,
}: {
  impact: FinancialImpact;
  competitorIntel?: CompetitorSnapshot | null;
}) {
  const level = impact.level ?? (impact.estimated_daily_lost_sales_inr > 0 ? 2 : 1);
  const hasRupeeEstimate = level >= 2 && impact.estimated_daily_lost_sales_inr > 0;
  const riskLabel =
    impact.commercial_risk === "critical"
      ? "Critical"
      : impact.commercial_risk === "high"
        ? "High"
        : impact.commercial_risk === "medium"
          ? "Medium"
          : "Low";

  return (
    <>
      {level === 1 ? (
        <div className="rounded-xl border border-border bg-surface px-4 py-3">
          <p className="text-[0.65rem] font-medium uppercase tracking-widest text-muted-foreground">
            Commercial risk
          </p>
          <p className="mt-1 text-xl font-semibold capitalize text-brand">{riskLabel}</p>
          <p className="mt-2 text-xs text-muted-foreground">{impact.methodology}</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: "Daily exposure", value: impact.estimated_daily_lost_sales_inr },
            { label: "Weekly run-rate", value: impact.estimated_weekly_lost_sales_inr },
            { label: "30-day run-rate", value: impact.estimated_monthly_lost_sales_inr },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl border border-border bg-surface px-4 py-3">
              <p className="text-[0.65rem] font-medium uppercase tracking-widest text-muted-foreground">
                {label}
              </p>
              <p
                className={cn(
                  "mt-1 text-xl font-semibold tabular-nums",
                  hasRupeeEstimate ? "text-destructive" : "text-accent-green",
                )}
              >
                {formatLostSales(value)}
              </p>
            </div>
          ))}
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <p>
          <span className="text-muted-foreground">OOS SKUs:</span>{" "}
          <span className="font-semibold tabular-nums">{impact.oos_sku_count}</span>
        </p>
        <p>
          <span className="text-muted-foreground">At-risk SKUs:</span>{" "}
          <span className="font-semibold tabular-nums">{impact.at_risk_sku_count}</span>
        </p>
      </div>
      {competitorIntel?.upper_hand?.length ? (
        <div className="mt-4 space-y-2 border-t border-border pt-4">
          <p className="text-xs font-medium uppercase tracking-widest text-brand">Competitor edge</p>
          {competitorIntel.upper_hand.map((edge) => (
            <div
              key={edge.brand}
              className="rounded-xl border border-brand/15 bg-brand-soft/25 px-4 py-3 text-sm"
            >
              <p className="font-medium">
                {formatCompetitorBrandLabel(edge.brand, edge.different_category)}{" "}
                <span className="tabular-nums text-muted-foreground">{edge.share.toFixed(1)}% share</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{edge.note}</p>
            </div>
          ))}
        </div>
      ) : null}
      {level >= 2 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          {impact.methodology}
          {impact.source ? ` Source: ${impact.source.replace(/_/g, " ")}.` : ""}
          {impact.assumption ? ` Assumption: ${impact.assumption}.` : ""}
        </p>
      ) : null}
    </>
  );
}

/** Compact financial strip for landing demo — matches /results styling. */
export function DemoFinancialImpactStrip({
  impact,
  className,
}: {
  impact: FinancialImpact;
  className?: string;
}) {
  const level = impact.level ?? (impact.estimated_daily_lost_sales_inr > 0 ? 2 : 1);
  const hasRisk = level >= 2 && impact.estimated_daily_lost_sales_inr > 0;
  return (
    <div className={cn("rounded-xl border border-border bg-surface p-4", className)}>
      <p className="text-[0.65rem] font-medium uppercase tracking-widest text-muted-foreground">
        {level === 1 ? "Commercial risk" : "Revenue at risk (daily)"}
      </p>
      <p
        className={cn(
          "mt-1 text-2xl font-semibold tabular-nums",
          hasRisk ? "text-destructive" : "text-accent-green",
        )}
      >
        {level === 1
          ? (impact.commercial_risk ?? "low").charAt(0).toUpperCase() +
            (impact.commercial_risk ?? "low").slice(1)
          : formatLostSales(impact.estimated_daily_lost_sales_inr)}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        {impact.oos_sku_count} OOS · {impact.at_risk_sku_count} at-risk SKUs
      </p>
    </div>
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
