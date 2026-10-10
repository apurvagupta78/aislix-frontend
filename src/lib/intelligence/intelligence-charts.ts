/**
 * Charts Aislix can draw for an Intelligence report. Every value comes from stored audit data
 * (scan metrics, findings, detected products, digital audit lines). The AI only chooses which
 * charts fit the question and writes a one-line takeaway; it never supplies the numbers.
 */

import { AISLIX_PALETTE } from "@/lib/ai-audit/kpi-palette";

export type IntelligenceChartType = "bar" | "stacked_bar" | "donut" | "line";
export type IntelligenceChartUnit = "%" | "score" | "count" | "facings" | "inr";

export type IntelligenceChart = {
  id: string;
  title: string;
  /** What the chart shows, given to the AI so it can choose. */
  about: string;
  type: IntelligenceChartType;
  unit: IntelligenceChartUnit;
  series: Array<{ key: string; label: string; color: string }>;
  data: Array<Record<string, string | number>>;
  caption?: string;
};

type Row = Record<string, unknown>;

export type ChartSourceAudit = {
  label: string;
  date: string;
  storeId: string;
  storeName: string;
  mode: "ai" | "digital";
  scan: Row;
  /** AI audit metrics (scan_results.metrics); scan columns only hold confirmed counts. */
  metrics?: Row;
};

export type ChartSources = {
  audits: ChartSourceAudit[];
  findings: Row[];
  products: Row[];
  lines: Row[];
};

const FINDING_LABELS: Record<string, string> = {
  inventory_shortage: "Inventory shortage",
  inventory_excess: "Inventory excess",
  out_of_stock: "Out of stock",
  low_stock: "Low stock",
  wrong_placement: "Wrong placement",
  planogram_violation: "Planogram violation",
  pricing_issue: "Pricing issue",
  damaged_product: "Damaged product",
  expired_product: "Expired product",
  near_expiry: "Near expiry",
  missing_product: "Missing product",
  receiving_issue: "Receiving issue",
  display_issue: "Display issue",
  shelf_execution_issue: "Shelf execution issue",
  other: "Other",
};

const SEVERITY_ORDER = ["critical", "high", "medium", "low"] as const;
const SEVERITY_COLOR: Record<string, string> = {
  critical: AISLIX_PALETTE.pink,
  high: AISLIX_PALETTE.purple,
  medium: AISLIX_PALETTE.blue,
  low: AISLIX_PALETTE.grey,
};

const UNIDENTIFIED = /^(unknown|unidentified|n\/?a|none|null|unbranded|generic|other)$/i;
const TOP_N = 10;

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function round(n: number, digits = 1): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

function countBy(rows: Row[], key: (r: Row) => string | null): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of rows) {
    const k = key(r);
    if (!k) continue;
    out.set(k, (out.get(k) ?? 0) + 1);
  }
  return out;
}

function topEntries(map: Map<string, number>, n = TOP_N, byAbs = false): Array<[string, number]> {
  return [...map.entries()]
    .filter(([, v]) => v !== 0)
    .sort((a, b) => (byAbs ? Math.abs(b[1]) - Math.abs(a[1]) : b[1] - a[1]))
    .slice(0, n);
}

function perAuditMetric(
  audits: ChartSourceAudit[],
  id: string,
  title: string,
  about: string,
  unit: IntelligenceChartUnit,
  read: (a: ChartSourceAudit) => number | null,
): IntelligenceChart | null {
  const data = audits
    .map((a) => ({ label: a.label, value: read(a) }))
    .filter((d): d is { label: string; value: number } => d.value !== null)
    .map((d) => ({ label: d.label, value: round(d.value) }));
  if (!data.length || data.every((d) => d.value === 0)) return null;
  return { id, title, about, type: "bar", unit, series: [{ key: "value", label: title, color: "" }], data };
}

export function buildIntelligenceCharts(src: ChartSources): IntelligenceChart[] {
  const charts: IntelligenceChart[] = [];
  const push = (c: IntelligenceChart | null) => {
    if (c) charts.push(c);
  };
  const ai = src.audits.filter((a) => a.mode === "ai");

  push(
    perAuditMetric(
      src.audits,
      "availability_by_audit",
      "On-shelf availability by audit",
      "On-shelf availability % for each selected audit.",
      "%",
      (a) => num(a.scan.osa_percent),
    ),
  );
  push(
    perAuditMetric(
      ai,
      "shelf_health_by_audit",
      "Shelf health score by audit",
      "Shelf health score (0-100) for each selected AI audit.",
      "score",
      (a) => num(a.scan.shelf_health_score),
    ),
  );
  push(
    perAuditMetric(
      src.audits,
      "planogram_by_audit",
      "Planogram compliance by audit",
      "Planogram compliance % for each selected audit that was compared with a planogram.",
      "%",
      (a) => num(a.scan.planogram_compliance_percent),
    ),
  );

  const byStore = new Map<string, ChartSourceAudit[]>();
  for (const a of src.audits) {
    if (num(a.scan.osa_percent) === null) continue;
    const list = byStore.get(a.storeId) ?? [];
    list.push(a);
    byStore.set(a.storeId, list);
  }
  const trendStore = [...byStore.values()]
    .filter((list) => new Set(list.map((a) => a.date)).size >= 3)
    .sort((x, y) => y.length - x.length)[0];
  if (trendStore) {
    const data = [...trendStore]
      .sort((x, y) => x.date.localeCompare(y.date))
      .map((a) => ({ label: a.date, value: round(num(a.scan.osa_percent)!) }));
    charts.push({
      id: "availability_trend",
      title: `Availability over time · ${trendStore[0]!.storeName}`,
      about: `On-shelf availability % over time for ${trendStore[0]!.storeName} (the store with the most selected audits).`,
      type: "line",
      unit: "%",
      series: [{ key: "value", label: "Availability", color: "" }],
      data,
    });
  }

  const stockData = ai
    .map((a) => ({
      label: a.label,
      oos: num(a.scan.out_of_stock_count) || num(a.metrics?.confirmed_oos_count) || 0,
      possible: num(a.metrics?.possible_oos_count) ?? 0,
      low: num(a.scan.low_stock_count) ?? 0,
      misplaced: num(a.scan.misplaced_count) ?? 0,
    }))
    .filter((d) => d.oos + d.possible + d.low + d.misplaced > 0);
  if (stockData.length) {
    const series = [
      { key: "oos", label: "Out of stock", color: AISLIX_PALETTE.pink },
      { key: "possible", label: "Possibly out of stock", color: AISLIX_PALETTE.grey },
      { key: "low", label: "Low stock", color: AISLIX_PALETTE.cyan },
      { key: "misplaced", label: "Misplaced", color: AISLIX_PALETTE.purple },
    ].filter((s) => stockData.some((d) => d[s.key as "oos"] > 0));
    charts.push({
      id: "stock_issues_by_audit",
      title: "Stock problems by audit",
      about:
        "Confirmed out-of-stock, possibly out-of-stock, low-stock and misplaced product counts for each selected AI audit.",
      type: "stacked_bar",
      unit: "count",
      series,
      data: stockData,
    });
  }

  const byType = topEntries(countBy(src.findings, (f) => (f.finding_type ? String(f.finding_type) : null)));
  if (byType.length) {
    charts.push({
      id: "findings_by_type",
      title: "Findings by problem type",
      about: "Number of findings of each problem type across the selected audits.",
      type: "bar",
      unit: "count",
      series: [{ key: "value", label: "Findings", color: "" }],
      data: byType.map(([k, v]) => ({ label: FINDING_LABELS[k] ?? k.replace(/_/g, " "), value: v })),
    });
  }

  const bySeverity = countBy(src.findings, (f) => (f.severity ? String(f.severity) : null));
  const severityData = SEVERITY_ORDER.filter((s) => (bySeverity.get(s) ?? 0) > 0).map((s) => ({
    label: s[0]!.toUpperCase() + s.slice(1),
    value: bySeverity.get(s)!,
    color: SEVERITY_COLOR[s]!,
  }));
  if (severityData.length >= 2) {
    charts.push({
      id: "findings_by_severity",
      title: "Findings by priority",
      about: "How the findings across the selected audits split by priority (critical, high, medium, low).",
      type: "donut",
      unit: "count",
      series: severityData.map((d) => ({ key: d.label, label: d.label, color: d.color })),
      data: severityData.map(({ label, value }) => ({ label, value })),
    });
  }

  const byProduct = topEntries(
    countBy(src.findings, (f) => {
      const name = String(f.product_name ?? "").trim();
      return name && !/^unidentified items$/i.test(name) ? name : null;
    }),
  );
  if (byProduct.length >= 2) {
    charts.push({
      id: "top_problem_products",
      title: "Products with the most findings",
      about: "Products named in the most findings across the selected audits (top 10).",
      type: "bar",
      unit: "count",
      series: [{ key: "value", label: "Findings", color: "" }],
      data: byProduct.map(([label, value]) => ({ label, value })),
    });
  }

  const brandFacings = new Map<string, number>();
  for (const p of src.products) {
    const brand = String(p.brand ?? "").trim();
    const facings = num(p.facings);
    if (!brand || UNIDENTIFIED.test(brand) || facings === null || facings <= 0) continue;
    brandFacings.set(brand, (brandFacings.get(brand) ?? 0) + facings);
  }
  const brands = topEntries(brandFacings);
  if (brands.length >= 2) {
    charts.push({
      id: "brand_facings",
      title: "Brands by shelf facings",
      about: "Total AI-counted facings per brand across the selected AI audits (top 10).",
      type: "bar",
      unit: "facings",
      series: [{ key: "value", label: "Facings", color: "" }],
      data: brands.map(([label, value]) => ({ label, value })),
    });
  }

  const variance = new Map<string, number>();
  for (const l of src.lines) {
    const name = String(l.product_name ?? l.sku ?? "").trim();
    const value = num(l.variance_value_inr);
    if (!name || value === null || value === 0) continue;
    variance.set(name, (variance.get(name) ?? 0) + value);
  }
  const varianceTop = topEntries(variance, TOP_N, true);
  if (varianceTop.length) {
    charts.push({
      id: "variance_value_by_product",
      title: "Stock variance value by product",
      about: "Stock variance value in ₹ per product from the selected Digital audits (largest 10, negative = shortage).",
      type: "bar",
      unit: "inr",
      series: [{ key: "value", label: "Variance (₹)", color: "" }],
      data: varianceTop.map(([label, value]) => ({ label, value: round(value, 0) })),
    });
  }

  return charts;
}

export const MAX_REPORT_CHARTS = 4;

/** The AI ends its report with a fenced `aislix-charts` JSON list; pull it out and keep valid picks. */
export function extractChartPicks(
  report: string,
  catalog: IntelligenceChart[],
): { text: string; found: boolean; picks: Array<{ id: string; caption?: string }> } {
  const re = /```aislix-charts\s*([\s\S]*?)```/i;
  const m = re.exec(report);
  const text = report.replace(re, "").trim();
  if (!m) return { text, found: false, picks: [] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(m[1]!.trim());
  } catch {
    return { text, found: false, picks: [] };
  }
  const known = new Set(catalog.map((c) => c.id));
  const seen = new Set<string>();
  const picks: Array<{ id: string; caption?: string }> = [];
  for (const item of Array.isArray(parsed) ? parsed : []) {
    if (!item || typeof item !== "object") continue;
    const id = String((item as Row).chart ?? (item as Row).id ?? "");
    if (!known.has(id) || seen.has(id)) continue;
    seen.add(id);
    const caption = String((item as Row).caption ?? "").trim().slice(0, 240);
    picks.push(caption ? { id, caption } : { id });
    if (picks.length >= MAX_REPORT_CHARTS) break;
  }
  return { text, found: true, picks };
}

export function isIntelligenceChart(value: unknown): value is IntelligenceChart {
  if (!value || typeof value !== "object") return false;
  const v = value as Row;
  return typeof v.id === "string" && typeof v.title === "string" && Array.isArray(v.data) && Array.isArray(v.series);
}
