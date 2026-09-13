import type { RecentAuditRow, RecentAuditStatus, WorkspaceDashboardData } from "@/lib/dashboard-intelligence";
import { KPI_DASHBOARD_LABELS, KPI_TREND_CHIP_LABELS } from "@/lib/dashboard-config";
import type { DashboardFilterState } from "@/lib/dashboard-filters";
import type { AuditKpiId } from "@/lib/role-kpi-config";
import type { AuditRoleTab } from "@/lib/role-audit-ui";
import { formatNumber, formatPercent } from "@/lib/dashboard";

export type RecentAuditStatusFilter = RecentAuditStatus | "all";

export type RecentAuditSortKey =
  | "date"
  | "store"
  | "role"
  | "category"
  | "sub_category"
  | "osa"
  | "planogram"
  | "issues"
  | "assigned_to"
  | "status";

export type SortDirection = "asc" | "desc";

export type SectionKpiCard = {
  key: string;
  label: string;
  value: string;
  description: string;
  detail?: string | null;
};

const STATUS_ORDER: Record<RecentAuditStatus, number> = {
  needs_action: 0,
  in_progress: 1,
  draft: 2,
  failed: 3,
  completed: 4,
};

function roleForKpis(filters: DashboardFilterState, _data: WorkspaceDashboardData): AuditRoleTab {
  return filters.role;
}

function fourthKpiCandidates(role: AuditRoleTab): AuditKpiId[] {
  switch (role) {
    case "darkstore":
      return ["location_accuracy", "planogram_compliance"];
    case "fmcg":
      return ["share_of_shelf", "planogram_compliance"];
    case "distributor":
      return ["msl_compliance", "planogram_compliance"];
    case "local":
      return ["assortment_compliance", "planogram_compliance"];
    default:
      return ["planogram_compliance"];
  }
}

function weightedKpiDisplay(
  kpi: WorkspaceDashboardData["kpis"]["osa"],
  fallbackLabel: string,
): SectionKpiCard {
  if (!kpi.available) {
    return {
      key: fallbackLabel,
      label: fallbackLabel,
      value: kpi.unavailable_reason ?? "Not enough data",
      description: "",
    };
  }
  return {
    key: fallbackLabel,
    label: fallbackLabel,
    value: formatPercent(kpi.percent ?? undefined),
    description: "",
    detail: kpi.detail,
  };
}

function attentionKpiCard(
  data: WorkspaceDashboardData,
  kpiId: AuditKpiId,
): SectionKpiCard | null {
  const card = data.attention_cards.find((c) => c.kpi_id === kpiId);
  if (!card || card.no_data || card.score === null) return null;
  return {
    key: kpiId,
    label: KPI_TREND_CHIP_LABELS[kpiId] ?? KPI_DASHBOARD_LABELS[kpiId],
    value: `${Math.round(card.score)}%`,
    description: "",
    detail: card.score_display,
  };
}

export function buildRecentAuditsKpiCards(
  data: WorkspaceDashboardData,
  filters: DashboardFilterState,
): SectionKpiCard[] {
  const role = roleForKpis(filters, data);
  const osa = weightedKpiDisplay(data.kpis.osa, "Average OSA");
  osa.description = "Products visibly available";

  let fourth: SectionKpiCard | null = null;
  for (const kpiId of fourthKpiCandidates(role)) {
    if (kpiId === "planogram_compliance") {
      if (data.kpis.planogram.available) {
        fourth = weightedKpiDisplay(data.kpis.planogram, "Planogram");
        fourth.description = "Shelf matches expected layout";
        break;
      }
      continue;
    }
    fourth = attentionKpiCard(data, kpiId);
    if (fourth) {
      fourth.description =
        kpiId === "share_of_shelf"
          ? "Brand shelf presence in category"
          : kpiId === "location_accuracy"
            ? "Products in approved locations"
            : kpiId === "msl_compliance"
              ? "Must-stock list execution"
              : "Required assortment on shelf";
      break;
    }
  }

  if (!fourth) {
    const plano = data.kpis.planogram;
    fourth = {
      key: "planogram",
      label: "Planogram",
      value: plano.available ? formatPercent(plano.percent ?? undefined) : "Not enough data",
      description: "Shelf matches expected layout",
      detail: plano.detail,
    };
  }

  return [
    {
      key: "audits",
      label: "Audits",
      value: formatNumber(data.kpis.audits_completed),
      description: "Audits in this view",
    },
    {
      key: "stores",
      label: "Stores Covered",
      value: formatNumber(data.kpis.stores_covered),
      description: "Unique stores",
    },
    {
      ...osa,
      label: "Average OSA",
    },
    fourth,
    {
      key: "open_issues",
      label: "Open Issues",
      value: formatNumber(data.kpis.open_issues),
      description: "Issues still needing attention",
    },
  ];
}

export function filterRecentAudits(
  rows: RecentAuditRow[],
  search: string,
  status: RecentAuditStatusFilter,
): RecentAuditRow[] {
  const q = search.trim().toLowerCase();
  return rows.filter((row) => {
    if (status !== "all" && row.status !== status) return false;
    if (!q) return true;
    const haystack = [
      row.scan_id,
      row.store_name,
      row.store_city,
      row.category,
      row.sub_category,
      row.assigned_to,
      row.role,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}

function compareNullableNumber(a: number | null, b: number | null, dir: SortDirection): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return dir === "asc" ? a - b : b - a;
}

function compareText(a: string | null | undefined, b: string | null | undefined, dir: SortDirection): number {
  const av = (a ?? "").toLowerCase();
  const bv = (b ?? "").toLowerCase();
  const cmp = av.localeCompare(bv);
  return dir === "asc" ? cmp : -cmp;
}

export function sortRecentAudits(
  rows: RecentAuditRow[],
  key: RecentAuditSortKey,
  dir: SortDirection,
): RecentAuditRow[] {
  const sorted = [...rows];
  sorted.sort((a, b) => {
    switch (key) {
      case "date":
        return dir === "asc"
          ? new Date(a.date).getTime() - new Date(b.date).getTime()
          : new Date(b.date).getTime() - new Date(a.date).getTime();
      case "store":
        return compareText(a.store_name, b.store_name, dir);
      case "role":
        return compareText(a.role, b.role, dir);
      case "category":
        return compareText(a.category, b.category, dir);
      case "sub_category":
        return compareText(a.sub_category, b.sub_category, dir);
      case "osa":
        return compareNullableNumber(a.osa, b.osa, dir);
      case "planogram":
        return compareNullableNumber(a.planogram, b.planogram, dir);
      case "issues":
        return dir === "asc" ? a.issues - b.issues : b.issues - a.issues;
      case "assigned_to":
        return compareText(a.assigned_to ?? "Unassigned", b.assigned_to ?? "Unassigned", dir);
      case "status": {
        const av = STATUS_ORDER[a.status];
        const bv = STATUS_ORDER[b.status];
        return dir === "asc" ? av - bv : bv - av;
      }
      default:
        return 0;
    }
  });
  return sorted;
}

function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function formatAuditDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function formatAuditTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function formatMetric(value: number | null | undefined, unit: "percent" | "count" = "percent"): string {
  if (value === null || value === undefined) return "";
  return unit === "percent" ? `${Math.round(value)}%` : String(Math.round(value));
}

const STATUS_LABELS: Record<RecentAuditStatus, string> = {
  completed: "Completed",
  in_progress: "In Progress",
  needs_action: "Needs Action",
  draft: "Draft",
  failed: "Failed",
};

export function exportRecentAuditsCsv(rows: RecentAuditRow[]): void {
  const headers = [
    "Audit ID",
    "Audit Date",
    "Audit Time",
    "Store",
    "City",
    "Country",
    "Role",
    "Category",
    "Sub-category",
    "OSA",
    "Planogram Compliance",
    "Assortment Compliance",
    "Location Accuracy",
    "Share of Shelf",
    "Facing Attainment",
    "MSL Compliance",
    "Price Compliance",
    "Promotional Compliance",
    "Issue Count",
    "Open Issue Count",
    "Assigned To",
    "Assigned By",
    "Audit Status",
    "Planogram Used",
    "Audit Source",
    "Created At",
  ];

  const lines = rows.map((row) => {
    const kpis = row.export_kpis;
    return [
      row.scan_id,
      formatAuditDate(row.date),
      formatAuditTime(row.date),
      row.store_name,
      row.store_city,
      row.store_country,
      row.role,
      row.category,
      row.sub_category,
      formatMetric(row.osa),
      formatMetric(row.planogram),
      formatMetric(kpis.assortment_compliance),
      formatMetric(kpis.location_accuracy),
      formatMetric(kpis.share_of_shelf),
      formatMetric(kpis.facing_count, "count"),
      formatMetric(kpis.msl_compliance),
      formatMetric(kpis.price_compliance),
      formatMetric(kpis.promotional_compliance),
      row.issues,
      row.issues,
      row.assigned_to ?? "Unassigned",
      row.assigned_by ?? "",
      STATUS_LABELS[row.status],
      row.planogram_used ? "Yes" : "No",
      row.audit_source,
      row.date,
    ]
      .map(csvCell)
      .join(",");
  });

  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `aislix-audits-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function formatAuditDateDisplay(iso: string): string {
  return formatAuditDate(iso) || "—";
}

export function formatAuditTimeDisplay(iso: string): string {
  return formatAuditTime(iso) || "—";
}

export function formatKpiPercent(value: number | null): string {
  return value !== null ? `${Math.round(value)}%` : "—";
}
