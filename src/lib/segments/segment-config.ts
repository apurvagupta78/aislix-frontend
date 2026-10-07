/**
 * Per-segment home dashboard: which AI-audit KPIs, charts and wording each customer type sees.
 * Values come from the `segment_dashboard` RPC (completed AI audits only) — no KPI math here.
 */

import { accentAt, type AislixAccent } from "@/lib/ai-audit/kpi-palette";
import { AUDIT_ROLE_TABS, normalizeAuditRoleTab, type AuditRoleTab } from "@/lib/role-audit-ui";
import type { SegmentDashboard } from "@/lib/segments/segment-dashboard";

export type SegmentId = AuditRoleTab;

export const SEGMENT_IDS: SegmentId[] = AUDIT_ROLE_TABS;

export type SegmentKpiId =
  | "availability"
  | "shelf_health"
  | "planogram"
  | "gaps"
  | "low_stock"
  | "misplaced"
  | "facings"
  | "stores"
  | "audits"
  | "gps_audits"
  | "value_gap"
  | "open_actions"
  | "overdue_actions";

export type SegmentTrendMetric = "avg_osa" | "avg_health" | "gaps" | "audits";

export type SegmentStoreColumn =
  | "audits"
  | "avg_osa"
  | "avg_health"
  | "gaps"
  | "low_stock"
  | "misplaced"
  | "value_gap_inr"
  | "gps_audits"
  | "last_audit";

export type SegmentConfig = {
  id: SegmentId;
  label: string;
  /** The one question this home dashboard answers. */
  question: string;
  /** How Aislix saves this customer money and time — shown under the title. */
  value: string;
  storeNoun: { one: string; many: string };
  kpis: SegmentKpiId[];
  trend: { metric: SegmentTrendMetric; title: string };
  showBrands: boolean;
  brandsTitle: string;
  storeColumns: SegmentStoreColumn[];
  storesTitle: string;
};

export const SEGMENT_CONFIG: Record<SegmentId, SegmentConfig> = {
  supermarket: {
    id: "supermarket",
    label: "Supermarket",
    question: "Which aisles are losing sales right now?",
    value: "AI finds empty shelves, misplaced items and planogram breaks before shoppers do.",
    storeNoun: { one: "store", many: "stores" },
    kpis: ["availability", "gaps", "planogram", "open_actions"],
    trend: { metric: "avg_osa", title: "Shelf availability by week" },
    showBrands: true,
    brandsTitle: "Brands holding the most shelf",
    storeColumns: ["audits", "avg_osa", "gaps", "misplaced", "last_audit"],
    storesTitle: "Stores ranked by audits",
  },
  fmcg: {
    id: "fmcg",
    label: "FMCG brand",
    question: "Is my brand winning the shelf in every store?",
    value: "AI checks brand share, availability and display in every outlet without a manual store visit report.",
    storeNoun: { one: "outlet", many: "outlets" },
    kpis: ["availability", "stores", "facings", "value_gap"],
    trend: { metric: "avg_osa", title: "Availability across outlets by week" },
    showBrands: true,
    brandsTitle: "Share of shelf by brand",
    storeColumns: ["audits", "avg_osa", "gaps", "value_gap_inr", "last_audit"],
    storesTitle: "Outlets audited",
  },
  distributor: {
    id: "distributor",
    label: "Distributor",
    question: "Did my team visit every outlet, and what needs restocking?",
    value: "Time-stamped AI audits with location proof show coverage and the next restock order.",
    storeNoun: { one: "outlet", many: "outlets" },
    kpis: ["stores", "gps_audits", "gaps", "low_stock"],
    trend: { metric: "audits", title: "Outlet audits by week" },
    showBrands: true,
    brandsTitle: "Brands seen across outlets",
    storeColumns: ["audits", "gps_audits", "gaps", "low_stock", "last_audit"],
    storesTitle: "Outlet coverage",
  },
  darkstore: {
    id: "darkstore",
    label: "Dark store",
    question: "Which bins will cause missed orders?",
    value: "AI flags empty and low bins and wrong-slot items so pickers never hit a stockout.",
    storeNoun: { one: "site", many: "sites" },
    kpis: ["availability", "low_stock", "misplaced", "overdue_actions"],
    trend: { metric: "gaps", title: "Empty slots found by week" },
    showBrands: false,
    brandsTitle: "",
    storeColumns: ["audits", "avg_osa", "low_stock", "misplaced", "last_audit"],
    storesTitle: "Sites ranked by audits",
  },
  local: {
    id: "local",
    label: "Local store",
    question: "What should I reorder or fix on my shelf today?",
    value: "One photo shows what is running out and what money is stuck on the shelf.",
    storeNoun: { one: "store", many: "stores" },
    kpis: ["shelf_health", "gaps", "low_stock", "value_gap"],
    trend: { metric: "avg_health", title: "Shelf health by week" },
    showBrands: true,
    brandsTitle: "Brands on your shelf",
    storeColumns: ["audits", "avg_health", "gaps", "low_stock", "last_audit"],
    storesTitle: "Your stores",
  },
};

export function segmentConfig(id: string | null | undefined): SegmentConfig {
  return SEGMENT_CONFIG[normalizeSegmentId(id)];
}

export function normalizeSegmentId(value: string | null | undefined): SegmentId {
  return normalizeAuditRoleTab(value);
}

export type SegmentKpiView = {
  id: SegmentKpiId;
  label: string;
  value: string;
  context: string;
  accent: AislixAccent;
  /** Change vs the previous equal period, when both periods have a value. */
  delta: number | null;
  /** Lower is better for counts of problems (gaps, low stock, overdue). */
  lowerIsBetter: boolean;
  unavailable: boolean;
};

const NOT_AVAILABLE = "N/A";

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function formatCount(v: number | null): string {
  return v == null ? NOT_AVAILABLE : Math.round(v).toLocaleString("en-IN");
}

function formatPct(v: number | null): string {
  if (v == null) return NOT_AVAILABLE;
  return `${Number.isInteger(v) ? v : v.toFixed(1)}%`;
}

export function formatInr(v: number | null): string {
  if (v == null) return NOT_AVAILABLE;
  return `₹${Math.round(v).toLocaleString("en-IN")}`;
}

function diff(cur: number | null, prev: number | null): number | null {
  if (cur == null || prev == null) return null;
  return cur - prev;
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${formatCount(n)} ${n === 1 ? one : many}`;
}

/** Build KPI cards for a segment. Accents cycle so neighbours never share a colour. */
export function buildSegmentKpis(config: SegmentConfig, data: SegmentDashboard | null): SegmentKpiView[] {
  const t = data?.totals;
  const p = (num(data?.previous?.audits) ?? 0) > 0 ? data?.previous : undefined;
  const a = data?.actions;
  const audits = num(t?.audits) ?? 0;
  const noAudits = audits === 0;
  const missing = noAudits ? "No AI audits in this period" : "Data unavailable for these audits";
  const nouns = config.storeNoun;

  return config.kpis.map((id, index) => {
    const accent = accentAt(index);
    const base = { id, accent, delta: null as number | null, lowerIsBetter: false, unavailable: false };
    switch (id) {
      case "availability": {
        const v = num(t?.avg_osa);
        return {
          ...base,
          label: "Shelf availability",
          value: formatPct(v),
          context: v == null ? missing : `Average across ${plural(audits, "AI audit")}`,
          delta: diff(v, num(p?.avg_osa)),
          unavailable: v == null,
        };
      }
      case "shelf_health": {
        const v = num(t?.avg_health);
        return {
          ...base,
          label: "Shelf health",
          value: v == null ? NOT_AVAILABLE : `${Math.round(v)}/100`,
          context: v == null ? missing : "AI score for stock, order and gaps",
          delta: diff(v, num(p?.avg_health)),
          unavailable: v == null,
        };
      }
      case "planogram": {
        const v = num(t?.avg_planogram);
        const n = num(t?.planogram_audits) ?? 0;
        return {
          ...base,
          label: "Planogram compliance",
          value: formatPct(v),
          context: v == null ? "Upload a planogram to compare" : `${plural(n, "audit")} matched to a planogram`,
          unavailable: v == null,
        };
      }
      case "gaps": {
        const v = noAudits ? null : num(t?.gaps);
        return {
          ...base,
          label: "Empty shelf gaps",
          value: formatCount(v),
          context: v == null ? missing : "Empty spaces the AI found",
          delta: diff(v, num(p?.gaps)),
          lowerIsBetter: true,
          unavailable: v == null,
        };
      }
      case "low_stock": {
        const v = noAudits ? null : num(t?.low_stock);
        return {
          ...base,
          label: "Low-stock lines",
          value: formatCount(v),
          context: v == null ? missing : "Products running low on the shelf",
          delta: diff(v, num(p?.low_stock)),
          lowerIsBetter: true,
          unavailable: v == null,
        };
      }
      case "misplaced": {
        const v = noAudits ? null : num(t?.misplaced);
        return {
          ...base,
          label: "Misplaced items",
          value: formatCount(v),
          context: v == null ? missing : "Products in the wrong place",
          delta: diff(v, num(p?.misplaced)),
          lowerIsBetter: true,
          unavailable: v == null,
        };
      }
      case "facings": {
        const v = noAudits ? null : num(t?.facings);
        return {
          ...base,
          label: "Facings counted",
          value: formatCount(v),
          context: v == null ? missing : "Product fronts the AI counted",
          unavailable: v == null,
        };
      }
      case "stores": {
        const v = num(t?.stores) ?? 0;
        return {
          ...base,
          label: `${capitalize(nouns.many)} audited`,
          value: noAudits ? NOT_AVAILABLE : formatCount(v),
          context: noAudits ? missing : `${plural(audits, "AI audit")} in this period`,
          delta: diff(noAudits ? null : v, num(p?.stores)),
          unavailable: noAudits,
        };
      }
      case "audits": {
        return {
          ...base,
          label: "AI audits",
          value: noAudits ? NOT_AVAILABLE : formatCount(audits),
          context: noAudits ? "No AI audits in this period" : "Completed shelf audits",
          delta: diff(noAudits ? null : audits, num(p?.audits)),
          unavailable: noAudits,
        };
      }
      case "gps_audits": {
        const v = num(t?.gps_audits) ?? 0;
        return {
          ...base,
          label: "Visits with location proof",
          value: noAudits ? NOT_AVAILABLE : `${formatCount(v)} of ${formatCount(audits)}`,
          context: noAudits ? "No AI audits in this period" : "Audits stamped with GPS and time",
          unavailable: noAudits,
        };
      }
      case "value_gap": {
        const v = num(t?.value_gap_inr);
        const priced = num(t?.priced_audits) ?? 0;
        return {
          ...base,
          label: "Potential value at risk",
          value: formatInr(v),
          context: v == null ? "Add a price list to estimate value" : `From ${plural(priced, "priced audit")}`,
          lowerIsBetter: true,
          unavailable: v == null,
        };
      }
      case "open_actions": {
        const v = num(a?.open);
        return {
          ...base,
          label: "Open fixes",
          value: formatCount(v),
          context: v == null ? "Data unavailable" : `${formatCount(num(a?.closed_in_period) ?? 0)} closed in this period`,
          lowerIsBetter: true,
          unavailable: v == null,
        };
      }
      case "overdue_actions": {
        const v = num(a?.overdue);
        return {
          ...base,
          label: "Overdue fixes",
          value: formatCount(v),
          context: v == null ? "Data unavailable" : `${plural(num(a?.open) ?? 0, "fix", "fixes")} open in total`,
          lowerIsBetter: true,
          unavailable: v == null,
        };
      }
    }
  });
}

/** Plain-language summary of what the AI found — counts only, straight from the RPC. */
export function segmentHeadline(config: SegmentConfig, data: SegmentDashboard | null): string | null {
  const t = data?.totals;
  const audits = num(t?.audits) ?? 0;
  if (!t || audits === 0) return null;
  const stores = num(t.stores) ?? 0;
  const parts: string[] = [];
  const gaps = num(t.gaps);
  const low = num(t.low_stock);
  const misplaced = num(t.misplaced);
  if (gaps != null && gaps > 0) parts.push(`${formatCount(gaps)} empty gaps`);
  if (low != null && low > 0) parts.push(`${formatCount(low)} low-stock lines`);
  if (misplaced != null && misplaced > 0) parts.push(`${formatCount(misplaced)} misplaced items`);
  const where = `${plural(audits, "AI audit")} across ${plural(stores, config.storeNoun.one, config.storeNoun.many)}`;
  if (gaps == null && low == null && misplaced == null) {
    return `${where}. Shelf counts are not available for these audits.`;
  }
  if (!parts.length) return `${where} found no gaps, low stock or misplaced items.`;
  return `${where} found ${joinList(parts)}.`;
}

function joinList(parts: string[]): string {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

function capitalize(s: string): string {
  return s ? s[0]!.toUpperCase() + s.slice(1) : s;
}

export const SEGMENT_STORAGE_KEY = "aislix:dashboard-segment";

export function readStoredSegment(): SegmentId | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(SEGMENT_STORAGE_KEY);
  return raw && (SEGMENT_IDS as string[]).includes(raw) ? (raw as SegmentId) : null;
}

export function writeStoredSegment(id: SegmentId): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SEGMENT_STORAGE_KEY, id);
}
