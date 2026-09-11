/**
 * Retail Execution Intelligence panels — Phases 4–14 structured metrics UI.
 */

import { Link } from "@tanstack/react-router";
import { ArrowUp, Camera, History, ListOrdered, ShieldCheck, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/States";
import { cn } from "@/lib/utils";
import {
  formatMetricValue,
  type MetricValue,
  type NextBestAction,
  type RetailIntelligencePayload,
} from "@/lib/retail-intelligence";
import { formatInr } from "@/lib/pricing";
import type { ScanResult } from "@/lib/scan-results";
import { formatScoreDelta, executionScore } from "@/lib/scan-execution";

function metricDisplay(m?: MetricValue | null, suffix = "%"): string {
  if (!m) return "Not configured";
  return formatMetricValue(m, (n) => `${Math.round(n)}${suffix}`);
}

export function ImageQualityPanel({
  data,
  loading,
}: {
  data?: ScanResult;
  loading?: boolean;
}) {
  const iq = data?.retail_intelligence?.image_quality;
  if (loading) return <Skeleton className="h-24 w-full" />;
  if (!iq) return null;

  const score = iq.audit_image_quality_score;
  const status = (iq as { status?: string }).status ?? (iq.rescan_recommended ? "retake_required" : "acceptable");

  return (
    <div className="card-surface p-5 sm:p-6">
      <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
        <Camera className="size-3.5" /> Audit image quality
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        {score ? (
          <p className="text-3xl font-semibold tabular-nums">{metricDisplay(score, "/100")}</p>
        ) : null}
        <Badge
          variant={status === "good" ? "default" : status === "retake_required" ? "destructive" : "secondary"}
          className="rounded-full capitalize"
        >
          {status.replace(/_/g, " ")}
        </Badge>
      </div>
      {iq.notes ? <p className="mt-2 text-sm text-muted-foreground">{iq.notes}</p> : null}
      {iq.rescan_recommended ? (
        <p className="mt-2 text-sm font-medium text-destructive">Retake recommended before relying on this audit.</p>
      ) : null}
    </div>
  );
}

export function AssortmentPanel({ data, loading }: { data?: ScanResult; loading?: boolean }) {
  const a = data?.retail_intelligence?.assortment as Record<string, MetricValue> | undefined;
  if (loading) return <Skeleton className="h-24 w-full" />;
  if (!a) return null;

  return (
    <div className="card-surface p-5 sm:p-6">
      <h3 className="text-sm font-semibold tracking-tight">Assortment intelligence</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {[
          { label: "Assortment breadth", m: a.breadth_percent },
          { label: "Missing assortment", m: a.missing_assortment, suffix: "" },
          { label: "Target SKU availability", m: a.target_sku_availability },
        ].map(({ label, m, suffix }) => (
          <div key={label} className="rounded-xl border border-border bg-surface px-4 py-3">
            <p className="text-[0.65rem] font-medium uppercase tracking-widest text-muted-foreground">{label}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{metricDisplay(m, suffix ?? "%")}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function OpportunityLedgerPanel({ data, loading }: { data?: ScanResult; loading?: boolean }) {
  const ledger = (data?.retail_intelligence as RetailIntelligencePayload & { opportunity_ledger?: Array<Record<string, unknown>> })
    ?.opportunity_ledger;
  if (loading) return <Skeleton className="h-32 w-full" />;
  if (!ledger?.length) return null;

  const top = ledger.slice(0, 5);

  return (
    <div className="card-surface p-5 sm:p-6">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          <ListOrdered className="size-3.5" /> Aislix opportunity ledger
        </p>
        <Badge variant="outline" className="rounded-full text-xs">
          Top {top.length} by commercial impact
        </Badge>
      </div>
      <ul className="mt-4 space-y-2">
        {top.map((row) => (
          <li key={String(row.id)} className="rounded-xl border border-border bg-surface px-4 py-3 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="font-medium">{String(row.recommended_action || row.issue)}</p>
              {typeof row.revenue_at_risk_inr === "number" && row.revenue_at_risk_inr > 0 ? (
                <span className="shrink-0 tabular-nums text-destructive">
                  {formatInr(Math.round(row.revenue_at_risk_inr as number))}/day
                </span>
              ) : row.commercial_risk ? (
                <Badge variant="secondary" className="capitalize">
                  {String(row.commercial_risk)} risk
                </Badge>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {[row.brand, row.sku].filter(Boolean).join(" · ")}
              {row.confidence ? ` · ${String(row.confidence)} confidence` : ""}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function VerifiedExecutionPanel({
  data,
  loading,
}: {
  data?: ScanResult;
  loading?: boolean;
}) {
  const nav = data?.navigation;
  const current = executionScore(data);
  const previous = nav?.previous_execution_score ?? undefined;
  const delta = formatScoreDelta(current, previous ?? undefined);

  if (loading) return <Skeleton className="h-24 w-full" />;
  if (previous === undefined || previous === null) return null;

  return (
    <div className="card-surface border-brand/20 bg-brand-soft/20 p-5 sm:p-6">
      <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-brand">
        <ShieldCheck className="size-3.5" /> Aislix verified execution
      </p>
      <p className="mt-2 text-sm text-muted-foreground">Before / after comparison with previous scan at this store</p>
      <div className="mt-4 flex flex-wrap items-end gap-4">
        <div>
          <p className="text-xs text-muted-foreground">Previous</p>
          <p className="text-2xl font-semibold tabular-nums">{Math.round(previous)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Current</p>
          <p className="text-2xl font-semibold tabular-nums">{current ?? "—"}</p>
        </div>
        {delta ? (
          <span className={cn("inline-flex items-center gap-1 text-sm font-medium", current && current > previous ? "text-accent-green" : "text-warning")}>
            {current && current > previous ? <ArrowUp className="size-4" /> : null}
            {delta}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function HistoricalIntelligencePanel({ data, loading }: { data?: ScanResult; loading?: boolean }) {
  const hist = (data?.retail_intelligence as { historical_patterns?: string[] })?.historical_patterns;
  if (loading) return <Skeleton className="h-20 w-full" />;
  if (!hist?.length) return null;

  return (
    <div className="card-surface p-5 sm:p-6">
      <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
        <History className="size-3.5" /> Historical intelligence
      </p>
      <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
        {hist.map((line) => (
          <li key={line}>• {line}</li>
        ))}
      </ul>
    </div>
  );
}

export function PresentabilityPanel({ data, loading }: { data?: ScanResult; loading?: boolean }) {
  const p = (data?.retail_intelligence as { presentability?: { score?: MetricValue; methodology?: string } })
    ?.presentability;
  if (loading) return <Skeleton className="h-20 w-full" />;
  if (!p?.score) return null;

  return (
    <div className="card-surface p-5 sm:p-6">
      <h3 className="text-sm font-semibold tracking-tight">Presentability</h3>
      <p className="mt-2 text-3xl font-semibold tabular-nums">{metricDisplay(p.score, "/100")}</p>
      {p.methodology ? <p className="mt-2 text-xs text-muted-foreground">{p.methodology}</p> : null}
    </div>
  );
}

export function FixRescanCtaPanel({ scanId }: { scanId?: string }) {
  if (!scanId) return null;
  return (
    <div className="card-surface flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div>
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="size-4 text-brand" /> Fix & rescan
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Address top actions, then capture a follow-up photo to verify improvement.
        </p>
      </div>
      <Button asChild variant="brand" className="rounded-xl">
        <Link to="/scan">New scan</Link>
      </Button>
    </div>
  );
}

export function TopActionsPreview({
  actions,
  loading,
}: {
  actions?: NextBestAction[];
  loading?: boolean;
}) {
  if (loading) return <Skeleton className="h-24 w-full" />;
  if (!actions?.length) return null;
  const top = actions.slice(0, 5);
  return (
    <div className="card-surface p-5 sm:p-6">
      <h3 className="text-sm font-semibold tracking-tight">Top 5 recommended actions</h3>
      <ol className="mt-3 space-y-2">
        {top.map((a, i) => (
          <li key={a.action_id} className="flex gap-3 text-sm">
            <span className="font-semibold tabular-nums text-muted-foreground">{i + 1}.</span>
            <div>
              <p className="font-medium">{a.title}</p>
              <p className="text-xs text-muted-foreground">{a.recommended_action}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
