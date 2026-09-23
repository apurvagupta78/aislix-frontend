/**
 * Per-user dashboard section layout (AI + Digital tabs).
 * Persisted under profiles.notification_prefs.dashboard_layout.
 */

export const DASHBOARD_LAYOUT_VERSION = 1 as const;

export type DashboardTabKey = "ai" | "digital";

export type DashboardSectionDef = {
  id: string;
  title: string;
  /** Pinned sections stay at top and are not draggable/hideable. */
  pinned?: boolean;
};

/** Aislix default section order for the AI Audits tab. */
export const AI_DASHBOARD_SECTIONS: DashboardSectionDef[] = [
  { id: "ask", title: "Ask Aislix", pinned: true },
  { id: "filters", title: "Filters", pinned: true },
  { id: "executive", title: "Executive summary" },
  { id: "synopsis_kpis", title: "Synopsis & KPIs" },
  { id: "chart_planogram", title: "Planogram Expected vs Actual" },
  { id: "chart_top_facings", title: "Top products by facings" },
  { id: "charts_analytics", title: "Analytics charts & performance" },
  { id: "table_last_ten", title: "Last 10 Audits" },
  { id: "table_assigned", title: "Assigned Audits" },
];

/** Aislix default section order for the Digital Audits tab. */
export const DIGITAL_DASHBOARD_SECTIONS: DashboardSectionDef[] = [
  { id: "filters", title: "Filters", pinned: true },
  { id: "kpi_digital", title: "Digital KPIs" },
  { id: "table_last_five", title: "Last 5 digital audits" },
];

export type TabLayoutState = {
  order: string[];
  hidden: string[];
};

export type DashboardLayoutPrefs = {
  version: typeof DASHBOARD_LAYOUT_VERSION;
  ai: TabLayoutState;
  digital: TabLayoutState;
};

export function defaultTabLayout(sections: DashboardSectionDef[]): TabLayoutState {
  return {
    order: sections.map((s) => s.id),
    hidden: [],
  };
}

export function defaultDashboardLayout(): DashboardLayoutPrefs {
  return {
    version: DASHBOARD_LAYOUT_VERSION,
    ai: defaultTabLayout(AI_DASHBOARD_SECTIONS),
    digital: defaultTabLayout(DIGITAL_DASHBOARD_SECTIONS),
  };
}

export function catalogForTab(tab: DashboardTabKey): DashboardSectionDef[] {
  return tab === "ai" ? AI_DASHBOARD_SECTIONS : DIGITAL_DASHBOARD_SECTIONS;
}

/** Merge saved prefs with catalog — drop unknown ids, append new catalog ids. */
export function mergeTabLayout(
  catalog: DashboardSectionDef[],
  saved?: Partial<TabLayoutState> | null,
): TabLayoutState {
  const defaults = defaultTabLayout(catalog);
  const valid = new Set(catalog.map((s) => s.id));
  const pinned = catalog.filter((s) => s.pinned).map((s) => s.id);
  const orderRaw = (saved?.order ?? defaults.order).filter((id) => valid.has(id));
  const hidden = (saved?.hidden ?? []).filter((id) => valid.has(id) && !pinned.includes(id));
  const missing = defaults.order.filter((id) => !orderRaw.includes(id));
  let order = [...orderRaw, ...missing];
  // Keep pinned ids first in catalog order
  const unpinned = order.filter((id) => !pinned.includes(id));
  order = [...pinned.filter((id) => order.includes(id)), ...unpinned];
  return { order, hidden };
}

export function resolveVisibleOrder(
  catalog: DashboardSectionDef[],
  layout: TabLayoutState,
): string[] {
  const hidden = new Set(layout.hidden);
  return layout.order.filter((id) => {
    const def = catalog.find((s) => s.id === id);
    if (!def) return false;
    if (def.pinned) return true;
    return !hidden.has(id);
  });
}

export function parseDashboardLayout(raw: unknown): DashboardLayoutPrefs {
  const defaults = defaultDashboardLayout();
  if (!raw || typeof raw !== "object") return defaults;
  const obj = raw as Record<string, unknown>;
  return {
    version: DASHBOARD_LAYOUT_VERSION,
    ai: mergeTabLayout(AI_DASHBOARD_SECTIONS, obj.ai as TabLayoutState),
    digital: mergeTabLayout(DIGITAL_DASHBOARD_SECTIONS, obj.digital as TabLayoutState),
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
