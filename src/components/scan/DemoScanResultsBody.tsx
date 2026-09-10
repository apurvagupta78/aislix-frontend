/**
 * Shared scan results section loop for demo inline panel and guest fullscreen.
 */

import { AnnotatedImageViewer, ComplianceAlertCard, InventoryTable } from "@/components/scan-results/ResultParts";
import {
  ActionCenterPanel,
  AiSummaryBlock,
  CompetitorIntelPanel,
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
import type { PlanogramRow } from "@/lib/planogram";
import { cn } from "@/lib/utils";
import { displayVariant } from "@/lib/landing-inventory";
import type { LandingScanResult } from "@/lib/landing-scan-api";
import { Badge } from "@/components/ui/badge";

const INLINE_SKIP_SECTIONS = new Set<ResultSectionKey>([
  "annotated_image",
  "improvement_banner",
  "review_queue",
  "share",
  "scan_details",
  "downloads",
  "analytics",
  "recommended_actions",
]);

const DASHBOARD_SKIP_SECTIONS = new Set<ResultSectionKey>([
  "improvement_banner",
  "review_queue",
  "share",
  "scan_details",
  "downloads",
  "analytics",
]);

type DemoScanResultsBodyProps = {
  data: ScanResult;
  view: ResultViewMode;
  onViewChange: (mode: ResultViewMode) => void;
  compact?: boolean;
  layout?: "inline" | "dashboard";
  imageUrl?: string | null;
  landingInventory?: LandingScanResult["inventory"];
  showPlanogramStub?: boolean;
};

export function DemoScanResultsBody({
  data,
  view,
  onViewChange,
  compact = false,
  layout = "inline",
  imageUrl,
  landingInventory,
  showPlanogramStub = false,
}: DemoScanResultsBodyProps) {
  const theme = VIEW_MODE_THEME[view];
  const skip = layout === "dashboard" ? DASHBOARD_SKIP_SECTIONS : INLINE_SKIP_SECTIONS;
  let sectionOrder = orderedVisibleSections(view).filter((key) => !skip.has(key));

  /** Demo: always surface executive summary, competitor intel, and inventory on every tab. */
  const demoEnrichSections: ResultSectionKey[] = [];
  if (!sectionOrder.includes("ai_summary")) demoEnrichSections.push("ai_summary");
  if (data.competitor_intel && !sectionOrder.includes("competitor_intel")) {
    demoEnrichSections.push("competitor_intel");
  }
  if (landingInventory?.length && !sectionOrder.includes("inventory")) {
    demoEnrichSections.push("inventory");
  }
  if (demoEnrichSections.length) {
    const anchor = sectionOrder.indexOf("action_center");
    const insertAt = anchor >= 0 ? anchor + 1 : Math.min(3, sectionOrder.length);
    sectionOrder = [
      ...sectionOrder.slice(0, insertAt),
      ...demoEnrichSections,
      ...sectionOrder.slice(insertAt),
    ];
  }

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
              return <ActionCenterPanel key={key} data={data} view={view} demoMode />;
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
              return <AiSummaryBlock key={key} data={data} view={view} />;
            case "competitor_intel":
              return data.competitor_intel ? (
                <CompetitorIntelPanel key={key} snapshot={data.competitor_intel} />
              ) : null;
            case "share_of_shelf":
              return <ShareOfShelfPanel key={key} data={data} />;
            case "sku_availability":
              return <SkuAvailabilityPanel key={key} data={data} />;
            case "recommended_actions":
              return <RecommendedActionsPanel key={key} data={data} />;
            case "annotated_image":
              return imageUrl ? (
                <AnnotatedImageViewer key={key} src={imageUrl} alt="Analyzed shelf photo" />
              ) : null;
            case "planogram":
              return showPlanogramStub || data.planogram?.requested ? (
                <PlanogramComplianceCard key={key} data={data} />
              ) : null;
            case "inventory":
              return layout === "dashboard" && data.inventory?.length ? (
                <InventoryTable key={key} items={data.inventory} />
              ) : landingInventory ? (
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

const PLANOGRAM_DISPLAY_COLUMNS = [
  { key: "location", label: "Location" },
  { key: "category", label: "Category" },
  { key: "sub_category", label: "Sub category" },
  { key: "brand", label: "Brand" },
  { key: "product_name", label: "Product name" },
  { key: "variant", label: "Variant" },
  { key: "expected_qty", label: "Expected qty" },
  { key: "mrp_inr", label: "Price" },
  { key: "avg_daily_sales", label: "Daily sales (units)" },
  { key: "sku", label: "SKU" },
  { key: "shelf_position", label: "Shelf position" },
] as const;

function formatPlanogramCell(key: string, row: PlanogramRow): string {
  if (key === "mrp_inr") {
    return row.mrp_inr != null && row.mrp_inr > 0 ? `₹${row.mrp_inr}` : "—";
  }
  if (key === "expected_qty") return String(row.expected_qty ?? "—");
  if (key === "avg_daily_sales") {
    return row.avg_daily_sales != null ? String(row.avg_daily_sales) : "—";
  }
  const value = row[key as keyof PlanogramRow];
  const text = typeof value === "string" ? value.trim() : "";
  return text || "—";
}

function PlanogramComplianceCard({ data }: { data: ScanResult }) {
  const pg = data.planogram;
  if (!pg?.requested) return null;

  const configured = pg.summary?.configured_rows;
  const rows = Array.isArray(configured) ? (configured as PlanogramRow[]) : [];

  return (
    <div className="card-surface overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">Your planogram</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Expected products you configured for this scan
          </p>
        </div>
        {pg.sku_match_percent != null ? (
          <Badge variant="secondary" className="rounded-full tabular-nums">
            {Math.round(pg.sku_match_percent)}% match
          </Badge>
        ) : null}
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-3 text-sm text-muted-foreground">
          Add a planogram row in the setup panel before scanning.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-surface text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                {PLANOGRAM_DISPLAY_COLUMNS.map((col) => (
                  <th key={col.key} className="whitespace-nowrap px-3 py-2 font-medium">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.match_key || `${row.brand}-${row.product_name}-${i}`} className="border-t border-border">
                  {PLANOGRAM_DISPLAY_COLUMNS.map((col) => (
                    <td key={col.key} className="whitespace-nowrap px-3 py-2">
                      {formatPlanogramCell(col.key, row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DemoInventoryCompact({ rows }: { rows: LandingScanResult["inventory"] }) {
  return (
    <div className="card-surface overflow-hidden">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold tracking-tight">Complete inventory</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{rows.length} SKU groups detected</p>
      </div>
      <div className="max-h-[min(420px,60vh)] overflow-auto">
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
