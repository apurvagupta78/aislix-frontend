/**
 * Per-user dashboard metric-card layout (AI + Digital).
 * Persisted under profiles.notification_prefs.dashboard_layout (v2).
 */

export const DASHBOARD_LAYOUT_VERSION = 2 as const;

export type DashboardTabKey = "ai" | "digital";

export type DashboardCardDef = {
  id: string;
  title: string;
  /** Chrome cards (ask/filters/table) are not in the metric DnD grid. */
  kind: "chrome" | "metric" | "custom";
  pinned?: boolean;
};

/** Metric cards that participate in DnD on the AI tab. */
export const AI_METRIC_CARDS: DashboardCardDef[] = [
  { id: "panel_last_audit", title: "Last completed audit", kind: "metric" },
  { id: "kpi_verification", title: "Verification coverage", kind: "metric" },
  { id: "kpi_planogram", title: "Planogram compliance", kind: "metric" },
  { id: "kpi_total_audits", title: "Total audits", kind: "metric" },
  { id: "kpi_confidence", title: "Average confidence", kind: "metric" },
  { id: "kpi_products", title: "Products identified", kind: "metric" },
  { id: "kpi_brands", title: "Brands identified", kind: "metric" },
  { id: "kpi_facings", title: "Total facings", kind: "metric" },
  { id: "kpi_units", title: "Visible units", kind: "metric" },
  { id: "chart_planogram", title: "Planogram expected vs actual", kind: "metric" },
  { id: "chart_top_facings", title: "Top products by facings", kind: "metric" },
  { id: "chart_completion", title: "Completion mix", kind: "metric" },
  { id: "chart_trend", title: "Audits over time", kind: "metric" },
  { id: "chart_brand", title: "Brand share of facings", kind: "metric" },
  { id: "chart_category", title: "Category share of facings", kind: "metric" },
  { id: "chart_units", title: "Top products by visible units", kind: "metric" },
  { id: "chart_low_compliance", title: "Low planogram compliance", kind: "metric" },
  { id: "chart_performers_high", title: "Best-performing stores", kind: "metric" },
  { id: "chart_performers_low", title: "Stores that need attention", kind: "metric" },
  { id: "custom_0", title: "Custom metric 1", kind: "custom" },
  { id: "custom_1", title: "Custom metric 2", kind: "custom" },
  { id: "custom_2", title: "Custom metric 3", kind: "custom" },
];

export const DIGITAL_METRIC_CARDS: DashboardCardDef[] = [
  { id: "panel_last_digital", title: "Last completed digital audit", kind: "metric" },
  { id: "kpi_total", title: "Total digital audits", kind: "metric" },
  { id: "kpi_completed", title: "Completed", kind: "metric" },
  { id: "kpi_in_progress", title: "In progress", kind: "metric" },
  { id: "kpi_pending_review", title: "Pending review", kind: "metric" },
  { id: "kpi_reaudit_requested", title: "Re-audit requested", kind: "metric" },
  { id: "kpi_overdue", title: "Overdue audits", kind: "metric" },
  { id: "kpi_completion_pct", title: "Completion", kind: "metric" },
  { id: "kpi_ontime_pct", title: "On-time completion", kind: "metric" },
  { id: "kpi_total_expected", title: "Total expected", kind: "metric" },
  { id: "kpi_total_actual", title: "Total actual", kind: "metric" },
  { id: "kpi_net_variance", title: "Net variance", kind: "metric" },
  { id: "kpi_abs_variance", title: "Absolute variance", kind: "metric" },
  { id: "kpi_variance_pct", title: "Variance", kind: "metric" },
  { id: "kpi_ca_open", title: "Open actions", kind: "metric" },
  { id: "kpi_ca_in_progress", title: "Actions in progress", kind: "metric" },
  { id: "kpi_ca_completed", title: "Actions completed", kind: "metric" },
  { id: "kpi_ca_overdue", title: "Overdue actions", kind: "metric" },
  { id: "kpi_ca_closure", title: "Closure rate", kind: "metric" },
  { id: "kpi_ca_sla", title: "SLA compliance", kind: "metric" },
  { id: "chart_ca_strip", title: "Corrective actions", kind: "metric" },
  { id: "chart_variance_rank", title: "Variance ranking", kind: "metric" },
  { id: "chart_compare", title: "Audit comparison", kind: "metric" },
  { id: "custom_0", title: "Custom metric 1", kind: "custom" },
  { id: "custom_1", title: "Custom metric 2", kind: "custom" },
  { id: "custom_2", title: "Custom metric 3", kind: "custom" },
];

/**
 * Cards shown up front on each tab; the rest sit behind "Show all metrics".
 * Custom metrics are always up front (the user created them on purpose).
 */
export const PRIMARY_CARD_IDS: Record<DashboardTabKey, ReadonlySet<string>> = {
  ai: new Set([
    "panel_last_audit",
    "kpi_total_audits",
    "kpi_planogram",
    "kpi_verification",
    "kpi_confidence",
    "chart_trend",
  ]),
  digital: new Set([
    "panel_last_digital",
    "kpi_total",
    "kpi_completion_pct",
    "kpi_overdue",
    "kpi_variance_pct",
    "kpi_ca_open",
    "kpi_ca_overdue",
    "kpi_ca_sla",
    "kpi_ca_closure",
    "chart_ca_strip",
  ]),
};

export function isPrimaryCard(tab: DashboardTabKey, id: string): boolean {
  return PRIMARY_CARD_IDS[tab].has(id) || isCustomCardId(id);
}

/** @deprecated section catalog — kept for parse migration only */
export const AI_DASHBOARD_SECTIONS = AI_METRIC_CARDS;
export const DIGITAL_DASHBOARD_SECTIONS = DIGITAL_METRIC_CARDS;

export type TabLayoutState = {
  order: string[];
  hidden: string[];
};

export type DashboardLayoutPrefs = {
  version: typeof DASHBOARD_LAYOUT_VERSION;
  ai: TabLayoutState;
  digital: TabLayoutState;
};

export function metricCatalogForTab(tab: DashboardTabKey): DashboardCardDef[] {
  return tab === "ai" ? AI_METRIC_CARDS : DIGITAL_METRIC_CARDS;
}

/** Alias used by older imports */
export function catalogForTab(tab: DashboardTabKey): DashboardCardDef[] {
  return metricCatalogForTab(tab);
}

export function defaultTabLayout(catalog: DashboardCardDef[]): TabLayoutState {
  // Custom slots start hidden until the user creates a metric
  const customIds = catalog.filter((c) => c.kind === "custom").map((c) => c.id);
  return {
    order: catalog.map((c) => c.id),
    hidden: [...customIds],
  };
}

export function defaultDashboardLayout(): DashboardLayoutPrefs {
  return {
    version: DASHBOARD_LAYOUT_VERSION,
    ai: defaultTabLayout(AI_METRIC_CARDS),
    digital: defaultTabLayout(DIGITAL_METRIC_CARDS),
  };
}

export function mergeTabLayout(
  catalog: DashboardCardDef[],
  saved?: Partial<TabLayoutState> | null,
): TabLayoutState {
  const defaults = defaultTabLayout(catalog);
  const valid = new Set(catalog.map((c) => c.id));
  const orderRaw = (saved?.order ?? defaults.order).filter((id) => valid.has(id));
  const hidden = (saved?.hidden ?? defaults.hidden).filter((id) => valid.has(id));
  const missing = defaults.order.filter((id) => !orderRaw.includes(id));
  const panelFirst = missing.filter((id) => id.startsWith("panel_"));
  const restMissing = missing.filter((id) => !id.startsWith("panel_"));
  return { order: [...panelFirst, ...orderRaw, ...restMissing], hidden };
}

export function resolveVisibleOrder(
  catalog: DashboardCardDef[],
  layout: TabLayoutState,
): string[] {
  const hidden = new Set(layout.hidden);
  return layout.order.filter((id) => {
    const def = catalog.find((c) => c.id === id);
    if (!def) return false;
    return !hidden.has(id);
  });
}

export function parseDashboardLayout(raw: unknown): DashboardLayoutPrefs {
  const defaults = defaultDashboardLayout();
  if (!raw || typeof raw !== "object") return defaults;
  const obj = raw as Record<string, unknown>;
  const version = Number((obj as { version?: number }).version ?? 1);
  // v1 section layouts → reset to v2 defaults (ids are incompatible)
  if (version < 2) return defaults;
  return {
    version: DASHBOARD_LAYOUT_VERSION,
    ai: mergeTabLayout(AI_METRIC_CARDS, obj.ai as TabLayoutState),
    digital: mergeTabLayout(DIGITAL_METRIC_CARDS, obj.digital as TabLayoutState),
  };
}

export function reorderIds(order: string[], activeId: string, overId: string): string[] {
  const next = [...order];
  const from = next.indexOf(activeId);
  const to = next.indexOf(overId);
  if (from < 0 || to < 0 || from === to) return order;
  next.splice(from, 1);
  next.splice(to, 0, activeId);
  return next;
}

export function isCustomCardId(id: string): boolean {
  return id === "custom_0" || id === "custom_1" || id === "custom_2";
}
