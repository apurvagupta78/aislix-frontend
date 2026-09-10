/**
 * Shared scan results section loop for demo inline panel and guest fullscreen.
 */

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
  VIEW_MODE_THEME,
  type ResultSectionKey,
  type ResultViewMode,
} from "@/lib/customer-context";
import type { ScanResult } from "@/lib/scan-results";
import { cn } from "@/lib/utils";
import { displayVariant } from "@/lib/landing-inventory";
import type { LandingScanResult } from "@/lib/landing-scan-api";

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

type DemoScanResultsBodyProps = {
  data: ScanResult;
  view: ResultViewMode;
  onViewChange: (mode: ResultViewMode) => void;
  compact?: boolean;
  landingInventory?: LandingScanResult["inventory"];
  showPlanogramStub?: boolean;
};

export function DemoScanResultsBody({
  data,
  view,
  onViewChange,
  compact = false,
  landingInventory,
  showPlanogramStub = false,
}: DemoScanResultsBodyProps) {
  const theme = VIEW_MODE_THEME[view];
  const sectionOrder = orderedVisibleSections(view).filter((key) => !DEMO_SKIP_SECTIONS.has(key));

  return (
    <>
      <div
        className={cn(
          "shrink-0 border-b pb-3",
          theme.accentBorder,
          compact ? "mb-3 space-y-2" : "mb-4 space-y-3 pb-4",
        )}
      >
        <p className={cn("text-muted-foreground", compact ? "text-xs" : "text-sm")}>
          {VIEW_MODE_DESCRIPTIONS[view]}
        </p>
        <ResultViewSwitcher value={view} onChange={onViewChange} />
      </div>

      <div className={cn("space-y-3", compact ? "" : "space-y-4")}>
        {sectionOrder.map((key) => {
          switch (key) {
            case "score_hero":
              return (
                <div key={key} className={cn("rounded-xl ring-1", theme.accentBorder, theme.ring)}>
                  <ExecutionScoreHero data={data} />
                </div>
              );
            case "kpi_strip":
              return <ExecutionKpiStripPanel key={key} data={data} compact={compact} />;
            case "facings_strip":
              return <FacingsSummaryStrip key={key} data={data} />;
            case "action_center":
              return <ActionCenterPanel key={key} data={data} />;
            case "financial_impact":
              return (
                <FinancialImpactPanel key={key} data={data} locked={false} planCode="growth" />
              );
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
              return showPlanogramStub || data.planogram?.requested ? (
                <div key={key} className="card-surface p-4 text-sm">
                  <h3 className="font-semibold tracking-tight">Planogram compliance</h3>
                  {data.planogram?.sku_match_percent != null ? (
                    <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                      <p>
                        <span className="font-medium text-foreground">
                          {Math.round(data.planogram.sku_match_percent)}% SKU match
                        </span>
                        {data.planogram.qty_compliance_percent != null
                          ? ` · ${Math.round(data.planogram.qty_compliance_percent)}% quantity compliance`
                          : null}
                      </p>
                      {typeof data.planogram.summary?.expected_sku_count === "number" ? (
                        <p>
                          Compared {data.planogram.summary.expected_sku_count} expected SKUs from your
                          planogram against detected shelf inventory.
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Add a planogram in the setup panel to compare expected vs detected products.
                    </p>
                  )}
                </div>
              ) : null;
            case "inventory":
              return landingInventory ? (
                <DemoInventoryCompact key={key} rows={landingInventory} />
              ) : null;
            default:
              return null;
          }
        })}
      </div>
    </>
  );
}

function DemoInventoryCompact({ rows }: { rows: LandingScanResult["inventory"] }) {
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
