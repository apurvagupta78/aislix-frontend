import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowRight,
  Download,
  IndianRupee,
  Lock,
  Minus,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/States";
import { cn } from "@/lib/utils";
import type { CustomerType } from "@/lib/customer-context";
import { auditKpiDashboardFromResult } from "@/lib/execution-metrics";
import {
  buildActionCenterItems,
  buildAiSummaryParagraph,
  buildAllDemoActions,
  buildDetailedActions,
  buildRoleSummary,
  executiveRollupSections,
  buildKpiStrip,
  computeRetailExecutionScore,
  executionScore,
  formatLostSales,
  formatScoreDelta,
  formatConfidenceSecondary,
  recognitionCoverage,
  resolveFinancialImpact,
  shareOfShelfTopBrand,
  totalActionCount,
  totalFacings,
  type ActionCenterItem,
} from "@/lib/scan-execution";
import type { FinancialImpact } from "@/lib/scan-results";
import type { ScanResult } from "@/lib/scan-results";
import { formatCompetitorBrandLabel, type CompetitorSnapshot } from "@/lib/brand-intel";
import {
  allowedViewModes,
  VIEW_MODE_DESCRIPTIONS,
  VIEW_MODE_LABELS,
  VIEW_MODE_THEME,
  type ResultViewMode,
  type RoleFamily,
} from "@/lib/customer-context";
import {
  KPI_STRIP_INTRO,
  kpiPlainEnglish,
  type AuditRoleTab,
} from "@/lib/role-audit-ui";
import { KpiResultCard } from "@/components/scan-results/KpiResultCard";
import { enrichKpiMetrics, scoringFromResult } from "@/lib/kpi-results-display";
import {
  buildAuditHeaderId,
  buildAuditHeaderMeta,
  buildAuditHeaderPrimary,
} from "@/lib/audit-results-display";
import { formatInr } from "@/lib/pricing";
import {
  buildCommercialImpactView,
  type CommercialImpactView,
} from "@/lib/commercial-impact-display";
import { downloadCommercialImpactCsv } from "@/lib/commercial-impact-export";
import {
  buildIssueTypeCounts,
  buildPrioritySummary,
  buildRecommendedActionCards,
  scrollToActionEvidence,
  type ActionPriority,
} from "@/lib/recommended-actions-display";
import { downloadRecommendedActionsCsv } from "@/lib/recommended-actions-export";

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
  activeRole,
  demoMode = false,
}: {
  data?: ScanResult;
  loading?: boolean;
  activeRole?: AuditRoleTab;
  demoMode?: boolean;
}) {
  if (loading) {
    return (
      <div className="card-surface p-5">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>
    );
  }
  const primary = buildAuditHeaderPrimary(data);
  const meta = buildAuditHeaderMeta(data, { demoMode, activeRole });
  const auditId = buildAuditHeaderId(data);
  return (
    <div className="card-surface p-5 sm:p-6">
      <p className="text-xs font-medium uppercase tracking-widest text-brand">AI shelf audit</p>
      <h2 className="mt-2 text-lg font-semibold tracking-tight sm:text-xl">{primary}</h2>
      {meta ? <p className="mt-1 text-sm text-muted-foreground">{meta}</p> : null}
      {auditId ? <p className="mt-1 text-[11px] text-muted-foreground/80">{auditId}</p> : null}
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

export function AuditRoleIntroPanel({ data, loading }: { data?: ScanResult; loading?: boolean }) {
  const dashboard = auditKpiDashboardFromResult(data);
  if (!dashboard?.introduction) return null;
  return (
    <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
      <p className="font-medium text-foreground">{dashboard.role_label} audit</p>
      {loading ? (
        <Skeleton className="mt-2 h-4 w-full max-w-xl" />
      ) : (
        <p className="mt-1 leading-relaxed">{dashboard.introduction}</p>
      )}
    </div>
  );
}

function scrollToKpiEvidence(kpiKey: string) {
  document.getElementById(`kpi-evidence-${kpiKey}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function ExecutionKpiStripPanel({
  data,
  loading,
  compact = false,
  customerType,
  showIntro = false,
}: {
  data?: ScanResult;
  loading?: boolean;
  compact?: boolean;
  view?: ResultViewMode;
  customerType?: CustomerType | string | null;
  showIntro?: boolean;
}) {
  const rawKpis = buildKpiStrip(data, customerType);
  const scoring = scoringFromResult(data);
  const kpis = enrichKpiMetrics(rawKpis, scoring, (key) => kpiPlainEnglish(key) ?? undefined);
  const brandLabel =
    data?.retail_intelligence?.audit_package?.primary_brand ??
    data?.competitor_intel?.primary_brand ??
    undefined;
  const gridCols = compact
    ? "grid-cols-2 sm:grid-cols-3"
    : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5";
  return (
    <div className="rounded-xl border border-border/70 bg-muted/30 px-4 py-4 sm:px-5 sm:py-5">
      <div className="space-y-3">
        {showIntro ? (
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-foreground/70">
              {KPI_STRIP_INTRO.eyebrow}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {KPI_STRIP_INTRO.description}
            </p>
          </div>
        ) : null}
        <div className={cn("grid gap-3", gridCols)}>
          {kpis.map((kpi) => (
            <KpiResultCard
              key={kpi.key}
              kpi={kpi}
              loading={loading}
              brandLabel={brandLabel}
              onClick={() => scrollToKpiEvidence(kpi.key)}
            />
          ))}
        </div>
      </div>
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
  const hero =
    view === "executive"
      ? "Executive summary"
      : view
        ? VIEW_MODE_DESCRIPTIONS[view]
        : "Retail execution summary";
  const rollup = view === "executive" ? executiveRollupSections(data) : [];
  const text =
    view && view !== "executive" ? buildRoleSummary(data, view) : buildAiSummaryParagraph(data);
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
      ) : view === "executive" && rollup.length > 0 ? (
        <div className="mt-4 space-y-4">
          {rollup.map((section) => (
            <div key={section.key}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {section.label}
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{section.text}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
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
  const allModes: ResultViewMode[] = ["execution", "exceptions", "merchandising", "brand", "executive"];
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
            {snapshot.competitors_tracked_configured
              ? `${snapshot.competitors_detected} of ${snapshot.competitors_configured} tracked competitors detected on shelf`
              : `${snapshot.competitors_detected} other observed brand${snapshot.competitors_detected === 1 ? "" : "s"} on shelf (no competitor set configured)`}
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

const ACTION_PRIORITY_PILL: Record<ActionPriority, string> = {
  high: "border-destructive/30 bg-destructive/10 text-destructive",
  medium: "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200",
  low: "border-brand/25 bg-brand-soft text-brand",
};

const ACTION_PRIORITY_ACCENT: Record<ActionPriority, string> = {
  high: "border-l-destructive",
  medium: "border-l-amber-500",
  low: "border-l-brand",
};

function PriorityOverviewBar({ summary }: { summary: ReturnType<typeof buildPrioritySummary> }) {
  const total = summary.high + summary.medium + summary.low || 1;
  const segments = [
    { key: "high", count: summary.high, className: "bg-destructive", label: "High" },
    { key: "medium", count: summary.medium, className: "bg-amber-500", label: "Medium" },
    { key: "low", count: summary.low, className: "bg-brand", label: "Low" },
  ];
  return (
    <div className="rounded-xl border border-border/70 bg-background px-4 py-3">
      <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-foreground/70">
        Priority overview
      </p>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {segments.map(({ label, count }) => (
          <span key={label}>
            <span className="font-semibold tabular-nums">{count}</span>{" "}
            <span className="text-muted-foreground">{label}</span>
          </span>
        ))}
      </div>
      <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-muted">
        {segments.map(({ key, count, className }) =>
          count > 0 ? (
            <div
              key={key}
              className={cn("h-full", className)}
              style={{ width: `${(count / total) * 100}%` }}
            />
          ) : null,
        )}
      </div>
    </div>
  );
}

function IssueTypeBar({ counts }: { counts: ReturnType<typeof buildIssueTypeCounts> }) {
  if (counts.length < 2) return null;
  const max = Math.max(...counts.map((c) => c.count), 1);
  return (
    <div className="rounded-xl border border-border/70 bg-background px-4 py-3">
      <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-foreground/70">
        Issues by type
      </p>
      <ul className="mt-2 space-y-1.5">
        {counts.slice(0, 5).map((item) => (
          <li key={item.issue_type}>
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="truncate text-muted-foreground">{item.issue_type}</span>
              <span className="shrink-0 tabular-nums font-medium">{item.count}</span>
            </div>
            <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full", item.bar_class)}
                style={{ width: `${(item.count / max) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RecommendedActionsPanel({ data, loading }: { data?: ScanResult; loading?: boolean }) {
  const cards = data ? buildRecommendedActionCards(data) : [];
  const summary = buildPrioritySummary(cards);
  const issueTypes = buildIssueTypeCounts(cards);

  return (
    <section className="rounded-xl border border-border/70 bg-muted/30 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[0.65rem] font-semibold uppercase tracking-wide text-foreground/70">
            What to fix next
          </h3>
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted-foreground">
            Aislix prioritises the shelf issues that need attention, so your team knows what to fix
            first.
          </p>
        </div>
        {data ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8 shrink-0 rounded-lg"
            title="Download Action List"
            aria-label="Download Action List"
            onClick={() => downloadRecommendedActionsCsv(data)}
            disabled={cards.length === 0}
          >
            <Download className="size-3.5" />
          </Button>
        ) : null}
      </div>

      {loading ? (
        <div className="mt-4 space-y-3">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : cards.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No prioritized actions for this scan.</p>
      ) : (
        <div className="mt-4 space-y-4">
          <PriorityOverviewBar summary={summary} />
          <IssueTypeBar counts={issueTypes} />
          <ol className="space-y-3">
            {cards.map((card) => {
              const contextLine = [
                card.expected_value && card.observed_value
                  ? `Expected ${card.expected_value} · Observed ${card.observed_value}`
                  : card.expected_value
                    ? `Expected ${card.expected_value}`
                    : card.observed_value
                      ? `Observed ${card.observed_value}`
                      : null,
                card.shelf ? card.shelf : null,
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <li
                  key={card.id}
                  className={cn(
                    "rounded-xl border border-border/70 border-l-[3px] bg-background px-4 py-3",
                    ACTION_PRIORITY_ACCENT[card.priority],
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold tracking-tight">{card.title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            "rounded-full text-[10px] capitalize",
                            ACTION_PRIORITY_PILL[card.priority],
                          )}
                        >
                          {card.priority} priority
                        </Badge>
                        <span className="text-[11px] text-muted-foreground">{card.issue_type}</span>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 shrink-0 rounded-lg text-xs text-brand hover:text-brand"
                      onClick={() => scrollToActionEvidence(card.evidence_target)}
                    >
                      {card.evidence_label} <ArrowRight className="ml-1 size-3.5" />
                    </Button>
                  </div>
                  {contextLine ? (
                    <p className="mt-2 text-xs font-medium text-foreground">{contextLine}</p>
                  ) : null}
                  {card.explanation ? (
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {card.explanation}
                    </p>
                  ) : null}
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    → {card.recommended_action}
                  </p>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </section>
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
  const view = data ? buildCommercialImpactView(data) : null;
  const impact = view?.impact ?? resolveFinancialImpact(data);

  if (loading) {
    return (
      <div className="rounded-xl border border-border/70 bg-muted/30 p-5 sm:p-6">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="mt-4 h-16 w-full" />
      </div>
    );
  }

  const body = impact ? (
    <FinancialImpactBody impact={impact} view={view} data={data} />
  ) : (
    <p className="mt-3 text-sm text-muted-foreground">
      No commercial exposure signals for this scan.
    </p>
  );

  return (
    <div className="relative overflow-hidden rounded-xl border border-border/70 bg-muted/30 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-wide text-foreground/70">
            <IndianRupee className="size-3.5" /> Commercial impact
          </p>
          <h3 className="mt-1 text-base font-semibold tracking-tight sm:text-lg">
            See the Potential Impact of Shelf Issues.
          </h3>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
            Estimate the potential commercial exposure from visible availability, stock and facing
            issues using the business inputs you provide.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Badge variant="outline" className="rounded-full text-[10px] uppercase tracking-wide">
            PRO FEATURE
          </Badge>
          {data && impact ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8 rounded-lg"
              title="Download Commercial Impact Data"
              aria-label="Download Commercial Impact Data"
              onClick={() => downloadCommercialImpactCsv(data)}
            >
              <Download className="size-3.5" />
            </Button>
          ) : null}
        </div>
      </div>

      <div className={cn("mt-4", locked && "select-none blur-sm")}>{body}</div>

      {locked && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/70 px-6 text-center backdrop-blur-[2px]">
          <Lock className="size-5 text-muted-foreground" />
          <p className="text-sm font-medium">Commercial impact is available on Pro plans</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Upgrade to Growth or Professional to see illustrative exposure estimates.
          </p>
          <Button asChild variant="brand" size="sm" className="rounded-xl">
            <Link to="/pricing">View plans</Link>
          </Button>
        </div>
      )}
    </div>
  );
}

function ExposureProgressionBar({ daily, weekly, monthly }: { daily: number; weekly: number; monthly: number }) {
  const total = daily + weekly + monthly || 1;
  const segments = [
    { label: "Daily", value: daily, className: "bg-brand" },
    { label: "7 Days", value: weekly, className: "bg-brand/70" },
    { label: "30 Days", value: monthly, className: "bg-brand/45" },
  ];
  return (
    <div className="space-y-2">
      <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
        {segments.map(({ label, value, className }) => (
          <div
            key={label}
            className={cn("h-full transition-all", className)}
            style={{ width: `${Math.max((value / total) * 100, value > 0 ? 4 : 0)}%` }}
            title={`${label}: ${formatLostSales(value)}`}
          />
        ))}
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>Daily</span>
        <span aria-hidden>→</span>
        <span>7 Days</span>
        <span aria-hidden>→</span>
        <span>30 Days</span>
      </div>
    </div>
  );
}

function SkuExposureChart({ rows }: { rows: CommercialImpactView["sku_rows"] }) {
  if (!rows.length) return null;
  const maxDaily = Math.max(...rows.map((r) => r.daily_loss_inr), 1);
  return (
    <div className="rounded-xl border border-border/70 bg-background px-4 py-3">
      <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-foreground/70">
        Estimated exposure by SKU
      </p>
      <ul className="mt-3 space-y-2.5">
        {rows.slice(0, 8).map((row) => {
          const pct = Math.max((row.daily_loss_inr / maxDaily) * 100, row.daily_loss_inr > 0 ? 6 : 0);
          return (
            <li key={`${row.brand}|${row.product}|${row.issue_type}`}>
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="truncate font-medium text-foreground">{row.product || row.label}</span>
                <span className="shrink-0 tabular-nums font-semibold text-brand">
                  {formatLostSales(row.daily_loss_inr)}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function FinancialImpactBody({
  impact,
  view,
  data: _data,
}: {
  impact: FinancialImpact;
  view: CommercialImpactView | null;
  data?: ScanResult;
}) {
  const level = impact.level ?? (impact.estimated_daily_lost_sales_inr > 0 ? 2 : 1);
  const daily = view?.daily ?? impact.estimated_daily_lost_sales_inr;
  const weekly = view?.weekly ?? impact.estimated_weekly_lost_sales_inr;
  const monthly = view?.monthly ?? impact.estimated_monthly_lost_sales_inr;
  const skuRows = view?.sku_rows ?? [];
  const estimateStatus = view?.estimate_status ?? "Illustrative";
  const showExposure = level >= 2;

  const riskLabel =
    impact.commercial_risk === "critical"
      ? "Critical"
      : impact.commercial_risk === "high"
        ? "High"
        : impact.commercial_risk === "medium"
          ? "Medium"
          : "Low";

  const exposureMetrics = [
    {
      label: "Daily exposure",
      value: daily,
      support: "Estimated daily exposure",
      status: "Estimated" as const,
    },
    {
      label: "7-day exposure",
      value: weekly,
      support: "Illustrative weekly run-rate",
      status: "Illustrative" as const,
    },
    {
      label: "30-day exposure",
      value: monthly,
      support: "Illustrative monthly run-rate",
      status: "Illustrative" as const,
    },
  ];

  return (
    <div className="space-y-4">
      {showExposure ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {exposureMetrics.map(({ label, value, support, status }) => (
              <div
                key={label}
                className="rounded-xl border border-border/70 bg-background px-4 py-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                    {label}
                  </p>
                  <span className="rounded-full bg-amber-500/12 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide text-amber-800 dark:text-amber-200">
                    {status}
                  </span>
                </div>
                <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight text-brand">
                  {formatLostSales(value)}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">{support}</p>
              </div>
            ))}
          </div>

          <ExposureProgressionBar daily={daily} weekly={weekly} monthly={monthly} />
        </>
      ) : (
        <div className="rounded-xl border border-border/70 bg-background px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
              Commercial risk
            </p>
            <span className="rounded-full bg-amber-500/12 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide text-amber-800 dark:text-amber-200">
              {estimateStatus}
            </span>
          </div>
          <p className="mt-1 text-xl font-semibold capitalize text-brand">{riskLabel}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Exposure estimates require sales velocity and price inputs for affected SKUs.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <span className="inline-flex items-center rounded-full border border-border/70 bg-background px-2.5 py-1 text-[11px]">
          <span className="text-muted-foreground">OOS SKUs:</span>
          <span className="ml-1 font-semibold tabular-nums text-destructive">{impact.oos_sku_count}</span>
        </span>
        <span className="inline-flex items-center rounded-full border border-border/70 bg-background px-2.5 py-1 text-[11px]">
          <span className="text-muted-foreground">At-risk SKUs:</span>
          <span className="ml-1 font-semibold tabular-nums">{impact.at_risk_sku_count}</span>
        </span>
      </div>

      {skuRows.length > 0 ? <SkuExposureChart rows={skuRows} /> : null}

      <p className="text-xs text-muted-foreground">
        Estimate is based on the shelf issues detected and the sales and price inputs provided for
        affected products.
      </p>

      <p className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
        Illustrative estimate only. This is not confirmed lost revenue. The estimate uses the sales
        and price assumptions provided for affected products and should not be treated as historical
        sales data or a sales forecast.
      </p>
    </div>
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
