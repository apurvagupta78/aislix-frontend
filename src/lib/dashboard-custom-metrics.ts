/**
 * User custom dashboard metrics (max 3 per tab) — catalog calc or Luna/GPT.
 */

import type { DashboardTabKey } from "@/lib/dashboard-layout";

export type CustomMetricMode = "catalog" | "luna";

export type CustomMetricSlotId = "custom_0" | "custom_1" | "custom_2";

export type CustomMetricDef = {
  id: CustomMetricSlotId;
  tab: DashboardTabKey;
  mode: CustomMetricMode;
  title: string;
  value: string;
  context?: string;
  catalogKey?: string;
  question?: string;
  auditIds: string[];
  updatedAt: string;
};

export const CUSTOM_METRIC_SLOTS: CustomMetricSlotId[] = ["custom_0", "custom_1", "custom_2"];

export const CATALOG_METRIC_OPTIONS: { key: string; label: string }[] = [
  { key: "avg_planogram", label: "Avg planogram compliance %" },
  { key: "completion_pct", label: "Completion %" },
  { key: "audit_count", label: "Audit count" },
  { key: "avg_confidence", label: "Avg confidence %" },
  { key: "open_findings", label: "Open findings (selected)" },
  { key: "total_facings", label: "Total facings" },
  { key: "top_brand_share", label: "Top brand share %" },
];

export type DashboardCustomMetricsPrefs = {
  items: CustomMetricDef[];
};

export function parseCustomMetrics(raw: unknown): DashboardCustomMetricsPrefs {
  if (!raw || typeof raw !== "object") return { items: [] };
  const items = (raw as { items?: unknown }).items;
  if (!Array.isArray(items)) return { items: [] };
  const out: CustomMetricDef[] = [];
  for (const row of items) {
    if (!row || typeof row !== "object") continue;
    const r = row as Partial<CustomMetricDef>;
    if (r.id !== "custom_0" && r.id !== "custom_1" && r.id !== "custom_2") continue;
    if (r.tab !== "ai" && r.tab !== "digital") continue;
    if (r.mode !== "catalog" && r.mode !== "luna") continue;
    out.push({
      id: r.id,
      tab: r.tab,
      mode: r.mode,
      title: String(r.title ?? "Custom metric"),
      value: String(r.value ?? "N/A"),
      context: r.context ? String(r.context) : undefined,
      catalogKey: r.catalogKey ? String(r.catalogKey) : undefined,
      question: r.question ? String(r.question) : undefined,
      auditIds: Array.isArray(r.auditIds) ? r.auditIds.map(String) : [],
      updatedAt: String(r.updatedAt ?? new Date().toISOString()),
    });
  }
  return { items: out };
}

export function nextFreeCustomSlot(
  items: CustomMetricDef[],
  tab: DashboardTabKey,
): CustomMetricSlotId | null {
  const used = new Set(items.filter((i) => i.tab === tab).map((i) => i.id));
  return CUSTOM_METRIC_SLOTS.find((id) => !used.has(id)) ?? null;
}

export type AuditMetricSource = {
  id: string;
  scorePct: number | null;
  completionStage: string;
  confidencePct?: number | null;
  findingsCount?: number | null;
  facings?: number | null;
  topBrandShare?: number | null;
};

/** Pure catalog computation — no invented zeros when all inputs null. */
export function computeCatalogMetric(
  key: string,
  audits: AuditMetricSource[],
): { title: string; value: string; context: string } {
  const label = CATALOG_METRIC_OPTIONS.find((o) => o.key === key)?.label ?? key;
  if (!audits.length) {
    return { title: label, value: "N/A", context: "Data unavailable — select audits first." };
  }
  const n = audits.length;

  if (key === "audit_count") {
    return { title: label, value: String(n), context: `From ${n} selected audits.` };
  }
  if (key === "completion_pct") {
    const done = audits.filter((a) => a.completionStage === "completed").length;
    return {
      title: label,
      value: `${Math.round((done / n) * 100)}%`,
      context: `${done} of ${n} completed.`,
    };
  }
  if (key === "avg_planogram") {
    const vals = audits.map((a) => a.scorePct).filter((v): v is number => v != null && Number.isFinite(v));
    if (!vals.length) return { title: label, value: "N/A", context: "Data unavailable" };
    const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
    return { title: label, value: `${avg.toFixed(1)}%`, context: `Avg across ${vals.length} scored audits.` };
  }
  if (key === "avg_confidence") {
    const vals = audits
      .map((a) => a.confidencePct)
      .filter((v): v is number => v != null && Number.isFinite(v));
    if (!vals.length) return { title: label, value: "N/A", context: "Data unavailable" };
    const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
    return { title: label, value: `${avg.toFixed(1)}%`, context: `Avg across ${vals.length} audits.` };
  }
  if (key === "open_findings") {
    const vals = audits
      .map((a) => a.findingsCount)
      .filter((v): v is number => v != null && Number.isFinite(v));
    if (!vals.length) return { title: label, value: "N/A", context: "Data unavailable" };
    const sum = vals.reduce((s, v) => s + v, 0);
    return { title: label, value: String(sum), context: `Sum across ${vals.length} audits.` };
  }
  if (key === "total_facings") {
    const vals = audits.map((a) => a.facings).filter((v): v is number => v != null && Number.isFinite(v));
    if (!vals.length) return { title: label, value: "N/A", context: "Data unavailable" };
    const sum = vals.reduce((s, v) => s + v, 0);
    return { title: label, value: String(Math.round(sum)), context: `Sum across ${vals.length} audits.` };
  }
  if (key === "top_brand_share") {
    const vals = audits
      .map((a) => a.topBrandShare)
      .filter((v): v is number => v != null && Number.isFinite(v));
    if (!vals.length) return { title: label, value: "N/A", context: "Data unavailable" };
    const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
    return { title: label, value: `${avg.toFixed(1)}%`, context: `Avg top-brand share across ${vals.length} audits.` };
  }
  return { title: label, value: "N/A", context: "Data unavailable" };
}
