/**

 * Retail Execution Intelligence panels — Phases 4–14 structured metrics UI.

 */



import { Link } from "@tanstack/react-router";

import {

  ArrowUp,

  Camera,

  CheckCircle2,

  History,

  ListOrdered,

  ShieldCheck,

  Sparkles,

} from "lucide-react";

import { Badge } from "@/components/ui/badge";

import { Button } from "@/components/ui/button";

import { Skeleton } from "@/components/States";

import { cn } from "@/lib/utils";

import { buildOpportunityLedger, buildVerificationSnapshot } from "@/lib/opportunity-ledger";

import {

  formatMetricValue,

  type MetricValue,

  type NextBestAction,

  type OpportunityLedgerRow,

  type RetailIntelligencePayload,

} from "@/lib/retail-intelligence";

import { formatInr } from "@/lib/pricing";

import type { ScanResult } from "@/lib/scan-results";

import { executionScore, formatScoreDelta } from "@/lib/scan-execution";



function metricDisplay(m?: MetricValue | null, suffix = "%"): string {

  if (!m) return "Not configured";

  return formatMetricValue(m, (n) => `${Math.round(n)}${suffix}`);

}



const priorityBadge: Record<string, string> = {

  critical: "bg-destructive text-destructive-foreground",

  high: "bg-warning/15 text-warning",

  medium: "bg-muted text-foreground",

  low: "bg-muted text-muted-foreground",

};



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



function LedgerRow({ row }: { row: OpportunityLedgerRow }) {

  const priority = (row.priority ?? row.severity ?? "medium").toLowerCase();

  return (

    <tr className="border-t border-border align-top text-sm">

      <td className="px-3 py-3">

        <Badge className={cn("rounded-full capitalize", priorityBadge[priority] ?? priorityBadge.medium)}>

          {priority}

        </Badge>

      </td>

      <td className="px-3 py-3 font-medium">{row.issue ?? "Execution issue"}</td>

      <td className="px-3 py-3 text-muted-foreground">

        {[row.brand, row.sku].filter(Boolean).join(" · ") || "—"}

      </td>

      <td className="px-3 py-3 tabular-nums text-right">

        {typeof row.revenue_at_risk_inr === "number" && row.revenue_at_risk_inr > 0

          ? `${formatInr(Math.round(row.revenue_at_risk_inr))}/day`

          : "Not estimated"}

      </td>

      <td className="px-3 py-3 text-xs text-muted-foreground">{row.confidence ?? "—"}</td>

      <td className="px-3 py-3 text-xs">{row.recommended_action ?? "—"}</td>

      <td className="px-3 py-3 capitalize text-xs text-muted-foreground">{row.status ?? "open"}</td>

    </tr>

  );

}



export function OpportunityLedgerPanel({ data, loading }: { data?: ScanResult; loading?: boolean }) {

  const ledger = buildOpportunityLedger(data);

  if (loading) return <Skeleton className="h-32 w-full" />;

  if (!ledger.length) {

    return (

      <div className="card-surface p-5 sm:p-6">

        <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">

          <ListOrdered className="size-3.5" /> Aislix opportunity ledger

        </p>

        <p className="mt-3 text-sm text-muted-foreground">No commercial opportunities identified for this audit.</p>

      </div>

    );

  }



  return (

    <div className="card-surface p-5 sm:p-6">

      <div className="flex flex-wrap items-center justify-between gap-2">

        <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">

          <ListOrdered className="size-3.5" /> Aislix opportunity ledger

        </p>

        <Badge variant="outline" className="rounded-full text-xs">

          {ledger.length} opportunit{ledger.length === 1 ? "y" : "ies"} · sorted by commercial impact

        </Badge>

      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-border">

        <table className="w-full min-w-[48rem] text-left">

          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">

            <tr>

              <th className="px-3 py-2">Priority</th>

              <th className="px-3 py-2">Issue</th>

              <th className="px-3 py-2">SKU</th>

              <th className="px-3 py-2 text-right">Financial impact</th>

              <th className="px-3 py-2">Confidence</th>

              <th className="px-3 py-2">Recommended action</th>

              <th className="px-3 py-2">Status</th>

            </tr>

          </thead>

          <tbody>

            {ledger.slice(0, 10).map((row) => (

              <LedgerRow key={row.id} row={row} />

            ))}

          </tbody>

        </table>

      </div>

      {ledger[0]?.expected != null && (

        <p className="mt-3 text-xs text-muted-foreground">

          Top gap: expected {ledger[0].expected}, actual {ledger[0].actual ?? "0"}, gap {ledger[0].gap ?? "—"}

        </p>

      )}

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

  const verification =

    data?.retail_intelligence?.execution_verification ?? buildVerificationSnapshot(data);

  const nav = data?.navigation;

  const current = executionScore(data);

  const previous = nav?.previous_execution_score ?? verification?.previous_score ?? undefined;

  const delta = formatScoreDelta(current, previous ?? undefined);



  if (loading) return <Skeleton className="h-24 w-full" />;

  if (previous === undefined || previous === null) return null;



  const improved = verification?.improved ?? (current != null && current > previous);

  const verified = verification?.verified ?? false;



  return (

    <div className="card-surface border-brand/20 bg-brand-soft/20 p-5 sm:p-6">

      <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-brand">

        <ShieldCheck className="size-3.5" /> Fix → re-audit → verify

      </p>

      <p className="mt-2 text-sm text-muted-foreground">

        {verification?.summary ?? "Before / after comparison with the previous scan at this location."}

      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

        <div>

          <p className="text-xs text-muted-foreground">Execution score</p>

          <p className="mt-1 text-lg font-semibold tabular-nums">

            {Math.round(previous)} → {current ?? "—"}

          </p>

          {delta ? <p className="text-xs text-muted-foreground">{delta}</p> : null}

        </div>

        {verification?.current_target_sku_availability ? (

          <div>

            <p className="text-xs text-muted-foreground">Target SKU availability</p>

            <p className="mt-1 text-lg font-semibold tabular-nums">

              {verification.previous_target_sku_availability ?? "—"} →{" "}

              {verification.current_target_sku_availability}

            </p>

          </div>

        ) : null}

        {verification?.current_planogram_presence ? (

          <div>

            <p className="text-xs text-muted-foreground">Planogram SKU presence</p>

            <p className="mt-1 text-lg font-semibold tabular-nums">

              {verification.previous_planogram_presence ?? "—"} → {verification.current_planogram_presence}

            </p>

          </div>

        ) : null}

        <div className="flex items-end">

          {verified ? (

            <Badge className="rounded-full bg-accent-green/15 text-accent-green">

              <CheckCircle2 className="mr-1 size-3.5" /> Verified execution

            </Badge>

          ) : improved ? (

            <Badge variant="secondary" className="rounded-full">

              Improved — confirm with another re-audit if needed

            </Badge>

          ) : (

            <Badge variant="outline" className="rounded-full">

              Follow-up recorded

            </Badge>

          )}

        </div>

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

  const state = p.score.state;

  if (state === "not_configured" || state === "unavailable") {

    return (

      <div className="card-surface p-5 sm:p-6">

        <h3 className="text-sm font-semibold tracking-tight">Presentability</h3>

        <p className="mt-2 text-sm text-muted-foreground">Not assessed</p>

        {p.methodology ? <p className="mt-1 text-xs text-muted-foreground">{p.methodology}</p> : null}

      </div>

    );

  }



  return (

    <div className="card-surface p-5 sm:p-6">

      <h3 className="text-sm font-semibold tracking-tight">Presentability</h3>

      <p className="mt-2 text-3xl font-semibold tabular-nums">{metricDisplay(p.score, "/100")}</p>

      {p.methodology ? <p className="mt-2 text-xs text-muted-foreground">{p.methodology}</p> : null}

    </div>

  );

}



export function FixRescanCtaPanel({

  scanId,

  data,

}: {

  scanId?: string;

  data?: ScanResult;

}) {

  const ledger = buildOpportunityLedger(data);

  const top = ledger[0];

  const rescanHref = scanId ? `/scan?verify=${encodeURIComponent(scanId)}` : "/scan";



  return (

    <div className="card-surface flex flex-col gap-4 p-5 sm:p-6">

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">

        <div>

          <p className="flex items-center gap-2 text-sm font-semibold">

            <Sparkles className="size-4 text-brand" /> Fix → re-audit → verify

          </p>

          <p className="mt-1 text-sm text-muted-foreground">

            Complete the top corrective action, capture a follow-up shelf photo, and Aislix will compare before vs

            after execution.

          </p>

        </div>

        <Button asChild variant="brand" className="shrink-0 rounded-xl">

          <Link to={rescanHref}>Re-audit to verify</Link>

        </Button>

      </div>

      {top ? (

        <div className="rounded-xl border border-border bg-surface px-4 py-3 text-sm">

          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Priority action</p>

          <p className="mt-1 font-medium">{top.recommended_action}</p>

          <p className="mt-1 text-xs text-muted-foreground">

            {[top.brand, top.sku].filter(Boolean).join(" · ")}

            {top.revenue_at_risk_inr ? ` · ${formatInr(Math.round(top.revenue_at_risk_inr))}/day exposure` : ""}

          </p>

        </div>

      ) : null}

      <ol className="space-y-2 text-sm text-muted-foreground">

        <li>1. Fix the issue on shelf (replenish, move, or add facings).</li>

        <li>2. Capture a new photo of the same bay.</li>

        <li>3. Review verified execution KPIs on the results page.</li>

      </ol>

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


