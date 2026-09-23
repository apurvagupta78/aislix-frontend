import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  Info,
  Plus,
  ShoppingCart,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { AskAislixSection } from "@/components/ask-aislix/AskAislixSection";
import type { SuggestionDataAvailability } from "@/lib/ask-aislix/ask-aislix-suggestions.select";
import { WorkspaceFilterBar } from "@/components/filters/GlobalFilterBarShell";
import { MpDonut } from "@/components/control-tower/MpCharts";
import { DemoPreviewToggle } from "@/components/control-tower/DemoPreviewToggle";
import {
  BrandShareMultiRing,
  CategoryShareDonut,
  PerformanceLeaderboard,
  ProductRankingCards,
} from "@/components/dashboard/DashboardMetricVisuals";
import {
  DashboardLayoutToolbar,
  SortableMetricCard,
  useSectionDrag,
  visibleSectionIds,
} from "@/components/dashboard/DashboardLayoutControls";
import { CreateCustomMetricDialog } from "@/components/dashboard/CreateCustomMetricDialog";
import { PageHeader } from "@/components/design-system/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AISLIX, NEW_AUDIT_BUTTON_CLASS } from "@/lib/aislix-theme";
import {
  fetchNotificationPreferences,
  updateNotificationPreferences,
} from "@/lib/account";
import {
  catalogForTab,
  defaultDashboardLayout,
  defaultTabLayout,
  isCustomCardId,
  metricCatalogForTab,
  parseDashboardLayout,
  type DashboardLayoutPrefs,
  type DashboardTabKey,
  type TabLayoutState,
} from "@/lib/dashboard-layout";
import {
  parseCustomMetrics,
  type CustomMetricDef,
  type DashboardCustomMetricsPrefs,
} from "@/lib/dashboard-custom-metrics";
import {
  fetchAuditAnalysisReport,
  fetchOpsAiDashboard,
  type CompletionFilter,
  type LastAuditReport,
  type LastTenAuditRow,
} from "@/lib/dashboard-ops-ai";
import {
  fetchDigitalDashboardMetrics,
  type DashboardTab,
  type DigitalLastTenRow,
} from "@/lib/dashboard-ai-digital";
import { digitalKpiTooltip } from "@/lib/dashboard-digital-kpi-catalog";
import { useOptionalGlobalFilters } from "@/lib/global-filters";
import { assignmentStatusLabel } from "@/lib/assignment-status-ui";
import { useDemoPreview } from "@/lib/use-demo-preview";
import { useIsGuest } from "@/lib/use-is-guest";
import { cn } from "@/lib/utils";
import { Route as DashboardRoute } from "@/routes/dashboard";

const CHART_COLORS = [
  AISLIX.localBorder,
  AISLIX.supermarketBorder,
  AISLIX.darkstoreBorder,
  AISLIX.warehouseBorder,
  AISLIX.accentBorder,
];

/** Wide cards span both columns of the metric grid. */
const SPAN2_CARD_IDS = new Set([
  "panel_last_audit",
  "panel_last_digital",
  "chart_planogram",
  "chart_top_facings",
  "chart_completion",
  "chart_trend",
  "chart_brand",
  "chart_category",
  "chart_units",
  "chart_low_compliance",
  "chart_ca_strip",
  "chart_variance_rank",
  "chart_compare",
]);

type AssignmentFilter = "all" | "assigned_to_me" | "assigned_by_me";

function fmt(value: number | null | undefined, suffix = ""): string {
  if (value == null || Number.isNaN(value)) return "N/A";
  if (!Number.isFinite(value)) return "Data unavailable";
  return `${Number.isInteger(value) ? value : value.toFixed(1)}${suffix}`;
}

/** When the real workspace has no audits, surface N/A instead of fake zeros. */
function fmtOrEmpty(
  empty: boolean,
  value: number | null | undefined,
  suffix = "",
): string {
  if (empty) return "N/A";
  return fmt(value, suffix);
}

function fmtDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function isDigitalCompleted(status: string): boolean {
  const s = String(status || "").toLowerCase();
  return (
    s === "completed" ||
    s === "submitted" ||
    s === "approved" ||
    s.includes("complet") ||
    s.includes("submit")
  );
}

function digitalRowToAnalysisReport(row: DigitalLastTenRow): LastAuditReport {
  const varianceNote =
    row.variance == null
      ? "Expected/Actual not mapped for this audit."
      : row.variance === 0
        ? "Expected and actual units match."
        : `Net variance of ${row.variance} units vs expected.`;
  return {
    scanId: row.scanId ?? row.id,
    assignmentId: row.id,
    auditName: row.auditName,
    storeName: row.store,
    date: row.date,
    compliancePct: null,
    findingsCount: row.findingsCount ?? 0,
    confidencePct: null,
    good:
      row.expected != null && row.actual != null
        ? `Counted ${fmt(row.actual)} vs expected ${fmt(row.expected)}.`
        : "Digital audit captured for this location.",
    attention: varianceNote,
    nextAction:
      (row.caCount ?? 0) > 0
        ? `Follow ${fmt(row.caCount)} corrective action(s) and confirm re-audit status (${row.reauditStatus}).`
        : (row.findingsCount ?? 0) > 0
          ? "Review open findings and assign corrective actions."
          : "Confirm counts and close the audit cycle.",
    imageUrls: [],
    completed: isDigitalCompleted(row.status),
  };
}

function EmptyScopeBanner({ kind }: { kind: "ai" | "digital" }) {
  return (
    <div className="rounded-xl border border-[#D9E2E8] bg-[#EEF1F4]/80 px-4 py-4">
      <p className="text-sm font-semibold text-[#102A43]">
        No {kind === "ai" ? "AI" : "digital"} audits in your scope yet
      </p>
      <p className="mt-1 text-sm text-[#667085]">
        Metrics show N/A until you run an audit. Start an audit to populate this dashboard.
      </p>
      <Link
        to="/new-audit"
        className="mt-3 inline-flex rounded-lg bg-[#102A43] px-3 py-2 text-xs font-medium text-white"
      >
        Start Audit
      </Link>
    </div>
  );
}

function withTab(
  prefs: DashboardLayoutPrefs,
  tab: DashboardTabKey,
  fn: (layout: TabLayoutState) => TabLayoutState,
): DashboardLayoutPrefs {
  return tab === "ai" ? { ...prefs, ai: fn(prefs.ai) } : { ...prefs, digital: fn(prefs.digital) };
}

function StagePill({ stage }: { stage: LastTenAuditRow["completionStage"] }) {
  const map = {
    completed: { label: "Completed", className: "bg-[#EAF1DF] text-[#102A43] border-[#C5D0B2]" },
    in_progress: { label: "In Progress", className: "bg-[#EAF6FD] text-[#102A43] border-[#C1E4F8]" },
    not_started: { label: "Not Started", className: "bg-[#FFEAF1] text-[#102A43] border-[#ECBDCC]" },
  } as const;
  const m = map[stage];
  return (
    <span className={cn("rounded-full border px-2 py-0.5 text-xs font-medium", m.className)}>
      {m.label}
    </span>
  );
}

function KpiCard({
  label,
  value,
  accent,
  delta,
  moreTo,
  context,
  footer,
  formula,
}: {
  label: string;
  value: string;
  accent: string;
  delta?: number | null;
  moreTo?: string;
  context?: string;
  footer?: React.ReactNode;
  formula?: string;
}) {
  return (
    <div
      className="h-full rounded-xl border border-[#D9E2E8] bg-white p-4"
      style={{ borderLeftWidth: 3, borderLeftColor: accent }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-[#667085]">{label}</p>
        <div className="flex items-center gap-1">
          {formula ? (
            <span title={formula} className="text-[#667085]">
              <Info className="size-3.5" aria-label="KPI formula" />
            </span>
          ) : null}
          {delta != null && Number.isFinite(delta) ? (
            <span
              className={cn(
                "inline-flex items-center text-xs font-semibold",
                delta >= 0 ? "text-[#3d7a55]" : "text-[#9b4b63]",
              )}
            >
              {delta >= 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
              {Math.abs(delta).toFixed(0)}
            </span>
          ) : null}
        </div>
      </div>
      <p className="mt-2 text-2xl font-semibold text-[#102A43]">{value}</p>
      {context ? <p className="mt-1 text-xs text-[#557187]">{context}</p> : null}
      {moreTo ? (
        <Link to={moreTo} className="mt-2 inline-block text-xs text-[#557187] hover:underline">
          View more
        </Link>
      ) : null}
      {footer}
    </div>
  );
}

function ViewMore({ to, label = "View more" }: { to: string; label?: string }) {
  return (
    <a href={to} className="text-xs font-medium text-[#557187] hover:underline">
      {label}
    </a>
  );
}

function ChartCard({
  title,
  children,
  moreTo,
  className,
}: {
  title: string;
  children: React.ReactNode;
  moreTo?: string;
  className?: string;
}) {
  return (
    <div className={cn("h-full rounded-xl border border-[#D9E2E8] bg-white p-4", className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[#102A43]">{title}</h3>
        {moreTo ? <ViewMore to={moreTo} /> : null}
      </div>
      {children}
    </div>
  );
}

function AiAnalysisModal({
  open,
  onOpenChange,
  report,
  incomplete,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  report: LastAuditReport | null;
  incomplete: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-[#102A43]">AI Analysis</DialogTitle>
        </DialogHeader>
        {incomplete ? (
          <p className="text-sm text-[#667085]">Complete audit first to generate an AI Analysis report.</p>
        ) : report ? (
          <div className="space-y-3 text-sm text-[#102A43]">
            <p className="font-medium">
              {report.auditName} · {report.storeName} · {fmtDate(report.date)}
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-lg bg-[#EAF1DF] px-2 py-1 text-xs">
                Compliance {fmt(report.compliancePct, "%")}
              </span>
              <span className="rounded-lg bg-[#FFEAF1] px-2 py-1 text-xs">
                Findings {report.findingsCount}
              </span>
              <span className="rounded-lg bg-[#EAF6FD] px-2 py-1 text-xs">
                Confidence {fmt(report.confidencePct, "%")}
              </span>
            </div>
            <ul className="list-disc space-y-1 pl-5 text-[#557187]">
              <li>
                <span className="font-medium text-[#102A43]">Good:</span> {report.good}
              </li>
              <li>
                <span className="font-medium text-[#102A43]">Attention:</span> {report.attention}
              </li>
              <li>
                <span className="font-medium text-[#102A43]">Next action:</span> {report.nextAction}
              </li>
            </ul>
            {report.scanId ? (
              <a
                href={`/results?scan=${encodeURIComponent(report.scanId)}`}
                className="inline-flex rounded-lg bg-[#102A43] px-3 py-2 text-xs font-medium text-white"
              >
                View full report
              </a>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-[#667085]">Data unavailable</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CompletionChips({
  completion,
  onChange,
  scopeLabel,
}: {
  completion: CompletionFilter;
  onChange: (v: CompletionFilter) => void;
  scopeLabel?: string;
}) {
  return (
    <>
      {(
        [
          ["all", "All"],
          ["completed", "Completed"],
          ["in_progress", "In Progress"],
          ["not_started", "Not Started"],
        ] as const
      ).map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium",
            completion === id
              ? "border-[#102A43] bg-[#102A43] text-white"
              : id === "completed"
                ? "border-[#C5D0B2] bg-[#EAF1DF] text-[#102A43]"
                : id === "in_progress"
                  ? "border-[#C1E4F8] bg-[#EAF6FD] text-[#102A43]"
                  : id === "not_started"
                    ? "border-[#ECBDCC] bg-[#FFEAF1] text-[#102A43]"
                    : "border-[#D9E2E8] bg-white text-[#667085]",
          )}
        >
          {label}
        </button>
      ))}
      <span className="rounded-full border border-[#C1E4F8] bg-[#EAF6FD] px-3 py-1 text-xs text-[#102A43]">
        {scopeLabel ?? "Showing your stores"}
      </span>
    </>
  );
}

export function AiDigitalDashboardShell() {
  const navigate = useNavigate({ from: DashboardRoute.fullPath });
  const { tab } = DashboardRoute.useSearch();
  const tabKey: DashboardTabKey = tab === "digital" ? "digital" : "ai";
  const global = useOptionalGlobalFilters();
  const demoPreview = useDemoPreview();
  const isGuest = useIsGuest();
  const queryClient = useQueryClient();
  const [completion, setCompletion] = useState<CompletionFilter>("all");
  const [tableStage, setTableStage] = useState<string>("all");
  const [tableTemplate, setTableTemplate] = useState<string>("all");
  const [tableAssignee, setTableAssignee] = useState<string>("all");
  const [tableStore, setTableStore] = useState<string>("all");
  const [tableRelation, setTableRelation] = useState<AssignmentFilter>("all");
  const [digRelation, setDigRelation] = useState<AssignmentFilter>("all");
  const [compareA, setCompareA] = useState<string>("");
  const [compareB, setCompareB] = useState<string>("");
  const [sortKey, setSortKey] = useState<"date" | "score" | "completion">("date");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalReport, setModalReport] = useState<LastAuditReport | null>(null);
  const [modalIncomplete, setModalIncomplete] = useState(false);
  const [editLayout, setEditLayout] = useState(false);
  const [layoutPrefs, setLayoutPrefs] = useState<DashboardLayoutPrefs>(() => defaultDashboardLayout());
  const [savedLayout, setSavedLayout] = useState<DashboardLayoutPrefs>(() => defaultDashboardLayout());
  const [layoutSaving, setLayoutSaving] = useState(false);
  const [customMetrics, setCustomMetrics] = useState<DashboardCustomMetricsPrefs>({ items: [] });
  const [customOpen, setCustomOpen] = useState(false);

  const filterKey = global?.filters
    ? {
        storeId: global.filters.storeId,
        category: global.filters.category,
        subCategory: global.filters.subCategory,
        teamMemberId: global.filters.teamMemberId,
        datePreset: global.filters.datePreset,
        dateFrom: global.filters.dateFrom,
        dateTo: global.filters.dateTo,
        country: global.filters.country,
        city: global.filters.city,
        skuId: global.filters.skuId,
        completion,
      }
    : { completion };

  const setTab = (next: DashboardTab) => {
    void navigate({
      search: (prev) => ({ ...prev, tab: next }),
      replace: true,
    });
  };

  const prefsQuery = useQuery({
    queryKey: ["dashboard-layout-prefs"],
    queryFn: async () => {
      const prefs = await fetchNotificationPreferences();
      return {
        layout: parseDashboardLayout(prefs.dashboard_layout),
        custom: parseCustomMetrics(prefs.dashboard_custom_metrics),
      };
    },
    staleTime: 60_000,
    enabled: Boolean(demoPreview.userEmail),
  });

  useEffect(() => {
    if (prefsQuery.data) {
      setLayoutPrefs(prefsQuery.data.layout);
      setSavedLayout(prefsQuery.data.layout);
      setCustomMetrics(prefsQuery.data.custom);
    }
  }, [prefsQuery.data]);

  const activeTabLayout: TabLayoutState = tabKey === "ai" ? layoutPrefs.ai : layoutPrefs.digital;
  const setActiveTabLayout = (next: TabLayoutState) => {
    setLayoutPrefs((prev) => withTab(prev, tabKey, () => next));
  };
  const layoutDirty =
    JSON.stringify(layoutPrefs.ai) !== JSON.stringify(savedLayout.ai) ||
    JSON.stringify(layoutPrefs.digital) !== JSON.stringify(savedLayout.digital);

  const sectionDrag = useSectionDrag(activeTabLayout, setActiveTabLayout);
  const visibleIds = visibleSectionIds(tabKey, activeTabLayout);
  const catalog = metricCatalogForTab(tabKey);
  const tabCustomMetrics = customMetrics.items.filter((m) => m.tab === tabKey);

  const hideCard = (id: string) =>
    setActiveTabLayout({
      ...activeTabLayout,
      hidden: activeTabLayout.hidden.includes(id)
        ? activeTabLayout.hidden
        : [...activeTabLayout.hidden, id],
    });

  const saveLayout = async () => {
    if (isGuest) {
      toast.message("Create a free account to save dashboard layout.");
      return;
    }
    setLayoutSaving(true);
    try {
      await updateNotificationPreferences({ dashboard_layout: layoutPrefs });
      setSavedLayout(layoutPrefs);
      void queryClient.invalidateQueries({ queryKey: ["dashboard-layout-prefs"] });
      toast.success("Dashboard layout saved to your profile");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save layout");
    } finally {
      setLayoutSaving(false);
    }
  };

  const resetLayout = async () => {
    if (isGuest) {
      const next = withTab(layoutPrefs, tabKey, () => defaultTabLayout(catalogForTab(tabKey)));
      setLayoutPrefs(next);
      setSavedLayout(next);
      toast.message("Layout reset locally. Create an account to save it.");
      return;
    }
    const previous = layoutPrefs;
    const next = withTab(layoutPrefs, tabKey, () => defaultTabLayout(catalogForTab(tabKey)));
    setLayoutPrefs(next);
    setLayoutSaving(true);
    try {
      await updateNotificationPreferences({ dashboard_layout: next });
      setSavedLayout(next);
      toast.success("Reset to Aislix default layout");
    } catch (err) {
      setLayoutPrefs(previous);
      toast.error(err instanceof Error ? err.message : "Could not reset layout");
    } finally {
      setLayoutSaving(false);
    }
  };

  const saveCustomMetric = async (metric: CustomMetricDef) => {
    if (isGuest) {
      toast.message("Create a free account to add custom metrics.");
      return;
    }
    const items = [
      ...customMetrics.items.filter((m) => !(m.tab === metric.tab && m.id === metric.id)),
      metric,
    ];
    const unhide = (l: TabLayoutState): TabLayoutState => ({
      order: l.order.includes(metric.id) ? l.order : [...l.order, metric.id],
      hidden: l.hidden.filter((h) => h !== metric.id),
    });
    const nextSaved = withTab(savedLayout, metric.tab, unhide);
    try {
      await updateNotificationPreferences({
        dashboard_custom_metrics: { items },
        dashboard_layout: nextSaved,
      });
      setCustomMetrics({ items });
      setSavedLayout(nextSaved);
      setLayoutPrefs((prev) => withTab(prev, metric.tab, unhide));
      void queryClient.invalidateQueries({ queryKey: ["dashboard-layout-prefs"] });
      toast.success(`Added "${metric.title}" to your dashboard`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save custom metric");
    }
  };

  const deleteCustomMetric = async (metric: CustomMetricDef) => {
    if (isGuest) {
      toast.message("Create a free account to manage custom metrics.");
      return;
    }
    const items = customMetrics.items.filter((m) => !(m.tab === metric.tab && m.id === metric.id));
    const hide = (l: TabLayoutState): TabLayoutState => ({
      ...l,
      hidden: l.hidden.includes(metric.id) ? l.hidden : [...l.hidden, metric.id],
    });
    const nextSaved = withTab(savedLayout, metric.tab, hide);
    try {
      await updateNotificationPreferences({
        dashboard_custom_metrics: { items },
        dashboard_layout: nextSaved,
      });
      setCustomMetrics({ items });
      setSavedLayout(nextSaved);
      setLayoutPrefs((prev) => withTab(prev, metric.tab, hide));
      void queryClient.invalidateQueries({ queryKey: ["dashboard-layout-prefs"] });
      toast.success(`Removed "${metric.title}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete custom metric");
    }
  };

  const opsQuery = useQuery({
    queryKey: ["dashboard-ops-ai-v6", filterKey, demoPreview.previewDemo],
    queryFn: () =>
      fetchOpsAiDashboard(filterKey, {
        previewDemo: demoPreview.previewDemo,
        userEmail: demoPreview.userEmail,
      }),
    staleTime: 30_000,
  });
  const digitalQuery = useQuery({
    queryKey: ["dashboard-digital-metrics-v2", filterKey, demoPreview.previewDemo],
    queryFn: () =>
      fetchDigitalDashboardMetrics(filterKey, {
        previewDemo: demoPreview.previewDemo,
        userEmail: demoPreview.userEmail,
      }),
    staleTime: 30_000,
  });

  const data = opsQuery.data;
  const dig = digitalQuery.data;
  const ai = data?.metrics;

  const emptyRealAi =
    !demoPreview.previewDemo &&
    !data?.labeledDemo &&
    (ai?.auditCount ?? 0) === 0 &&
    !(data?.lastTen?.length);
  const emptyRealDigital =
    !demoPreview.previewDemo &&
    !dig?.labeledDemo &&
    (dig?.totalAudits ?? 0) === 0 &&
    !(dig?.lastTen?.length) &&
    !(dig?.lastFive?.length);

  const askDataAvailability = useMemo((): SuggestionDataAvailability | null => {
    // While loading, keep legacy chips (null = no data filter). After load, filter tightly.
    if (opsQuery.isPending || digitalQuery.isPending) return null;
    const aiCount = ai?.auditCount ?? 0;
    const digCount = dig?.totalAudits ?? 0;
    const lastTenCount = (data?.lastTen?.length ?? 0) + (dig?.lastTen?.length ?? 0);
    const hasAudits = aiCount > 0 || digCount > 0 || lastTenCount > 0 || Boolean(data?.labeledDemo) || Boolean(dig?.labeledDemo);
    if (!hasAudits) {
      return {
        hasAudits: false,
        hasFindings: false,
        hasActions: false,
        hasInventory: false,
        hasExpiry: false,
        hasEvidence: false,
        hasStores: false,
        hasTrends: false,
        hasRecurring: false,
        hasComparison: false,
      };
    }
    const findingsOpen = data?.synopsis.findingsOpen ?? 0;
    const digFindings = (dig?.lastTen ?? []).some((r) => (r.findingsCount ?? 0) > 0);
    const caOpen = dig?.caOpen ?? data?.synopsis.caOpen ?? 0;
    const hasInventory =
      dig?.totalExpected != null ||
      dig?.netVariance != null ||
      (dig?.varianceByStore?.length ?? 0) > 0 ||
      (dig?.varianceByCategory?.length ?? 0) > 0;
    const hasEvidence = Boolean(data?.lastReport?.imageUrls?.length) || (ai?.verificationCoveragePct ?? 0) > 0;
    const hasTrends = (data?.auditTrend?.length ?? 0) > 1 || lastTenCount >= 2;
    return {
      hasAudits: true,
      hasFindings: findingsOpen > 0 || digFindings,
      hasActions: (caOpen ?? 0) > 0 || (dig?.caTotal ?? 0) > 0,
      hasInventory,
      hasExpiry: Boolean(dig?.fnv?.applicable),
      hasEvidence,
      hasStores: true,
      hasTrends,
      hasRecurring: dig?.recurringIssueRate != null || digFindings || findingsOpen > 0,
      hasComparison: lastTenCount >= 2 || hasInventory,
    };
  }, [
    opsQuery.isPending,
    digitalQuery.isPending,
    ai?.auditCount,
    ai?.verificationCoveragePct,
    dig?.totalAudits,
    dig?.lastTen,
    dig?.caOpen,
    dig?.caTotal,
    dig?.totalExpected,
    dig?.netVariance,
    dig?.varianceByStore,
    dig?.varianceByCategory,
    dig?.fnv?.applicable,
    dig?.recurringIssueRate,
    dig?.labeledDemo,
    data?.lastTen,
    data?.synopsis.findingsOpen,
    data?.synopsis.caOpen,
    data?.lastReport?.imageUrls,
    data?.auditTrend,
    data?.labeledDemo,
  ]);

  const filteredLastTen = useMemo(() => {
    let next = [...(data?.lastTen ?? [])];
    if (tableRelation !== "all") next = next.filter((r) => r.relation === tableRelation);
    if (tableStage !== "all") next = next.filter((r) => r.completionStage === tableStage);
    if (tableTemplate !== "all") next = next.filter((r) => r.templateName === tableTemplate);
    if (tableAssignee !== "all") next = next.filter((r) => r.assigneeName === tableAssignee);
    if (tableStore !== "all") next = next.filter((r) => r.storeName === tableStore);
    next.sort((a, b) => {
      if (sortKey === "score") return (b.scorePct ?? -1) - (a.scorePct ?? -1);
      if (sortKey === "completion") return a.completionStage.localeCompare(b.completionStage);
      return (b.date || "").localeCompare(a.date || "");
    });
    return next.slice(0, 10);
  }, [data?.lastTen, tableRelation, tableStage, tableTemplate, tableAssignee, tableStore, sortKey]);

  const filteredDigLastTen = useMemo(() => {
    let next = [...(dig?.lastTen ?? dig?.lastFive ?? [])];
    if (digRelation !== "all") next = next.filter((r) => r.relation === digRelation);
    return next.slice(0, 10);
  }, [dig?.lastTen, dig?.lastFive, digRelation]);

  const digLastCompleted = useMemo(() => {
    const pool = dig?.lastTen ?? dig?.lastFive ?? [];
    return (
      pool.find(
        (r) =>
          r.expected != null &&
          r.actual != null &&
          (r.status === "completed" ||
            r.status === "submitted" ||
            r.status === "approved" ||
            String(r.status).includes("complet")),
      ) ??
      pool.find((r) => r.expected != null && r.actual != null) ??
      pool[0] ??
      null
    );
  }, [dig?.lastTen, dig?.lastFive]);

  const digCompareOptions = useMemo(() => {
    return (dig?.lastTen ?? dig?.lastFive ?? []).filter(
      (r) => r.expected != null && r.actual != null,
    );
  }, [dig?.lastTen, dig?.lastFive]);

  useEffect(() => {
    if (!compareA && digCompareOptions[0]) setCompareA(digCompareOptions[0].id);
    if (!compareB && digCompareOptions[1]) setCompareB(digCompareOptions[1].id);
  }, [digCompareOptions, compareA, compareB]);

  const templateOptions = useMemo(
    () => [...new Set((data?.lastTen ?? []).map((r) => r.templateName))].filter(Boolean),
    [data?.lastTen],
  );
  const assigneeOptions = useMemo(
    () => [...new Set((data?.lastTen ?? []).map((r) => r.assigneeName))].filter(Boolean),
    [data?.lastTen],
  );
  const storeOptions = useMemo(
    () => [...new Set((data?.lastTen ?? []).map((r) => r.storeName))].filter(Boolean),
    [data?.lastTen],
  );

  const openAiAnalysis = async (row: LastTenAuditRow) => {
    if (row.completionStage !== "completed" || !row.scanId) {
      setModalIncomplete(true);
      setModalReport(null);
      setModalOpen(true);
      return;
    }
    setModalIncomplete(false);
    const report = await fetchAuditAnalysisReport(row.scanId);
    setModalReport(report);
    setModalOpen(true);
  };

  const openDigitalAnalysis = async (row: DigitalLastTenRow) => {
    if (!isDigitalCompleted(row.status) || (!row.scanId && !row.id)) {
      setModalIncomplete(true);
      setModalReport(null);
      setModalOpen(true);
      return;
    }
    setModalIncomplete(false);
    let report = digitalRowToAnalysisReport(row);
    if (row.scanId) {
      const fetched = await fetchAuditAnalysisReport(row.scanId);
      if (fetched?.completed && (fetched.good || fetched.attention || fetched.nextAction)) {
        report = {
          ...fetched,
          auditName: fetched.auditName || row.auditName,
          storeName: fetched.storeName !== "—" ? fetched.storeName : row.store,
          findingsCount: fetched.findingsCount || (row.findingsCount ?? 0),
        };
      }
    }
    setModalReport(report);
    setModalOpen(true);
  };

  const confPct =
    ai?.avgConfidence != null
      ? ai.avgConfidence <= 1
        ? ai.avgConfidence * 100
        : ai.avgConfidence
      : null;

  const planogramGrouped = (data?.planogramByStore ?? []).map((r) => ({
    label: r.label.length > 12 ? `${r.label.slice(0, 12)}…` : r.label,
    expected: r.expected,
    actual: r.actual,
  }));

  const renderCustomCard = (id: string, accent: string): React.ReactNode => {
    const metric = tabCustomMetrics.find((m) => m.id === id);
    if (!metric) {
      if (!editLayout) return null;
      return (
        <button
          type="button"
          onClick={() => setCustomOpen(true)}
          disabled={tabCustomMetrics.length >= 3}
          className="flex h-full min-h-[112px] w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#D9E2E8] bg-[#EEF1F4]/60 text-sm font-medium text-[#667085] hover:bg-[#EEF1F4]"
        >
          <Plus className="size-4" /> Create a custom metric
        </button>
      );
    }
    return (
      <KpiCard
        label={metric.title}
        value={metric.value}
        context={metric.context}
        accent={accent}
        footer={
          editLayout ? (
            <button
              type="button"
              onClick={() => void deleteCustomMetric(metric)}
              className="mt-2 inline-flex items-center gap-1 text-xs text-[#9b4b63] hover:underline"
            >
              <Trash2 className="size-3" /> Delete metric
            </button>
          ) : null
        }
      />
    );
  };

  const renderAiCard = (id: string, accent: string): React.ReactNode => {
    switch (id) {
      case "panel_last_audit":
        return (
          <div className="rounded-xl border border-[#C1E4F8] bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-[#102A43]">
                Last completed audit — AI Analysis Report
              </h3>
              {data?.lastReport ? (
                <div className="flex gap-2">
                  <Link
                    to="/history"
                    className="rounded-lg bg-[#7DB7D6] px-3 py-1.5 text-xs font-medium text-white"
                  >
                    View full report
                  </Link>
                  <button
                    type="button"
                    className="rounded-lg bg-[#FFEAF1] px-3 py-1.5 text-xs font-medium text-[#102A43]"
                    onClick={() => {
                      if (data.lastReport) {
                        setModalIncomplete(false);
                        setModalReport(data.lastReport);
                        setModalOpen(true);
                      }
                    }}
                  >
                    Share
                  </button>
                </div>
              ) : null}
            </div>
            {data?.lastReport ? (
              <div className="mt-3 space-y-3">
                <p className="text-sm text-[#557187]">
                  Audit: {data.lastReport.auditName} | Store: {data.lastReport.storeName} | Date:{" "}
                  {fmtDate(data.lastReport.date)}
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-lg bg-[#EAF1DF] px-3 py-1 text-xs font-medium text-[#102A43]">
                    Compliance: {fmt(data.lastReport.compliancePct, "%")}
                  </span>
                  <span className="rounded-lg bg-[#F0E9FF] px-3 py-1 text-xs font-medium text-[#102A43]">
                    Findings: {data.lastReport.findingsCount}
                  </span>
                  <span className="rounded-lg bg-[#EAF6FD] px-3 py-1 text-xs font-medium text-[#102A43]">
                    Confidence: {fmt(data.lastReport.confidencePct, "%")}
                  </span>
                </div>
                <ul className="space-y-2 text-sm text-[#557187]">
                  <li>
                    <span className="font-semibold text-[#102A43]">Good:</span> {data.lastReport.good}
                  </li>
                  <li>
                    <span className="font-semibold text-[#102A43]">Attention:</span>{" "}
                    {data.lastReport.attention}
                  </li>
                  <li>
                    <span className="font-semibold text-[#102A43]">Next action:</span>{" "}
                    {data.lastReport.nextAction}
                  </li>
                </ul>
                {data.lastReport.imageUrls.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {data.lastReport.imageUrls.slice(0, 3).map((url) => (
                      <img
                        key={url}
                        src={url}
                        alt=""
                        className="h-20 w-full rounded-lg border border-[#D9E2E8] object-cover"
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 text-sm text-[#667085]">
                {emptyRealAi
                  ? "N/A — start an audit to see the AI Analysis Report."
                  : "No completed audit in range — run an audit to see the AI Analysis Report."}
              </p>
            )}
          </div>
        );
      case "kpi_verification":
        return (
          <KpiCard
            label="Verification Coverage %"
            value={fmtOrEmpty(emptyRealAi, ai?.verificationCoveragePct, "%")}
            accent={accent}
            moreTo="/history"
          />
        );
      case "kpi_planogram":
        return (
          <KpiCard
            label="Planogram Compliance %"
            value={fmtOrEmpty(emptyRealAi, ai?.planogram.compliancePct, "%")}
            accent={accent}
            moreTo="/history"
          />
        );
      case "kpi_total_audits":
        return (
          <KpiCard
            label="Total Audits"
            value={fmtOrEmpty(
              emptyRealAi,
              data?.executive.audits
                ?? data?.synopsis?.historyCount
                ?? (data?.completionMix ?? []).reduce((sum, row) => sum + (row.value || 0), 0)
                || ai?.auditCount,
            )}
            accent={accent}
            moreTo="/history"
          />
        );
      case "kpi_confidence":
        return (
          <KpiCard
            label="Avg Confidence"
            value={fmtOrEmpty(emptyRealAi, confPct, "%")}
            accent={accent}
            moreTo="/history"
          />
        );
      case "kpi_products":
        return (
          <KpiCard
            label="Products Identified"
            value={fmtOrEmpty(emptyRealAi, ai?.productsIdentified)}
            accent={accent}
          />
        );
      case "kpi_brands":
        return (
          <KpiCard
            label="Brands Identified"
            value={fmtOrEmpty(emptyRealAi, ai?.brandsIdentified)}
            accent={accent}
          />
        );
      case "kpi_facings":
        return (
          <KpiCard
            label="Total Facings"
            value={fmtOrEmpty(emptyRealAi, ai?.totalFacings)}
            accent={accent}
          />
        );
      case "kpi_units":
        return (
          <KpiCard
            label="Visible Units"
            value={fmtOrEmpty(emptyRealAi, ai?.totalVisibleUnits)}
            accent={accent}
          />
        );
      case "chart_planogram":
        return (
          <ChartCard title="Planogram Compliance — Expected vs Actual" moreTo="/history">
            {planogramGrouped.length ? (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={planogramGrouped}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E7EDF0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="expected" fill={AISLIX.localBorder} name="Expected" />
                    <Bar dataKey="actual" fill={AISLIX.supermarketBorder} name="Actual" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-[#667085]">
                Data unavailable — no planogram audits in the current set.
              </p>
            )}
          </ChartCard>
        );
      case "chart_top_facings": {
        const rows = (ai?.topProductsByFacings ?? []).slice(0, 6);
        return (
          <ChartCard title="Top products by facings" moreTo="/audit-intelligence">
            {rows.length ? (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={rows.map((r) => ({
                      ...r,
                      label: r.label.length > 16 ? `${r.label.slice(0, 16)}…` : r.label,
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E7EDF0" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10 }}
                      interval={0}
                      angle={-20}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="value" name="Facings">
                      {rows.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-[#667085]">Data unavailable</p>
            )}
          </ChartCard>
        );
      }
      case "chart_completion":
        return (
          <ChartCard title="Completion mix" moreTo="/history">
            {(data?.completionMix ?? []).some((s) => s.value > 0) ? (
              <MpDonut
                slices={(data?.completionMix ?? []).map((s) => ({
                  label: s.label,
                  value: s.value,
                  color: s.color ?? AISLIX.localBorder,
                }))}
                total={data?.executive.audits ?? 0}
                totalLabel="Audits"
              />
            ) : (
              <p className="text-sm text-[#667085]">Data unavailable</p>
            )}
          </ChartCard>
        );
      case "chart_trend":
        return (
          <ChartCard title="AI Audit Trend (audits)" moreTo="/history">
            {(data?.auditTrend ?? []).length ? (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data?.auditTrend ?? []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E7EDF0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke={AISLIX.primary}
                      strokeWidth={2}
                      dot={{ fill: AISLIX.warehouseBorder }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-[#667085]">Data unavailable</p>
            )}
          </ChartCard>
        );
      case "chart_brand":
        return (
          <ChartCard title="Brand Share of Facings" moreTo="/audit-intelligence">
            <BrandShareMultiRing rows={ai?.brandShare ?? []} />
          </ChartCard>
        );
      case "chart_category":
        return (
          <ChartCard title="Category Share of Facings" moreTo="/audit-intelligence">
            <CategoryShareDonut rows={ai?.categoryShare ?? []} />
          </ChartCard>
        );
      case "chart_units":
        return (
          <ChartCard title="Top Products by Visible Units" moreTo="/audit-intelligence">
            <ProductRankingCards rows={ai?.topProductsByUnits ?? []} />
          </ChartCard>
        );
      case "chart_low_compliance":
        return (
          <ChartCard title="Top 5 stores — low planogram compliance (need visits)" moreTo="/history">
            <BrandShareMultiRing
              rows={(data?.lowComplianceStores ?? []).map((s) => ({
                label: s.storeName,
                value: s.compliancePct,
              }))}
            />
          </ChartCard>
        );
      case "chart_performers_high":
        return (
          <ChartCard title="Highest Audit Performance" moreTo="/history">
            <PerformanceLeaderboard
              tone="high"
              rows={(data?.topPerformers ?? []).map((p) => ({
                storeName: p.storeName,
                score: p.composite,
                sparkline: [
                  Math.max(0, p.composite - 12),
                  Math.max(0, p.composite - 6),
                  p.composite,
                ],
              }))}
            />
          </ChartCard>
        );
      case "chart_performers_low":
        return (
          <ChartCard title="Lowest Audit Performance" moreTo="/history">
            <PerformanceLeaderboard
              tone="low"
              rows={(data?.worstPerformers ?? []).map((p) => ({
                storeName: p.storeName,
                score: p.composite,
                sparkline: [
                  Math.min(100, p.composite + 8),
                  Math.min(100, p.composite + 3),
                  p.composite,
                ],
              }))}
            />
          </ChartCard>
        );
      default:
        return isCustomCardId(id) ? renderCustomCard(id, accent) : null;
    }
  };

  const selectClass = "rounded-lg border border-[#D9E2E8] bg-white px-2 py-1.5 text-xs";

  const renderDigitalCard = (id: string, accent: string): React.ReactNode => {
    if (id === "panel_last_digital") {
      const row = digLastCompleted;
      return (
        <div className="rounded-xl border border-[#C1E4F8] bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[#102A43]">
              Last completed digital audit — summary
            </h3>
            {row ? (
              <div className="flex gap-2">
                {row.scanId ? (
                  <Link
                    to="/results"
                    search={{ scan: row.scanId }}
                    className="rounded-lg bg-[#7DB7D6] px-3 py-1.5 text-xs font-medium text-white"
                  >
                    View full report
                  </Link>
                ) : (
                  <Link
                    to="/history"
                    className="rounded-lg bg-[#7DB7D6] px-3 py-1.5 text-xs font-medium text-white"
                  >
                    View history
                  </Link>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-[#C1E4F8] text-[#102A43]"
                  onClick={() => void openDigitalAnalysis(row)}
                >
                  AI Analysis
                </Button>
              </div>
            ) : null}
          </div>
          {row ? (
            <div className="mt-3 space-y-3">
              <p className="text-sm text-[#557187]">
                Audit: {row.auditName} | Template: {row.templateName || row.auditName} | Store:{" "}
                {row.store} | Date: {fmtDate(row.date)}
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-lg bg-[#EAF1DF] px-3 py-1 text-xs font-medium text-[#102A43]">
                  Expected: {fmt(row.expected)}
                </span>
                <span className="rounded-lg bg-[#F0E9FF] px-3 py-1 text-xs font-medium text-[#102A43]">
                  Actual: {fmt(row.actual)}
                </span>
                <span className="rounded-lg bg-[#EAF6FD] px-3 py-1 text-xs font-medium text-[#102A43]">
                  Variance: {fmt(row.variance)}
                </span>
                <span className="rounded-lg bg-[#FFEAF1] px-3 py-1 text-xs font-medium text-[#102A43]">
                  Status: {assignmentStatusLabel(row.status)}
                </span>
              </div>
              <ul className="space-y-1 text-sm text-[#557187]">
                <li>
                  <span className="font-semibold text-[#102A43]">Findings:</span> {fmt(row.findingsCount)}
                </li>
                <li>
                  <span className="font-semibold text-[#102A43]">Corrective actions:</span>{" "}
                  {fmt(row.caCount)}
                </li>
                <li>
                  <span className="font-semibold text-[#102A43]">Re-audit:</span> {row.reauditStatus}
                </li>
              </ul>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <p className="text-sm text-[#667085]">
                {emptyRealDigital
                  ? "N/A — start a digital audit to see the summary."
                  : "No digital audits in range — run a digital audit to see the summary."}
              </p>
              {emptyRealDigital ? (
                <Link
                  to="/new-audit"
                  className="inline-flex rounded-lg bg-[#102A43] px-3 py-2 text-xs font-medium text-white"
                >
                  Start Audit
                </Link>
              ) : null}
            </div>
          )}
        </div>
      );
    }
    const tip = digitalKpiTooltip(id);
    const kpis: Record<string, [string, string]> = {
      kpi_total: ["Total Digital Audits", fmtOrEmpty(emptyRealDigital, dig?.totalAudits)],
      kpi_completed: ["Completed", fmtOrEmpty(emptyRealDigital, dig?.completed)],
      kpi_in_progress: ["In Progress", fmtOrEmpty(emptyRealDigital, dig?.inProgress)],
      kpi_pending_review: ["Pending Review", fmtOrEmpty(emptyRealDigital, dig?.pendingReview)],
      kpi_reaudit_requested: [
        "Re-audit Requested",
        fmtOrEmpty(emptyRealDigital, dig?.reauditRequested),
      ],
      kpi_overdue: ["Overdue", fmtOrEmpty(emptyRealDigital, dig?.overdue)],
      kpi_completion_pct: ["Completion %", fmtOrEmpty(emptyRealDigital, dig?.completionPct, "%")],
      kpi_ontime_pct: ["On-Time Completion %", fmtOrEmpty(emptyRealDigital, dig?.onTimePct, "%")],
      kpi_total_expected: ["Total Expected", fmtOrEmpty(emptyRealDigital, dig?.totalExpected)],
      kpi_total_actual: ["Total Actual", fmtOrEmpty(emptyRealDigital, dig?.totalActual)],
      kpi_net_variance: ["Net Variance", fmtOrEmpty(emptyRealDigital, dig?.netVariance)],
      kpi_abs_variance: ["Absolute Variance", fmtOrEmpty(emptyRealDigital, dig?.absoluteVariance)],
      kpi_variance_pct: ["Variance %", fmtOrEmpty(emptyRealDigital, dig?.variancePct, "%")],
      kpi_ca_open: ["Open CA", fmtOrEmpty(emptyRealDigital, dig?.caOpen)],
      kpi_ca_in_progress: ["CA In Progress", fmtOrEmpty(emptyRealDigital, dig?.caInProgress)],
      kpi_ca_completed: ["CA Completed", fmtOrEmpty(emptyRealDigital, dig?.caClosed)],
      kpi_ca_overdue: ["Overdue CA", fmtOrEmpty(emptyRealDigital, dig?.caOverdue)],
      kpi_ca_closure: ["Action Closure Rate", fmtOrEmpty(emptyRealDigital, dig?.caClosurePct, "%")],
      kpi_ca_sla: ["SLA Compliance %", fmtOrEmpty(emptyRealDigital, dig?.caSlaPct, "%")],
    };
    const kpi = kpis[id];
    if (kpi) {
      return (
        <KpiCard
          label={kpi[0]}
          value={kpi[1]}
          accent={accent}
          formula={tip}
          moreTo={id.startsWith("kpi_ca") ? "/corrective-actions" : "/history"}
        />
      );
    }

    if (id === "chart_ca_strip") {
      const mix = dig?.caStatusMix ?? [];
      const totalMix = mix.reduce((s, m) => s + m.value, 0) || 1;
      return (
        <ChartCard title="Corrective Actions summary" moreTo="/corrective-actions">
          <div className="mb-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {[
              ["Total", emptyRealDigital ? null : dig?.caTotal],
              ["Open", emptyRealDigital ? null : dig?.caOpen],
              ["In Progress", emptyRealDigital ? null : dig?.caInProgress],
              ["Completed", emptyRealDigital ? null : dig?.caClosed],
              ["Overdue", emptyRealDigital ? null : dig?.caOverdue],
              ["Closure %", emptyRealDigital ? null : dig?.caClosurePct],
            ].map(([label, val], i) => (
              <div key={String(label)} className="rounded-lg border border-[#D9E2E8] bg-[#F4F7F9] px-2 py-2">
                <p className="text-[10px] uppercase text-[#667085]">{label}</p>
                <p className="text-sm font-semibold text-[#102A43]">
                  {i === 5 ? fmt(val as number | null, "%") : fmt(val as number | null)}
                </p>
              </div>
            ))}
          </div>
          {mix.length && !emptyRealDigital ? (
            <div className="space-y-2">
              <div className="flex h-3 overflow-hidden rounded-full border border-[#D9E2E8]">
                {mix.map((s, i) => (
                  <div
                    key={s.label}
                    style={{
                      width: `${(s.value / totalMix) * 100}%`,
                      background: CHART_COLORS[i % CHART_COLORS.length],
                    }}
                    title={`${s.label}: ${s.value}`}
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-[#667085]">
                {mix.map((s, i) => (
                  <span key={s.label} className="inline-flex items-center gap-1.5">
                    <span
                      className="size-2 rounded-full"
                      style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                    />
                    {s.label} {s.value}
                  </span>
                ))}
              </div>
              <p className="text-xs text-[#557187]">SLA Compliance: {fmt(dig?.caSlaPct, "%")}</p>
            </div>
          ) : (
            <p className="text-sm text-[#667085]">
              {emptyRealDigital ? "N/A — start an audit to get CA data." : "Data unavailable"}
            </p>
          )}
        </ChartCard>
      );
    }

    if (id === "chart_variance_rank") {
      const rows = (dig?.varianceByStore?.length ? dig.varianceByStore : dig?.varianceByCategory) ?? [];
      return (
        <ChartCard title="Variance ranking (absolute units)" moreTo="/intelligence/inventory-variance">
          {rows.length && !emptyRealDigital ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEF1F4" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "#667085" }} />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={100}
                    tick={{ fontSize: 10, fill: "#667085" }}
                  />
                  <Tooltip />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {rows.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-[#667085]">
              {emptyRealDigital
                ? "N/A — start an audit to get variance data."
                : "N/A — variance requires Expected + Actual mapped fields"}
            </p>
          )}
        </ChartCard>
      );
    }

    if (id === "chart_compare") {
      const a = digCompareOptions.find((r) => r.id === compareA);
      const b = digCompareOptions.find((r) => r.id === compareB);
      const compatible = Boolean(a && b && a.expected != null && b.expected != null);
      const chartData =
        compatible && a && b
          ? [
              { label: "Expected", a: a.expected ?? 0, b: b.expected ?? 0 },
              { label: "Actual", a: a.actual ?? 0, b: b.actual ?? 0 },
              { label: "Variance", a: a.variance ?? 0, b: b.variance ?? 0 },
            ]
          : [];
      return (
        <ChartCard title="Audit comparison">
          <div className="mb-3 flex flex-wrap gap-2">
            <select
              className={selectClass}
              value={compareA}
              onChange={(e) => setCompareA(e.target.value)}
            >
              <option value="">Audit A</option>
              {digCompareOptions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.auditName} · {r.store}
                </option>
              ))}
            </select>
            <select
              className={selectClass}
              value={compareB}
              onChange={(e) => setCompareB(e.target.value)}
            >
              <option value="">Audit B</option>
              {digCompareOptions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.auditName} · {r.store}
                </option>
              ))}
            </select>
          </div>
          {!digCompareOptions.length || emptyRealDigital ? (
            <p className="text-sm text-[#667085]">
              {emptyRealDigital
                ? "N/A — start an audit to compare results."
                : "Comparison unavailable — no audits with Expected + Actual mapped."}
            </p>
          ) : !compatible ? (
            <p className="text-sm text-[#667085]">
              Comparison unavailable — these audits use different measurement structures.
            </p>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap gap-2 text-xs text-[#102A43]">
                <span className="rounded-lg bg-[#EAF6FD] px-2 py-1">
                  A net {fmt(a?.variance)} · B net {fmt(b?.variance)}
                </span>
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EEF1F4" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: "#667085" }} />
                    <YAxis type="category" dataKey="label" width={72} tick={{ fontSize: 11, fill: "#667085" }} />
                    <Tooltip />
                    <Bar dataKey="a" name="Audit A" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} />
                    <Bar dataKey="b" name="Audit B" fill={CHART_COLORS[1]} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </ChartCard>
      );
    }

    return isCustomCardId(id) ? renderCustomCard(id, accent) : null;
  };

  const renderMetricGrid = (render: (id: string, accent: string) => React.ReactNode) => {
    let accentIndex = 0;
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {visibleIds.map((id) => {
          const def = catalog.find((c) => c.id === id);
          if (!def) return null;
          const accent = CHART_COLORS[accentIndex % CHART_COLORS.length]!;
          const body = render(id, accent);
          if (body == null) return null;
          accentIndex += 1;
          return (
            <SortableMetricCard
              key={id}
              id={id}
              title={def.title}
              editMode={editLayout}
              span2={SPAN2_CARD_IDS.has(id)}
              onHide={() => hideCard(id)}
              onDragStart={sectionDrag.onDragStart}
              onDragOver={sectionDrag.onDragOver}
              onDrop={sectionDrag.onDrop}
            >
              {body}
            </SortableMetricCard>
          );
        })}
        {!visibleIds.length ? (
          <p className="rounded-xl border border-dashed border-[#D9E2E8] bg-[#EEF1F4]/60 p-4 text-sm text-[#667085] sm:col-span-2">
            All metric cards are hidden. Use Customize Dashboard → Add card to bring them back.
          </p>
        ) : null}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Dashboard"
        title="Operations AI Dashboard"
        description="Ask Aislix, audit intelligence, planogram compliance, and execution performance."
        actions={
          <>
            <DemoPreviewToggle
              compact
              locked={isGuest}
              enabled={demoPreview.previewDemo}
              onChange={demoPreview.setPreviewDemo}
            />
            <Button variant="outline" size="sm" className={NEW_AUDIT_BUTTON_CLASS} asChild>
              {isGuest ? (
                <Link to="/dashboard" search={{ intent: "sample" } as never}>
                  New Audit
                </Link>
              ) : (
                <Link to="/new-audit">New Audit</Link>
              )}
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-2 rounded-xl border border-[#D9E2E8] bg-white p-1">
          {(
            [
              ["ai", "AI Audits"],
              ["digital", "Digital Audits"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                tab === id ? "bg-[#102A43] text-white" : "text-[#667085] hover:bg-[#F4F7F9]",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setEditLayout((v) => !v)}
          className={cn(
            "rounded-lg border px-3 py-2 text-xs font-medium",
            editLayout
              ? "border-[#102A43] bg-[#102A43] text-white"
              : "border-[#D9E2E8] bg-white text-[#667085]",
          )}
        >
          {editLayout ? "Done customizing" : "Customize Dashboard"}
        </button>
      </div>

      {editLayout ? (
        <DashboardLayoutToolbar
          tab={tabKey}
          layout={activeTabLayout}
          dirty={layoutDirty}
          saving={layoutSaving}
          customSlotsUsed={tabCustomMetrics.length}
          onChange={setActiveTabLayout}
          onSave={() => void saveLayout()}
          onReset={() => void resetLayout()}
          onCreateCustom={() => setCustomOpen(true)}
        />
      ) : null}

      {tabKey === "ai" ? (
        <div className="flex flex-col gap-6">
          <AskAislixSection
            previewDemo={demoPreview.previewDemo || Boolean(data?.labeledDemo)}
            dataAvailability={askDataAvailability}
            city={global?.filters?.city ?? null}
          />

          {opsQuery.isPending ? (
            <p className="text-sm text-[#667085]">Loading AI dashboard…</p>
          ) : (
            <>
              {emptyRealAi ? <EmptyScopeBanner kind="ai" /> : null}
              <div className="rounded-xl border border-[#C1E4F8] bg-[#EAF6FD]/60 px-4 py-2 text-sm text-[#102A43]">
                {emptyRealAi
                  ? "N/A audits · N/A complete · N/A open critical"
                  : `${data?.executive.audits ?? 0} audits · ${fmt(data?.executive.completionPct, "%")} complete · ${data?.executive.openCritical ?? 0} open critical`}
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    title: "Findings",
                    body: emptyRealAi ? "N/A" : `${data?.synopsis.findingsOpen ?? 0} open`,
                    to: "/findings",
                    bg: AISLIX.localBg,
                    border: AISLIX.localBorder,
                    Icon: Building2,
                  },
                  {
                    title: "Corrective Actions",
                    body: emptyRealAi ? "N/A" : `${data?.synopsis.caOpen ?? 0} open`,
                    to: "/corrective-actions",
                    bg: AISLIX.supermarketBg,
                    border: AISLIX.supermarketBorder,
                    Icon: ShoppingCart,
                  },
                  {
                    title: "History",
                    body: emptyRealAi ? "N/A" : `${data?.synopsis.historyCount ?? 0} audits`,
                    to: "/history",
                    bg: AISLIX.warehouseBg,
                    border: AISLIX.warehouseBorder,
                    Icon: Building2,
                  },
                  {
                    title: "Team",
                    body: `${data?.synopsis.teamCount ?? 0} members`,
                    to: "/team",
                    bg: AISLIX.darkstoreBg,
                    border: AISLIX.darkstoreBorder,
                    Icon: Users,
                  },
                ].map((card) => (
                  <div
                    key={card.title}
                    className="rounded-xl border p-3"
                    style={{ background: card.bg, borderColor: card.border }}
                  >
                    <card.Icon className="size-4 text-[#102A43]" />
                    <p className="mt-2 text-sm font-semibold text-[#102A43]">{card.title}</p>
                    <p className="mt-1 text-xs text-[#557187]">{card.body}</p>
                    <Link to={card.to} className="mt-2 inline-block text-xs text-[#557187] hover:underline">
                      View more
                    </Link>
                  </div>
                ))}
              </div>

              {renderMetricGrid(renderAiCard)}

              <div className="overflow-hidden rounded-xl border border-[#D9E2E8] bg-white shadow-sm">
                <WorkspaceFilterBar
                  embedded
                  footer={
                    <CompletionChips
                      completion={completion}
                      onChange={setCompletion}
                      scopeLabel={data?.scopeLabel}
                    />
                  }
                />
                <div className="border-t border-[#D9E2E8] p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-[#102A43]">Last 10 Audits</h3>
                  <ViewMore to="/history" />
                </div>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <div className="flex gap-1 rounded-lg border border-[#D9E2E8] bg-white p-0.5">
                    {(
                      [
                        ["all", "All"],
                        ["assigned_to_me", "Assigned to me"],
                        ["assigned_by_me", "Assigned by me"],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setTableRelation(id)}
                        className={cn(
                          "rounded-md px-2.5 py-1 text-xs font-medium",
                          tableRelation === id
                            ? "bg-[#102A43] text-white"
                            : "text-[#667085] hover:bg-[#F4F7F9]",
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <select className={selectClass} value={tableStage} onChange={(e) => setTableStage(e.target.value)}>
                    <option value="all">Completion stage</option>
                    <option value="completed">Completed</option>
                    <option value="in_progress">In Progress</option>
                    <option value="not_started">Not Started</option>
                  </select>
                  <select
                    className={selectClass}
                    value={tableTemplate}
                    onChange={(e) => setTableTemplate(e.target.value)}
                  >
                    <option value="all">Template</option>
                    {templateOptions.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <select
                    className={selectClass}
                    value={tableAssignee}
                    onChange={(e) => setTableAssignee(e.target.value)}
                  >
                    <option value="all">Assignee</option>
                    {assigneeOptions.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <select className={selectClass} value={tableStore} onChange={(e) => setTableStore(e.target.value)}>
                    <option value="all">Store</option>
                    {storeOptions.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <select
                    className={selectClass}
                    value={sortKey}
                    onChange={(e) => setSortKey(e.target.value as typeof sortKey)}
                  >
                    <option value="date">Sort: Date</option>
                    <option value="score">Sort: Score</option>
                    <option value="completion">Sort: Completion</option>
                  </select>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[960px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-[#D9E2E8] text-xs uppercase text-[#667085]">
                        <th className="py-2 pr-3">Audit</th>
                        <th className="py-2 pr-3">Template</th>
                        <th className="py-2 pr-3">Store</th>
                        <th className="py-2 pr-3">Assignee</th>
                        <th className="py-2 pr-3">Type</th>
                        <th className="py-2 pr-3">Completion</th>
                        <th className="py-2 pr-3">Date</th>
                        <th className="py-2 pr-3">Score</th>
                        <th className="py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLastTen.map((row) => (
                        <tr key={row.id} className="border-b border-[#EEF1F4]">
                          <td className="py-2 pr-3 font-medium text-[#102A43]">{row.auditName}</td>
                          <td className="py-2 pr-3 text-[#557187]">{row.templateName}</td>
                          <td className="py-2 pr-3">{row.storeName}</td>
                          <td className="py-2 pr-3">{row.assigneeName}</td>
                          <td className="py-2 pr-3">{row.type}</td>
                          <td className="py-2 pr-3">
                            <StagePill stage={row.completionStage} />
                          </td>
                          <td className="py-2 pr-3">{fmtDate(row.date)}</td>
                          <td className="py-2 pr-3">{fmt(row.scorePct, "%")}</td>
                          <td className="py-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="border-[#C1E4F8] text-[#102A43]"
                              onClick={() => void openAiAnalysis(row)}
                            >
                              AI Analysis
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {!filteredLastTen.length ? (
                        <tr>
                          <td colSpan={9} className="py-6 text-[#667085]">
                            {tableRelation === "all"
                              ? "Data unavailable"
                              : "No audits match this assignment filter"}
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <AskAislixSection
            previewDemo={demoPreview.previewDemo || Boolean(dig?.labeledDemo)}
            dataAvailability={askDataAvailability}
            city={global?.filters?.city ?? null}
          />

          {digitalQuery.isPending ? (
            <p className="text-sm text-[#667085]">Loading Digital metrics…</p>
          ) : (
            <>
              {emptyRealDigital ? <EmptyScopeBanner kind="digital" /> : null}
              <div className="rounded-xl border border-[#C1E4F8] bg-[#EAF6FD]/60 px-4 py-2 text-sm text-[#102A43]">
                {emptyRealDigital
                  ? "N/A digital audits · N/A complete · N/A overdue"
                  : `${dig?.totalAudits ?? 0} digital audits · ${fmt(dig?.completionPct, "%")} complete · ${dig?.overdue ?? 0} overdue`}
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    title: "Findings",
                    body: emptyRealDigital ? "N/A" : `${data?.synopsis.findingsOpen ?? 0} open`,
                    to: "/findings",
                    bg: AISLIX.localBg,
                    border: AISLIX.localBorder,
                    Icon: Building2,
                  },
                  {
                    title: "Corrective Actions",
                    body: emptyRealDigital
                      ? "N/A"
                      : dig?.caOpen != null
                        ? `${dig.caOpen} open`
                        : "N/A",
                    to: "/corrective-actions",
                    bg: AISLIX.supermarketBg,
                    border: AISLIX.supermarketBorder,
                    Icon: ShoppingCart,
                  },
                  {
                    title: "History",
                    body: emptyRealDigital ? "N/A" : `${dig?.totalAudits ?? 0} digital audits`,
                    to: "/history",
                    bg: AISLIX.warehouseBg,
                    border: AISLIX.warehouseBorder,
                    Icon: Building2,
                  },
                  {
                    title: "Team",
                    body: `${data?.synopsis.teamCount ?? 0} members`,
                    to: "/team",
                    bg: AISLIX.darkstoreBg,
                    border: AISLIX.darkstoreBorder,
                    Icon: Users,
                  },
                ].map((card) => (
                  <div
                    key={card.title}
                    className="rounded-xl border p-3"
                    style={{ background: card.bg, borderColor: card.border }}
                  >
                    <card.Icon className="size-4 text-[#102A43]" />
                    <p className="mt-2 text-sm font-semibold text-[#102A43]">{card.title}</p>
                    <p className="mt-1 text-xs text-[#557187]">{card.body}</p>
                    <Link to={card.to} className="mt-2 inline-block text-xs text-[#557187] hover:underline">
                      View more
                    </Link>
                  </div>
                ))}
              </div>

              {renderMetricGrid(renderDigitalCard)}

              <div className="overflow-hidden rounded-xl border border-[#D9E2E8] bg-white shadow-sm">
                <WorkspaceFilterBar
                  embedded
                  footer={
                    <CompletionChips
                      completion={completion}
                      onChange={setCompletion}
                      scopeLabel={data?.scopeLabel}
                    />
                  }
                />
                <div className="border-t border-[#D9E2E8] p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-[#102A43]">Last 10 Digital Audits</h3>
                    <ViewMore to="/history" />
                  </div>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <div className="flex gap-1 rounded-lg border border-[#D9E2E8] bg-white p-0.5">
                      {(
                        [
                          ["all", "All"],
                          ["assigned_to_me", "Assigned to me"],
                          ["assigned_by_me", "Assigned by me"],
                        ] as const
                      ).map(([id, label]) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setDigRelation(id)}
                          className={cn(
                            "rounded-md px-2.5 py-1 text-xs font-medium",
                            digRelation === id
                              ? "bg-[#102A43] text-white"
                              : "text-[#667085] hover:bg-[#F4F7F9]",
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1200px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-[#D9E2E8] text-xs uppercase text-[#667085]">
                          <th className="py-2 pr-3">Audit</th>
                          <th className="py-2 pr-3">Template</th>
                          <th className="py-2 pr-3">Location</th>
                          <th className="py-2 pr-3">Assignee</th>
                          <th className="py-2 pr-3">Date</th>
                          <th className="py-2 pr-3">Status</th>
                          <th className="py-2 pr-3">Expected</th>
                          <th className="py-2 pr-3">Actual</th>
                          <th className="py-2 pr-3">Variance</th>
                          <th className="py-2 pr-3">Findings</th>
                          <th className="py-2 pr-3">CA</th>
                          <th className="py-2 pr-3">Re-audit</th>
                          <th className="py-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredDigLastTen.map((row: DigitalLastTenRow) => (
                          <tr key={row.id} className="border-b border-[#EEF1F4]">
                            <td className="py-2 pr-3 font-medium text-[#102A43]">{row.auditName}</td>
                            <td className="py-2 pr-3 text-[#557187]">
                              {row.templateName || row.auditName}
                            </td>
                            <td className="py-2 pr-3">{row.store}</td>
                            <td className="py-2 pr-3">{row.assignee}</td>
                            <td className="py-2 pr-3">{fmtDate(row.date)}</td>
                            <td className="py-2 pr-3">{assignmentStatusLabel(row.status)}</td>
                            <td className="py-2 pr-3">{fmt(row.expected)}</td>
                            <td className="py-2 pr-3">{fmt(row.actual)}</td>
                            <td className="py-2 pr-3">{fmt(row.variance)}</td>
                            <td className="py-2 pr-3">{fmt(row.findingsCount)}</td>
                            <td className="py-2 pr-3">{fmt(row.caCount)}</td>
                            <td className="py-2 pr-3">{row.reauditStatus}</td>
                            <td className="py-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="border-[#C1E4F8] text-[#102A43]"
                                onClick={() => void openDigitalAnalysis(row)}
                              >
                                AI Analysis
                              </Button>
                            </td>
                          </tr>
                        ))}
                        {!filteredDigLastTen.length ? (
                          <tr>
                            <td colSpan={13} className="py-6 text-[#667085]">
                              {emptyRealDigital
                                ? "N/A — start an audit to populate Last 10 Digital Audits"
                                : digRelation === "all"
                                  ? "Data unavailable"
                                  : "No audits match this assignment filter"}
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <CreateCustomMetricDialog
        open={customOpen}
        onOpenChange={setCustomOpen}
        tab={tabKey}
        existing={customMetrics.items}
        audits={
          tabKey === "digital"
            ? (dig?.lastTen ?? []).map((r) => ({
                id: r.id,
                auditName: r.auditName,
                templateName: r.templateName || r.auditName,
                storeName: r.store,
                assigneeName: r.assignee,
                type: "Digital",
                completionStage: "completed" as const,
                date: r.date,
                scorePct: null,
                scanId: r.scanId,
                relation: r.relation,
              }))
            : (data?.lastTen ?? [])
        }
        onSave={(metric) => void saveCustomMetric(metric)}
      />

      <AiAnalysisModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        report={modalReport}
        incomplete={modalIncomplete}
      />
    </div>
  );
}
