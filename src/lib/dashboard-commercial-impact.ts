/**
 * Workspace dashboard — commercial impact aggregation from filtered audit metrics.
 * Sums eligible financial exposure only; never fabricates revenue estimates.
 */

import type { FinancialImpact } from "@/lib/scan-results";
import type { RetailIntelligencePayload } from "@/lib/retail-intelligence";

export type CommercialIssueCategory = "availability" | "pricing" | "facing_gaps" | "promotions";

export type CommercialExposureByIssue = {
  category: CommercialIssueCategory;
  label: string;
  daily_exposure_inr: number;
  audit_ids: string[];
};

export type CommercialProductExposure = {
  product: string;
  brand: string;
  daily_exposure_inr: number;
  scan_id: string;
};

export type CommercialTrendPoint = {
  date_label: string;
  date_iso: string;
  scan_id: string;
  store_name: string;
  daily_exposure_inr: number;
};

export type CommercialImpactDashboardData = {
  visible: boolean;
  daily_exposure_inr: number;
  weekly_exposure_inr: number;
  monthly_exposure_inr: number;
  audits_with_estimate: number;
  total_eligible_audits: number;
  by_issue: CommercialExposureByIssue[];
  by_product: CommercialProductExposure[];
  trend: CommercialTrendPoint[];
  has_trend: boolean;
  detail_rows: Array<{
    scan_id: string;
    date_iso: string;
    store_name: string;
    issue: string;
    brand: string;
    product: string;
    daily_exposure_inr: number;
    category: CommercialIssueCategory;
  }>;
};

type ScanRef = {
  id: string;
  created_at: string;
  stores?: { name?: string | null } | null;
};

const ISSUE_LABELS: Record<CommercialIssueCategory, string> = {
  availability: "Availability",
  pricing: "Pricing",
  facing_gaps: "Facing gaps",
  promotions: "Promotions",
};

function formatDayLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function isEligibleFinancialImpact(fi: FinancialImpact): boolean {
  if (fi.estimate_status === "not_estimated") return false;
  const level = fi.level ?? (fi.estimated_daily_lost_sales_inr > 0 ? 2 : 1);
  return level >= 2 && fi.estimated_daily_lost_sales_inr > 0;
}

function categorizeIssue(issue: string): CommercialIssueCategory {
  const t = issue.toLowerCase();
  if (t.includes("price") || t.includes("mrp")) return "pricing";
  if (t.includes("promo")) return "promotions";
  if (t.includes("facing") || t.includes("facings") || t.includes("qty")) return "facing_gaps";
  return "availability";
}

export function buildCommercialImpactData(
  audits: ScanRef[],
  metricsMap: Map<string, RetailIntelligencePayload | null>,
): CommercialImpactDashboardData | null {
  let dailyTotal = 0;
  let weeklyTotal = 0;
  let monthlyTotal = 0;
  let auditsWithEstimate = 0;

  const issueMap = new Map<CommercialIssueCategory, { amount: number; auditIds: Set<string> }>();
  const productMap = new Map<string, CommercialProductExposure>();
  const trend: CommercialTrendPoint[] = [];
  const detail_rows: CommercialImpactDashboardData["detail_rows"] = [];

  for (const scan of audits) {
    const metrics = metricsMap.get(scan.id) ?? null;
    const fi = metrics?.financial_impact;
    if (!fi || !isEligibleFinancialImpact(fi)) continue;

    auditsWithEstimate += 1;
    dailyTotal += fi.estimated_daily_lost_sales_inr;
    weeklyTotal += fi.estimated_weekly_lost_sales_inr;
    monthlyTotal += fi.estimated_monthly_lost_sales_inr;

    trend.push({
      date_label: formatDayLabel(scan.created_at),
      date_iso: scan.created_at,
      scan_id: scan.id,
      store_name: scan.stores?.name ?? "—",
      daily_exposure_inr: fi.estimated_daily_lost_sales_inr,
    });

    const ledger = metrics?.opportunity_ledger ?? [];
    const ledgerWithRevenue = ledger.filter(
      (r) => typeof r.revenue_at_risk_inr === "number" && r.revenue_at_risk_inr > 0,
    );

    if (ledgerWithRevenue.length) {
      for (const row of ledgerWithRevenue) {
        const issue = row.issue ?? "Availability";
        const category = categorizeIssue(issue);
        const amount = row.revenue_at_risk_inr ?? 0;
        const prev = issueMap.get(category) ?? { amount: 0, auditIds: new Set<string>() };
        prev.amount += amount;
        prev.auditIds.add(scan.id);
        issueMap.set(category, prev);

        const product = row.sku ?? row.issue ?? "Product";
        const brand = row.brand ?? "—";
        const key = `${scan.id}|${brand}|${product}`;
        const existing = productMap.get(key);
        if (existing) {
          existing.daily_exposure_inr += amount;
        } else {
          productMap.set(key, {
            product,
            brand,
            daily_exposure_inr: amount,
            scan_id: scan.id,
          });
        }

        detail_rows.push({
          scan_id: scan.id,
          date_iso: scan.created_at,
          store_name: scan.stores?.name ?? "—",
          issue,
          brand,
          product,
          daily_exposure_inr: amount,
          category,
        });
      }
    } else {
      const category: CommercialIssueCategory = "availability";
      const prev = issueMap.get(category) ?? { amount: 0, auditIds: new Set<string>() };
      prev.amount += fi.estimated_daily_lost_sales_inr;
      prev.auditIds.add(scan.id);
      issueMap.set(category, prev);

      detail_rows.push({
        scan_id: scan.id,
        date_iso: scan.created_at,
        store_name: scan.stores?.name ?? "—",
        issue: "Shelf availability exposure",
        brand: "—",
        product: "—",
        daily_exposure_inr: fi.estimated_daily_lost_sales_inr,
        category,
      });
    }
  }

  if (auditsWithEstimate === 0) return null;

  const by_issue: CommercialExposureByIssue[] = [...issueMap.entries()]
    .map(([category, v]) => ({
      category,
      label: ISSUE_LABELS[category],
      daily_exposure_inr: Math.round(v.amount),
      audit_ids: [...v.auditIds],
    }))
    .filter((r) => r.daily_exposure_inr > 0)
    .sort((a, b) => b.daily_exposure_inr - a.daily_exposure_inr);

  const by_product = [...productMap.values()]
    .sort((a, b) => b.daily_exposure_inr - a.daily_exposure_inr)
    .slice(0, 12);

  const sortedTrend = [...trend].sort(
    (a, b) => new Date(a.date_iso).getTime() - new Date(b.date_iso).getTime(),
  );

  return {
    visible: true,
    daily_exposure_inr: Math.round(dailyTotal),
    weekly_exposure_inr: Math.round(weeklyTotal),
    monthly_exposure_inr: Math.round(monthlyTotal),
    audits_with_estimate: auditsWithEstimate,
    total_eligible_audits: audits.length,
    by_issue,
    by_product,
    trend: sortedTrend,
    has_trend: sortedTrend.length >= 3,
    detail_rows,
  };
}

export function exportCommercialImpactCsv(data: CommercialImpactDashboardData): void {
  const headers = [
    "Audit ID",
    "Audit Date",
    "Store",
    "Issue Category",
    "Issue",
    "Brand",
    "Product",
    "Daily Exposure INR",
  ];
  const lines = data.detail_rows.map((row) =>
    [
      row.scan_id,
      row.date_iso,
      row.store_name,
      ISSUE_LABELS[row.category],
      row.issue,
      row.brand,
      row.product,
      row.daily_exposure_inr,
    ]
      .map((c) => {
        const s = String(c);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      })
      .join(","),
  );
  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `aislix-commercial-impact-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
