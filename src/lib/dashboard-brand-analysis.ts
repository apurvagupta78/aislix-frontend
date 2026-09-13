/**
 * Workspace dashboard — brand analysis aggregation from filtered audits.
 * Uses existing weighted KPI rollups; does not invent shelf-share formulas.
 */

import { aggregateWeightedKpi, averageConfiguredTarget } from "@/lib/dashboard-kpi-aggregation";
import { normalizePercent } from "@/lib/dashboard";
import type { AuditKpiId } from "@/lib/role-kpi-config";
import type { AuditRoleTab } from "@/lib/role-audit-ui";
import type { RetailIntelligencePayload } from "@/lib/retail-intelligence";

export type BrandShareSegment = {
  brand: string;
  share: number;
  is_primary: boolean;
  is_other_bucket?: boolean;
};

export type BrandAnalysisKpiCard = {
  key: string;
  label: string;
  description: string;
  value: number | null;
  unit: "percent" | "count";
  available: boolean;
  unavailable_reason: string | null;
};

export type BrandRankingRow = {
  brand: string;
  value: number;
  is_primary: boolean;
  scan_id: string | null;
};

export type BrandTrendPoint = {
  date_label: string;
  date_iso: string;
  scan_id: string;
  store_name: string;
  actual_share: number | null;
  target_share: number | null;
};

export type BrandAnalysisData = {
  visible: boolean;
  target_brand: string | null;
  kpi_cards: BrandAnalysisKpiCard[];
  share_segments: BrandShareSegment[];
  mix_segments: BrandShareSegment[];
  ranking: BrandRankingRow[];
  ranking_metric_label: string;
  trend: BrandTrendPoint[];
  detail_rows: Array<{
    scan_id: string;
    date_iso: string;
    store_name: string;
    brand: string;
    share: number;
    is_primary: boolean;
  }>;
};

type ScanRef = {
  id: string;
  created_at: string;
  share_of_shelf_percent?: number | null;
  stores?: { name?: string | null } | null;
};

function parseShareFromNote(note: string): number | null {
  const match = note.match(/(\d+(?:\.\d+)?)\s*%/);
  return match ? Number(match[1]) : null;
}

function formatDayLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function rollupPercent(
  scans: ScanRef[],
  metricsMap: Map<string, RetailIntelligencePayload | null>,
  role: AuditRoleTab,
  kpiId: AuditKpiId,
): number | null {
  const rollup = aggregateWeightedKpi(scans, metricsMap, role, kpiId);
  return rollup.percent !== null ? Math.round(rollup.percent) : null;
}

function extractSegmentsFromAudit(
  metrics: RetailIntelligencePayload | null,
  scan: ScanRef,
): BrandShareSegment[] {
  const insights = metrics?.competitive_insights ?? [];
  if (insights.length) {
    const segments: BrandShareSegment[] = [];
    for (const [i, row] of insights.entries()) {
      const share = parseShareFromNote(row.share_note ?? "");
      if (share === null) continue;
      segments.push({
        brand: row.brand ?? (i === 0 ? "Your Brand" : `Competitor ${i}`),
        share,
        is_primary: i === 0,
      });
    }
    if (segments.length) return segments;
  }

  const linear = metrics?.linear_shelf_share;
  const facings = metrics?.share_of_facings;
  const metric =
    linear && typeof linear === "object" && "value" in linear
      ? (linear as { value?: number }).value
      : facings && typeof facings === "object" && "value" in facings
        ? (facings as { value?: number }).value
        : scan.share_of_shelf_percent;

  if (typeof metric !== "number") return [];
  const primary = Math.round(normalizePercent(metric) ?? metric);
  return [
    { brand: "Your Brand", share: primary, is_primary: true },
    { brand: "Competitors", share: Math.max(0, 100 - primary), is_primary: false },
  ];
}

function aggregateBrandSegments(
  audits: ScanRef[],
  metricsMap: Map<string, RetailIntelligencePayload | null>,
): { segments: BrandShareSegment[]; detail_rows: BrandAnalysisData["detail_rows"]; target_brand: string | null } {
  const brandTotals = new Map<
    string,
    { shareSum: number; count: number; is_primary: boolean; scan_id: string }
  >();
  const detail_rows: BrandAnalysisData["detail_rows"] = [];
  let targetBrand: string | null = null;

  for (const scan of audits) {
    const metrics = metricsMap.get(scan.id) ?? null;
    const segments = extractSegmentsFromAudit(metrics, scan);
    const storeName = scan.stores?.name ?? "—";
    for (const seg of segments) {
      if (seg.is_primary && seg.brand !== "Your Brand") targetBrand = seg.brand;
      detail_rows.push({
        scan_id: scan.id,
        date_iso: scan.created_at,
        store_name: storeName,
        brand: seg.brand,
        share: seg.share,
        is_primary: seg.is_primary,
      });
      const prev = brandTotals.get(seg.brand) ?? {
        shareSum: 0,
        count: 0,
        is_primary: seg.is_primary,
        scan_id: scan.id,
      };
      prev.shareSum += seg.share;
      prev.count += 1;
      if (seg.is_primary) prev.is_primary = true;
      brandTotals.set(seg.brand, prev);
    }
  }

  const averaged = [...brandTotals.entries()]
    .map(([brand, v]) => ({
      brand,
      share: Math.round((v.shareSum / v.count) * 10) / 10,
      is_primary: v.is_primary,
      scan_id: v.scan_id,
    }))
    .sort((a, b) => b.share - a.share);

  return { segments: averaged, detail_rows, target_brand: targetBrand };
}

function buildMixSegments(segments: BrandShareSegment[]): BrandShareSegment[] {
  if (!segments.length) return [];
  const primary = segments.find((s) => s.is_primary) ?? segments[0]!;
  const competitors = segments.filter((s) => !s.is_primary && !s.is_other_bucket);
  const top1 = competitors[0];
  const top2 = competitors[1];
  const used = new Set([primary.brand, top1?.brand, top2?.brand].filter(Boolean));
  const othersShare = segments
    .filter((s) => !used.has(s.brand))
    .reduce((sum, s) => sum + s.share, 0);

  const mix: BrandShareSegment[] = [{ ...primary, brand: primary.brand === "Your Brand" ? "Your Brand" : primary.brand }];
  if (top1) mix.push({ ...top1, is_primary: false });
  if (top2) mix.push({ ...top2, is_primary: false });
  if (othersShare > 0.05) {
    mix.push({
      brand: "Others",
      share: Math.round(othersShare * 10) / 10,
      is_primary: false,
      is_other_bucket: true,
    });
  }
  return mix;
}

function buildKpiCards(
  audits: ScanRef[],
  metricsMap: Map<string, RetailIntelligencePayload | null>,
  role: AuditRoleTab,
): BrandAnalysisKpiCard[] {
  const cards: BrandAnalysisKpiCard[] = [];

  const sos = rollupPercent(audits, metricsMap, role, "share_of_shelf");
  cards.push({
    key: "share_of_shelf",
    label: "Share of Shelf",
    description: "Average shelf space owned",
    value: sos,
    unit: "percent",
    available: sos !== null,
    unavailable_reason: sos === null ? "Not enough data" : null,
  });

  const osa = rollupPercent(audits, metricsMap, role, "osa");
  cards.push({
    key: "brand_availability",
    label: "Brand Availability",
    description: "Your products visibly available",
    value: osa,
    unit: "percent",
    available: osa !== null,
    unavailable_reason: osa === null ? "Not enough data" : null,
  });

  const facing = rollupPercent(audits, metricsMap, role, "facing_count");
  cards.push({
    key: "facing_share",
    label: "Facing Share",
    description: "Share of visible facings",
    value: facing,
    unit: "percent",
    available: facing !== null,
    unavailable_reason: facing === null ? "Not enough data" : null,
  });

  const promo = rollupPercent(audits, metricsMap, role, "promotional_compliance");
  cards.push({
    key: "promotion_compliance",
    label: "Promotion Compliance",
    description: "Promotions executed as expected",
    value: promo,
    unit: "percent",
    available: promo !== null,
    unavailable_reason: promo === null ? "Not assessable" : null,
  });

  return cards.filter((c) => c.available);
}

function buildTrend(
  audits: ScanRef[],
  metricsMap: Map<string, RetailIntelligencePayload | null>,
  role: AuditRoleTab,
): BrandTrendPoint[] {
  const target = averageConfiguredTarget(audits, metricsMap, "share_of_shelf");
  return audits
    .filter((scan) => {
      const metrics = metricsMap.get(scan.id);
      const segments = extractSegmentsFromAudit(metrics ?? null, scan);
      return segments.some((s) => s.is_primary);
    })
    .map((scan) => {
      const metrics = metricsMap.get(scan.id) ?? null;
      const primary = extractSegmentsFromAudit(metrics, scan).find((s) => s.is_primary);
      return {
        date_label: formatDayLabel(scan.created_at),
        date_iso: scan.created_at,
        scan_id: scan.id,
        store_name: scan.stores?.name ?? "—",
        actual_share: primary?.share ?? null,
        target_share: target !== null ? Math.round(target) : null,
      };
    });
}

export function buildBrandAnalysisData(
  audits: ScanRef[],
  metricsMap: Map<string, RetailIntelligencePayload | null>,
  effectiveRole: AuditRoleTab,
): BrandAnalysisData | null {
  if (!audits.length) return null;

  const hasCompetitiveData = audits.some((scan) => {
    const metrics = metricsMap.get(scan.id);
    return (
      (metrics?.competitive_insights?.length ?? 0) > 0 ||
      typeof scan.share_of_shelf_percent === "number" ||
      metrics?.linear_shelf_share != null ||
      metrics?.share_of_facings != null
    );
  });

  if (effectiveRole !== "fmcg") return null;
  if (!hasCompetitiveData && !audits.length) return null;

  const kpi_cards = buildKpiCards(audits, metricsMap, effectiveRole);
  const { segments, detail_rows, target_brand } = aggregateBrandSegments(audits, metricsMap);
  const mix_segments = buildMixSegments(segments);
  const trend = buildTrend(audits, metricsMap, effectiveRole);

  const hasContent =
    kpi_cards.length > 0 || segments.length > 0 || trend.some((p) => p.actual_share !== null);
  if (!hasContent) return null;

  const ranking: BrandRankingRow[] = segments.map((s) => ({
    brand: s.brand,
    value: s.share,
    is_primary: s.is_primary,
    scan_id: detail_rows.find((d) => d.brand === s.brand)?.scan_id ?? null,
  }));

  return {
    visible: true,
    target_brand,
    kpi_cards,
    share_segments: segments,
    mix_segments,
    ranking,
    ranking_metric_label: "Share of shelf (%)",
    trend,
    detail_rows,
  };
}

export function exportBrandAnalysisCsv(data: BrandAnalysisData): void {
  const headers = [
    "Audit ID",
    "Audit Date",
    "Store",
    "Brand",
    "Share of Shelf %",
    "Is Primary Brand",
  ];
  const lines = data.detail_rows.map((row) =>
    [
      row.scan_id,
      row.date_iso,
      row.store_name,
      row.brand,
      row.share,
      row.is_primary ? "Yes" : "No",
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
  link.download = `aislix-brand-analysis-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
