import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  ClipboardList,
  Gauge,
  HelpCircle,
  ScanLine,
  Store,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip as UiTooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CardSkeleton, EmptyState, ErrorState, Skeleton } from "@/components/States";
import { SectionHeader } from "@/components/dashboard/DashboardParts";
import { DASHBOARD_STATUS_COLORS } from "@/lib/dashboard-config";
import { dashboardRoleContext } from "@/lib/dashboard-role-context";
import { formatNumber, formatPercent, formatQuota, formatScore } from "@/lib/dashboard";
import type { WorkspaceDashboardData } from "@/lib/dashboard-intelligence";
import type { AuditRoleTab } from "@/lib/role-audit-ui";
import { cn } from "@/lib/utils";

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--card)",
  fontSize: 12,
} as const;

export function CommandSectionHeader({
  eyebrow,
  description,
}: {
  eyebrow: string;
  description?: string;
}) {
  return (
    <div className="mb-4">
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        {eyebrow}
      </p>
      {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
    </div>
  );
}

function scoreTone(score: number | null): string {
  if (score === null) return "text-muted-foreground";
  if (score >= 90) return "text-accent-green";
  if (score >= 75) return "text-foreground";
  if (score >= 60) return "text-warning";
  return "text-destructive";
}

function KpiProgress({ percent }: { percent: number | null }) {
  if (percent === null) return null;
  const clamped = Math.min(100, Math.max(0, percent));
  const tone =
    clamped >= 90
      ? "bg-accent-green"
      : clamped >= 75
        ? "bg-brand"
        : clamped >= 60
          ? "bg-warning"
          : "bg-destructive/70";
  return (
    <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-muted/50">
      <div className={cn("h-full rounded-full", tone)} style={{ width: `${clamped}%` }} />
    </div>
  );
}

function RetailKpiCard({
  title,
  value,
  description,
  detail,
  progress,
  tooltip,
  scanId,
}: {
  title: string;
  value: string;
  description: string;
  detail?: string | null;
  progress?: number | null;
  tooltip?: string;
  scanId?: string | null;
}) {
  const body = (
    <div className="flex h-full flex-col rounded-xl border border-border/60 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {title}
        </p>
        {tooltip ? (
          <TooltipProvider>
            <UiTooltip>
              <TooltipTrigger asChild>
                <button type="button" className="text-muted-foreground hover:text-foreground" aria-label="More info">
                  <HelpCircle className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">{tooltip}</TooltipContent>
            </UiTooltip>
          </TooltipProvider>
        ) : null}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-brand">{value}</p>
      {detail ? <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">{detail}</p> : null}
      <p className="mt-1 flex-1 text-[11px] leading-relaxed text-muted-foreground">{description}</p>
      <KpiProgress percent={progress ?? null} />
    </div>
  );

  if (scanId) {
    return (
      <Link
        to="/results"
        search={{ audit: scanId }}
        className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        {body}
      </Link>
    );
  }
  return body;
}

export function WorkspaceKpiSummary({
  data,
  isLoading,
  error,
  onRetry,
}: {
  data?: WorkspaceDashboardData["kpis"];
  isLoading: boolean;
  error?: Error | null;
  onRetry?: () => void;
}) {
  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <ErrorState title="Couldn't load KPIs" description={error.message} onRetry={onRetry} />
    );
  }
  if (!data) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {data.primary_kpi_cards.map((card) => (
        <RetailKpiCard
          key={card.kpi_id}
          title={card.title}
          value={card.value}
          detail={
            [card.detail, card.coverage, card.target !== null ? `Target ${Math.round(card.target)}%` : null, card.status]
              .filter(Boolean)
              .join(" · ") || undefined
          }
          description={card.description}
          progress={card.progress}
          scanId={card.trace_scan_id}
        />
      ))}
    </div>
  );
}

function PriorityBar({ high, medium, low, total }: { high: number; medium: number; low: number; total: number }) {
  if (!total) {
    return <div className="h-3 rounded-full bg-muted/40" />;
  }
  const hp = (high / total) * 100;
  const mp = (medium / total) * 100;
  const lp = (low / total) * 100;
  return (
    <div className="flex h-3 overflow-hidden rounded-full border border-border/60 bg-muted/30">
      {hp > 0 ? <div className={cn("h-full", DASHBOARD_STATUS_COLORS.high)} style={{ width: `${hp}%` }} /> : null}
      {mp > 0 ? <div className={cn("h-full", DASHBOARD_STATUS_COLORS.medium)} style={{ width: `${mp}%` }} /> : null}
      {lp > 0 ? <div className={cn("h-full", DASHBOARD_STATUS_COLORS.low)} style={{ width: `${lp}%` }} /> : null}
    </div>
  );
}

function AttentionProgress({ percent }: { percent: number | null }) {
  if (percent === null) return null;
  const clamped = Math.min(100, Math.max(0, percent));
  const tone =
    clamped >= 90
      ? "bg-accent-green"
      : clamped >= 75
        ? "bg-brand"
        : clamped >= 60
          ? "bg-warning"
          : "bg-destructive/70";
  return (
    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted/50">
      <div className={cn("h-full rounded-full", tone)} style={{ width: `${clamped}%` }} />
    </div>
  );
}

export function WhatNeedsAttentionSection({
  data,
  role,
}: {
  data: WorkspaceDashboardData;
  role: AuditRoleTab;
}) {
  const cards = data.attention_cards;
  const { high, medium, low, total } = data.issues;
  const showIssueBar = total > 0;
  const roleCopy = dashboardRoleContext(role);

  return (
    <section className="mt-8">
      <CommandSectionHeader
        eyebrow="What needs attention"
        description={roleCopy.attentionDescription}
      />
      {showIssueBar ? (
        <div className="mb-4 rounded-xl border border-border/60 bg-white p-3 shadow-sm">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Open issues
            </p>
            <div className="flex gap-3 text-[10px] text-muted-foreground">
              <span>
                <span className="font-semibold text-destructive">{high}</span> High
              </span>
              <span>
                <span className="font-semibold text-warning">{medium}</span> Medium
              </span>
              <span>
                <span className="font-semibold text-brand">{low}</span> Low
              </span>
            </div>
          </div>
          <PriorityBar high={high} medium={medium} low={low} total={total} />
        </div>
      ) : null}
      {!cards.length ? (
        <div className="rounded-xl border border-border/60 bg-white p-6 shadow-sm">
          <p className="text-sm text-muted-foreground">No open issues in this view.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
          {cards.map((card) => {
            const varianceTone =
              card.variance_pts !== null && card.variance_pts < 0
                ? card.variance_pts <= -10
                  ? "text-destructive"
                  : "text-warning"
                : card.variance_pts !== null && card.variance_pts > 0
                  ? "text-accent-green"
                  : "text-muted-foreground";

            const body = (
              <div className="flex h-full flex-col rounded-xl border border-border/60 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
                <p className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {card.area_label}
                </p>
                <p
                  className={cn(
                    "mt-2 text-xl font-semibold tabular-nums leading-tight",
                    card.no_data ? "text-muted-foreground" : "text-brand",
                  )}
                >
                  {card.score_display}
                </p>
                {card.variance ? (
                  <p className={cn("mt-1 text-[11px] font-medium", varianceTone)}>{card.variance}</p>
                ) : null}
                <AttentionProgress percent={card.progress_percent} />
                <p className="mt-2 flex-1 text-[11px] leading-relaxed text-muted-foreground">
                  {card.no_data ? card.no_data_reason ?? card.explanation : card.explanation}
                </p>
                {card.issue_count > 0 ? (
                  <p className="mt-1.5 text-[11px] font-medium text-muted-foreground">
                    {card.issue_count} issue{card.issue_count === 1 ? "" : "s"} need attention
                  </p>
                ) : card.affected_audits > 0 && !card.no_data ? (
                  <p className="mt-1.5 text-[11px] font-medium text-muted-foreground">
                    {card.affected_audits} affected audit{card.affected_audits === 1 ? "" : "s"}
                  </p>
                ) : null}
                <p className="mt-2.5 flex items-center gap-1 text-[11px] font-semibold text-brand">
                  {card.action_label}
                  <ArrowRight className="size-3" aria-hidden />
                </p>
              </div>
            );

            if (!card.scan_id) return <div key={card.key}>{body}</div>;
            return (
              <Link
                key={card.key}
                to="/results"
                search={{ audit: card.scan_id }}
                className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                {body}
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

export { PerformanceOverTimeSection } from "@/components/dashboard/PerformanceOverTimeSection";

/** @deprecated use PerformanceOverTimeSection */
export { PerformanceOverTimeSection as ShelfPerformanceSection } from "@/components/dashboard/PerformanceOverTimeSection";

export function BrandCompetitionSection({ data }: { data: WorkspaceDashboardData }) {
  const brand = data.brand_competition;
  if (!brand?.segments.length) return null;

  return (
    <section className="mt-8">
      <CommandSectionHeader
        eyebrow="Brand & competition"
        description="See how your brand's shelf presence compares with competing brands."
      />
      <div className="card-surface p-5 sm:p-6">
        <div className="flex h-5 overflow-hidden rounded-full border border-border/60">
          {brand.segments.map((seg, i) => (
            <div
              key={seg.label}
              className={cn("h-full", i === 0 ? "bg-brand" : i === 1 ? "bg-brand/60" : "bg-brand/30")}
              style={{ width: `${Math.max(0, Math.min(100, seg.share))}%` }}
              title={`${seg.label} ${Math.round(seg.share)}%`}
            />
          ))}
        </div>
        <ul className="mt-3 space-y-1.5 text-xs">
          {brand.segments.map((seg) => (
            <li key={seg.label} className="flex justify-between gap-2">
              <span className={seg.is_primary ? "font-medium text-brand" : "text-muted-foreground"}>
                {seg.label}
              </span>
              <span className="tabular-nums">{Math.round(seg.share)}%</span>
            </li>
          ))}
        </ul>
        {brand.insight ? (
          <p className="mt-3 text-xs text-muted-foreground">{brand.insight}</p>
        ) : null}
        {brand.scan_id ? (
          <div className="mt-4">
            <Button asChild variant="ghost" size="sm" className="rounded-xl text-xs">
              <Link to="/results" search={{ audit: brand.scan_id }}>
                View Brand Analysis <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function TrackImprovementSection({ data }: { data: WorkspaceDashboardData }) {
  return (
    <section className="mt-8">
      <SectionHeader
        title="Track improvement"
        description="Compare audits over time to see whether issues are actually being fixed."
      />
      <div className="card-surface mt-4 p-5 sm:p-6">
        {!data.improvement?.length ? (
          <p className="text-sm text-muted-foreground">
            Complete another audit to start tracking improvement.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {data.improvement.map((m) => (
              <div key={m.key} className="rounded-xl border border-border/70 bg-muted/20 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {m.label}
                </p>
                <p className="mt-2 text-lg font-semibold tabular-nums">
                  {m.previous} → {m.current}
                </p>
                <p
                  className={cn(
                    "mt-1 text-xs font-medium",
                    m.improved === true && "text-accent-green",
                    m.improved === false && "text-destructive",
                    m.improved === null && "text-muted-foreground",
                  )}
                >
                  {m.change}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function RetailPerformanceSection({
  data,
  role,
  isLoading,
  error,
  onRetry,
}: {
  data?: WorkspaceDashboardData["kpis"];
  role: AuditRoleTab;
  isLoading: boolean;
  error?: Error | null;
  onRetry?: () => void;
}) {
  const roleCopy = dashboardRoleContext(role);
  return (
    <section>
      <CommandSectionHeader
        eyebrow={roleCopy.performanceEyebrow}
        description={roleCopy.performanceDescription}
      />
      <WorkspaceKpiSummary data={data} isLoading={isLoading} error={error} onRetry={onRetry} />
    </section>
  );
}

export function PriorityOpportunitiesSection({ data }: { data: WorkspaceDashboardData }) {
  return (
    <section className="mt-8">
      <SectionHeader
        title="Priority opportunities"
        description="See where a small number of actions could improve shelf execution the most."
      />
      <div className="card-surface mt-4 p-5 sm:p-6">
        {!data.priority_opportunities.length ? (
          <p className="text-sm text-muted-foreground">
            No grouped opportunities in this period — your shelves may already be in good shape, or run more
            planogram-backed audits to surface category-level gaps.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {data.priority_opportunities.map((row) => (
              <div key={row.category} className="rounded-xl border border-border/70 bg-muted/20 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {row.label}
                </p>
                <p className="mt-2 text-2xl font-semibold tabular-nums">{row.count}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">open issues</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function AuditQualitySection({ data }: { data: WorkspaceDashboardData }) {
  const k = data.kpis;
  return (
    <section className="mt-8">
      <SectionHeader
        title="Audit quality"
        description="Operational metrics from your completed audits — not the primary business KPIs."
      />
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Products detected"
          value={formatNumber(k.products_detected)}
          description="Total products across audits"
        />
        <KpiCard
          title="Average AI confidence"
          value={formatPercent(k.average_confidence)}
          description="Recognition confidence"
        />
        <KpiCard
          title="Images processed"
          value={formatNumber(k.images_processed)}
          description="Shelf photos analysed"
        />
        <KpiCard
          title="Audits completed"
          value={formatNumber(k.audits_completed)}
          description="Successfully processed"
        />
      </div>
    </section>
  );
}

export function RoleVisualSection({ data }: { data: WorkspaceDashboardData }) {
  const visual = data.role_visual;
  if (!visual) return null;

  if (visual.kind === "share_of_shelf") {
    return (
      <section className="mt-8">
        <SectionHeader title="Share of shelf" description="Brand shelf presence from your latest audit." />
        <div className="card-surface mt-4 p-5 sm:p-6">
          <div className="flex h-4 overflow-hidden rounded-full border border-border/60">
            {visual.segments.map((seg, i) => (
              <div
                key={seg.label}
                className={cn("h-full", i === 0 ? "bg-brand" : i === 1 ? "bg-brand/60" : "bg-brand/30")}
                style={{ width: `${seg.share}%` }}
                title={`${seg.label} ${seg.share}%`}
              />
            ))}
          </div>
          <ul className="mt-3 space-y-1.5 text-xs">
            {visual.segments.map((seg) => (
              <li key={seg.label} className="flex justify-between gap-2">
                <span className={seg.is_primary ? "font-medium text-brand" : "text-muted-foreground"}>
                  {seg.label}
                </span>
                <span className="tabular-nums">{Math.round(seg.share)}%</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    );
  }

  if (visual.kind === "outlet_execution") {
    return (
      <section className="mt-8">
        <SectionHeader title="Outlet execution" description="Outlet ranking by shelf KPIs." />
        <div className="card-surface mt-4 space-y-3 p-5 sm:p-6">
          {visual.outlets.map((o) => (
            <div key={o.name} className="flex items-center gap-3">
              <span className="w-28 shrink-0 truncate text-xs font-medium">{o.name}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted/40">
                <div
                  className="h-full bg-brand"
                  style={{ width: `${o.osa ?? 0}%` }}
                />
              </div>
              <span className="w-10 shrink-0 text-right text-xs tabular-nums">
                {o.osa !== null ? `${Math.round(o.osa)}%` : "—"}
              </span>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (visual.kind === "location_accuracy") {
    return (
      <section className="mt-8">
        <SectionHeader title="Location accuracy" description="Accuracy by store or location." />
        <div className="card-surface mt-4 space-y-3 p-5 sm:p-6">
          {visual.locations.map((loc) => (
            <div key={loc.label} className="flex items-center gap-3">
              <span className="w-28 shrink-0 truncate text-xs font-medium">{loc.label}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted/40">
                <div
                  className="h-full bg-brand"
                  style={{ width: `${loc.accuracy ?? 0}%` }}
                />
              </div>
              <span className="w-10 shrink-0 text-right text-xs tabular-nums">
                {loc.accuracy !== null ? `${Math.round(loc.accuracy)}%` : "—"}
              </span>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return null;
}

export function WorkspaceDashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
      <Skeleton className="h-48 w-full rounded-2xl" />
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  );
}
