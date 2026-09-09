import { useMemo, useState } from "react";
import { ArrowRight, Download, Sparkles, Timer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AI_DISCLAIMER } from "@/components/scan/ScanProgressPanel";
import { ComplianceAlertCard } from "@/components/scan-results/ResultParts";
import {
  ActionCenterPanel,
  AiSummaryBlock,
  ExecutionKpiStripPanel,
  ExecutionScoreHero,
  FacingsSummaryStrip,
  FinancialImpactPanel,
  RecommendedActionsPanel,
  ResultViewSwitcher,
  ShareOfShelfPanel,
  SkuAvailabilityPanel,
} from "@/components/scan-results/ExecutionPhase1";
import {
  orderedVisibleSections,
  VIEW_MODE_DESCRIPTIONS,
  type ResultSectionKey,
  type ResultViewMode,
} from "@/lib/customer-context";
import { landingToScanResult } from "@/lib/demo-execution";
import type { LandingScanResult } from "@/lib/landing-scan-api";
import { displayVariant } from "@/lib/landing-inventory";
import { trackLandingEvent } from "@/lib/landing-analytics";

/** Sections handled outside the tab loop on the landing demo. */
const DEMO_SKIP_SECTIONS = new Set<ResultSectionKey>([
  "annotated_image",
  "improvement_banner",
  "review_queue",
  "share",
  "scan_details",
  "downloads",
  "analytics",
  "competitor_intel",
]);

type DemoRoleResultsPanelProps = {
  result: LandingScanResult;
  elapsedSec?: number | null;
  showWorkspaceCta?: boolean;
  onDownloadCsv?: () => void;
  onWorkspaceCta?: () => void;
};

export function DemoRoleResultsPanel({
  result: landing,
  elapsedSec,
  showWorkspaceCta = false,
  onDownloadCsv,
  onWorkspaceCta,
}: DemoRoleResultsPanelProps) {
  const [view, setView] = useState<ResultViewMode>("execution");
  const data = useMemo(() => landingToScanResult(landing), [landing]);
  const sectionOrder = orderedVisibleSections(view).filter((key) => !DEMO_SKIP_SECTIONS.has(key));

  return (
    <div className="flex max-h-[min(70vh,640px)] flex-col">
      {elapsedSec != null && (
        <div className="mb-3 flex shrink-0 items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-xs text-muted-foreground">
          <Timer className="size-3.5 text-brand" />
          <span>
            Analysis completed in{" "}
            <span className="font-semibold text-foreground">{elapsedSec}s</span>
          </span>
        </div>
      )}

      <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2">
        <Badge className="gap-1.5 rounded-md bg-brand text-brand-foreground">
          <Sparkles className="size-3" /> Live AI analysis
        </Badge>
        {landing.scanned_at ? (
          <span className="text-[11px] text-muted-foreground">
            {new Date(landing.scanned_at).toLocaleString()}
          </span>
        ) : null}
      </div>

      <div className="mb-3 shrink-0 space-y-2 border-b border-border pb-3">
        <p className="text-xs text-muted-foreground">{VIEW_MODE_DESCRIPTIONS[view]}</p>
        <ResultViewSwitcher value={view} onChange={setView} />
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {sectionOrder.map((key) => {
          switch (key) {
            case "score_hero":
              return <ExecutionScoreHero key={key} data={data} />;
            case "kpi_strip":
              return <ExecutionKpiStripPanel key={key} data={data} />;
            case "facings_strip":
              return <FacingsSummaryStrip key={key} data={data} />;
            case "action_center":
              return <ActionCenterPanel key={key} data={data} />;
            case "financial_impact":
              return <FinancialImpactPanel key={key} data={data} locked={false} planCode="growth" />;
            case "placement_alert":
              return (data.compliance_alerts?.length ?? 0) > 0 ? (
                <ComplianceAlertCard
                  key={key}
                  alerts={data.compliance_alerts}
                  mismatches={data.subcategory_mismatches}
                />
              ) : null;
            case "ai_summary":
              return <AiSummaryBlock key={key} data={data} />;
            case "share_of_shelf":
              return <ShareOfShelfPanel key={key} data={data} />;
            case "sku_availability":
              return <SkuAvailabilityPanel key={key} data={data} />;
            case "recommended_actions":
              return <RecommendedActionsPanel key={key} data={data} />;
            case "planogram":
              return data.planogram?.requested ? (
                <div key={key} className="card-surface p-4 text-sm">
                  <h3 className="font-semibold tracking-tight">Planogram compliance</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {data.planogram.sku_match_percent != null
                      ? `${Math.round(data.planogram.sku_match_percent)}% SKU match`
                      : "Planogram comparison available in a full workspace scan."}
                  </p>
                </div>
              ) : null;
            case "inventory":
              return <DemoInventoryCompact key={key} rows={landing.inventory ?? []} />;
            default:
              return null;
          }
        })}
      </div>

      <p className="mt-3 shrink-0 text-[11px] leading-relaxed text-muted-foreground">{AI_DISCLAIMER}</p>

      {landing.scans_daily_limit != null && (
        <p className="mt-2 shrink-0 text-xs text-muted-foreground">
          {landing.scans_used_today ?? 0} of {landing.scans_daily_limit} free demo scans used today
        </p>
      )}

      <div className="mt-3 flex shrink-0 flex-col gap-2 sm:flex-row sm:justify-end">
        <Button
          variant="outline"
          size="sm"
          className="w-full sm:w-auto"
          disabled={!onDownloadCsv}
          onClick={() => {
            trackLandingEvent("cta_click", { location: "download_csv" });
            onDownloadCsv?.();
          }}
        >
          <Download className="size-4" /> Download CSV
        </Button>
        {showWorkspaceCta ? (
          <Button
            size="sm"
            className="w-full sm:w-auto"
            onClick={() => {
              trackLandingEvent("cta_click", { location: "create_workspace" });
              onWorkspaceCta?.();
            }}
          >
            Create your workspace <ArrowRight className="size-4" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function DemoInventoryCompact({
  rows,
}: {
  rows: LandingScanResult["inventory"];
}) {
  return (
    <div className="card-surface overflow-hidden">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold tracking-tight">Complete inventory</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{rows.length} SKU groups detected</p>
      </div>
      <div className="max-h-48 overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-surface text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Brand</th>
              <th className="px-3 py-2 font-medium">Product</th>
              <th className="px-3 py-2 font-medium">Qty</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={`${row.brand}-${row.product_name}-${i}`} className="border-t border-border">
                <td className="px-3 py-2">{row.brand || "—"}</td>
                <td className="px-3 py-2">
                  {row.product_name || "—"}
                  {displayVariant(row) ? (
                    <span className="block text-xs text-muted-foreground">{displayVariant(row)}</span>
                  ) : null}
                </td>
                <td className="px-3 py-2 tabular-nums">{row.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
