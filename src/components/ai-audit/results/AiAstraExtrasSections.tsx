import { AiAuditCard } from "@/components/ai-audit/results/AiAuditUi";
import { Badge } from "@/components/ui/badge";
import type { AstraOutputExtras } from "@/lib/ai-audit/astra-display";
import type { ScanAlert, ScanRecommendation, ScanResult } from "@/lib/scan-results";
import { cn } from "@/lib/utils";

function severityClass(severity: string) {
  const s = severity.toUpperCase();
  if (s === "HIGH" || s === "CRITICAL") return "border-rose-500/40 text-rose-700";
  if (s === "MEDIUM") return "border-amber-500/40 text-amber-700";
  return "border-border text-muted-foreground";
}

export function AiImageQualityBanner({ extras }: { extras: AstraOutputExtras }) {
  const iq = extras.image_quality;
  if (!iq?.status) return null;
  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3 text-sm",
        iq.status === "GOOD" && "border-emerald-500/30 bg-emerald-500/5",
        iq.status === "LIMITED" && "border-amber-500/30 bg-amber-500/5",
        iq.status === "POOR" && "border-rose-500/30 bg-rose-500/5",
      )}
    >
      <p className="font-medium">Image quality: {iq.status}</p>
      {iq.reason ? <p className="mt-1 text-xs text-muted-foreground">{iq.reason}</p> : null}
    </div>
  );
}

export function AiAstraPricesSection({ extras }: { extras: AstraOutputExtras }) {
  if (!extras.visible_prices.length) return null;
  return (
    <AiAuditCard title="Visible prices" description="Prices read from shelf labels (Astra)">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-xs">
          <thead className="text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="pb-2 pr-3">Product</th>
              <th className="pb-2 pr-3">Price</th>
              <th className="pb-2">Confidence</th>
            </tr>
          </thead>
          <tbody>
            {extras.visible_prices.map((row, i) => (
              <tr key={`price-${i}`} className="border-t border-border/60">
                <td className="py-2 pr-3 font-medium">{row.product_name ?? "—"}</td>
                <td className="py-2 pr-3">{row.price ?? "—"}</td>
                <td className="py-2 tabular-nums">
                  {row.confidence != null
                    ? `${Math.round(row.confidence <= 1 ? row.confidence * 100 : row.confidence)}%`
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AiAuditCard>
  );
}

export function AiAstraPromotionsSection({ extras }: { extras: AstraOutputExtras }) {
  if (!extras.visible_promotions.length) return null;
  return (
    <AiAuditCard title="Visible promotions" description="Promotional messaging detected on shelf">
      <ul className="space-y-2">
        {extras.visible_promotions.map((row, i) => (
          <li key={`promo-${i}`} className="rounded-lg border border-border/70 px-3 py-2 text-sm">
            <p className="font-medium">{row.product_or_brand ?? "Promotion"}</p>
            <p className="mt-1 text-muted-foreground">{row.promotion_text ?? "—"}</p>
            {row.confidence != null ? (
              <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">
                Confidence{" "}
                {Math.round(row.confidence <= 1 ? row.confidence * 100 : row.confidence)}%
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </AiAuditCard>
  );
}

export function AiAstraShelfIssuesSection({ extras }: { extras: AstraOutputExtras }) {
  if (!extras.shelf_issues.length) return null;
  return (
    <AiAuditCard title="Shelf issues" description="Issues flagged by Astra on this fixture">
      <ul className="space-y-2">
        {extras.shelf_issues.map((row, i) => (
          <li key={`issue-${i}`} className="rounded-lg border border-border/70 px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">{row.issue_type ?? "Issue"}</span>
              {row.severity ? (
                <Badge variant="outline" className={severityClass(row.severity)}>
                  {row.severity}
                </Badge>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{row.description ?? "—"}</p>
          </li>
        ))}
      </ul>
    </AiAuditCard>
  );
}

export function AiAlertsSection({ alerts }: { alerts?: ScanAlert[] }) {
  if (!alerts?.length) return null;
  return (
    <AiAuditCard title="Alerts" description="Actionable alerts from this audit">
      <ul className="space-y-2">
        {alerts.map((alert) => (
          <li key={alert.id} className="rounded-lg border border-border/70 px-3 py-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{alert.severity}</Badge>
              <span className="text-sm font-medium">{alert.title}</span>
            </div>
            {alert.detail ? (
              <p className="mt-1 text-sm text-muted-foreground">{alert.detail}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </AiAuditCard>
  );
}

export function AiRecommendationsSection({ items }: { items?: ScanRecommendation[] }) {
  if (!items?.length) return null;
  return (
    <AiAuditCard title="Recommendations" description="Suggested next steps from Astra">
      <ul className="space-y-2">
        {items.map((rec) => (
          <li key={rec.id} className="rounded-lg border border-border/70 px-3 py-2">
            <p className="text-sm font-medium">{rec.title}</p>
            {rec.detail ? <p className="mt-1 text-sm text-muted-foreground">{rec.detail}</p> : null}
            {rec.impact ? (
              <p className="mt-1 text-[11px] text-muted-foreground">Impact: {rec.impact}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </AiAuditCard>
  );
}

export function AiRoleSummariesSection({
  summaries,
}: {
  summaries?: ScanResult["role_summaries"];
}) {
  if (!summaries || !Object.values(summaries).some(Boolean)) return null;
  const entries = Object.entries(summaries).filter(([, v]) => v);
  return (
    <AiAuditCard title="Role summaries" description="Astra summaries by stakeholder role">
      <div className="grid gap-3 sm:grid-cols-2">
        {entries.map(([role, text]) => (
          <div key={role} className="rounded-lg border border-border/70 px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              {role}
            </p>
            <p className="mt-1 text-sm leading-relaxed">{text}</p>
          </div>
        ))}
      </div>
    </AiAuditCard>
  );
}

export function AiFinancialImpactSection({
  impact,
}: {
  impact?: ScanResult["financial_impact"];
}) {
  if (!impact) return null;
  return (
    <AiAuditCard title="Financial impact" description={impact.methodology}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <AiMetricInline label="Daily at risk" value={`₹${impact.estimated_daily_lost_sales_inr}`} />
        <AiMetricInline label="Weekly at risk" value={`₹${impact.estimated_weekly_lost_sales_inr}`} />
        <AiMetricInline label="OOS SKUs" value={impact.oos_sku_count} />
        <AiMetricInline label="Status" value={impact.estimate_status ?? impact.confidence} />
      </div>
    </AiAuditCard>
  );
}

function AiMetricInline({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export function AiComplianceAlertsSection({
  alerts,
}: {
  alerts?: ScanResult["compliance_alerts"];
}) {
  if (!alerts?.length) return null;
  return (
    <AiAuditCard title="Compliance alerts" description="Placement and category issues detected">
      <ul className="space-y-2">
        {alerts.map((alert) => (
          <li key={alert.id} className="rounded-lg border border-border/70 px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{alert.severity}</Badge>
              <span className="text-sm font-medium">{alert.title}</span>
            </div>
            {alert.interpretation ? (
              <p className="mt-1 text-sm text-muted-foreground">{alert.interpretation}</p>
            ) : null}
            {alert.detail ? (
              <p className="mt-1 text-xs text-muted-foreground">{alert.detail}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </AiAuditCard>
  );
}

export function AiSubcategoryMismatchesSection({
  items,
}: {
  items?: ScanResult["subcategory_mismatches"];
}) {
  if (!items?.length) return null;
  return (
    <AiAuditCard title="Sub-category mismatches" description="Products outside the audited sub-category">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-xs">
          <thead className="text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="pb-2 pr-3">Brand</th>
              <th className="pb-2 pr-3">Product</th>
              <th className="pb-2 pr-3">Detected</th>
              <th className="pb-2 pr-3">Expected</th>
              <th className="pb-2">Qty</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row, i) => (
              <tr key={`mismatch-${i}`} className="border-t border-border/60">
                <td className="py-2 pr-3">{row.brand}</td>
                <td className="py-2 pr-3">{row.product_name}</td>
                <td className="py-2 pr-3">{row.detected_sub_category_label}</td>
                <td className="py-2 pr-3">{row.expected_sub_category_label}</td>
                <td className="py-2 tabular-nums">{row.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AiAuditCard>
  );
}

export function AiAstraOutputSections({ result, extras }: { result: ScanResult; extras: AstraOutputExtras }) {
  return (
    <>
      <AiImageQualityBanner extras={extras} />
      <AiAstraPricesSection extras={extras} />
      <AiAstraPromotionsSection extras={extras} />
      <AiAstraShelfIssuesSection extras={extras} />
      <AiComplianceAlertsSection alerts={result.compliance_alerts} />
      <AiSubcategoryMismatchesSection items={result.subcategory_mismatches} />
      <AiAlertsSection alerts={result.alerts} />
      <AiRecommendationsSection items={result.recommendations} />
      <AiRoleSummariesSection summaries={result.role_summaries} />
      <AiFinancialImpactSection impact={result.financial_impact} />
    </>
  );
}
