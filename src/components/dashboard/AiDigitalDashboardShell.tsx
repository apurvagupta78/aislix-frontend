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
  ChevronDown,
  ChevronRight,
  Info,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { AskAislixSection } from "@/components/ask-aislix/AskAislixSection";
import type { SuggestionDataAvailability } from "@/lib/ask-aislix/ask-aislix-suggestions.select";
import { WorkspaceFilterBar, WorkspaceFiltersToggle } from "@/components/filters/GlobalFilterBarShell";
import { MpDonut, MpRankBars } from "@/components/control-tower/MpCharts";
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
  type MetricCardSpan,
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
import { AISLIX } from "@/lib/aislix-theme";
import { AISLIX_PALETTE, CHART_SERIES } from "@/lib/ai-audit/kpi-palette";
import { DashboardOverviewPanel } from "@/components/dashboard/DashboardOverviewPanel";
import { AiActionsSlaSection, AiVarianceSection } from "@/components/dashboard/AiDashboardInsights";
import { fetchAiVarianceSummary } from "@/lib/ai-variance-summary";
import { fetchAiDashboardActions } from "@/lib/ai-dashboard-actions";
import { SegmentHomePanel } from "@/components/dashboard/SegmentHomePanel";
import {
  fetchNotificationPreferences,
  updateNotificationPreferences,
} from "@/lib/account";
import {
  catalogForTab,
  defaultDashboardLayout,
  defaultTabLayout,
  isCustomCardId,
  isPrimaryCard,
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

const CHART_COLORS = CHART_SERIES;

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

function cardSpan(id: string): MetricCardSpan {
  if (id.startsWith("kpi_") || isCustomCardId(id)) return "one";
  return SPAN2_CARD_IDS.has(id) ? "full" : "half";
}

type KpiStatus = "risk";

const STATUS_DOT: Record<KpiStatus, { color: string; label: string }> = {
  risk: { color: "#ECBDCC", label: "Needs attention" },
};

/** Pink dot only when a count of overdue items is above zero. */
function overdueStatus(empty: boolean, value: number | null | undefined): KpiStatus | undefined {
  return !empty && value != null && Number.isFinite(value) && value > 0 ? "risk" : undefined;
}

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
    <div className="rounded-xl border border-[#D9E2E8] bg-white px-4 py-4">
      <p className="text-sm font-semibold text-[#04203F]">
        No {kind === "ai" ? "AI" : "digital"} audits yet
      </p>
      <p className="mt-1 text-sm text-[#667085]">
        Numbers show N/A until your first audit is done.
      </p>
      <Link
        to="/new-audit"
        className="mt-3 inline-flex rounded-lg bg-[#04203F] px-3 py-2 text-xs font-medium text-white"
      >
        Start an audit
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

const STAGE_DOT: Record<LastTenAuditRow["completionStage"], { label: string; color: string }> = {
  completed: { label: "Completed", color: AISLIX_PALETTE.green },
  in_progress: { label: "In progress", color: AISLIX_PALETTE.purple },
  not_started: { label: "Not started", color: AISLIX_PALETTE.grey },
};

function StagePill({ stage }: { stage: LastTenAuditRow["completionStage"] }) {
  const m = STAGE_DOT[stage];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-[#04203F]">
      <span className="size-2 rounded-full" style={{ background: m.color }} aria-hidden />
      {m.label}
    </span>
  );
}

const CARD_CLASS = "block h-full rounded-xl border border-[#D9E2E8] bg-white p-4";
const CARD_LINK_CLASS = "transition-colors duration-150 hover:border-[#9FB3C8]";

/** Neutral KPI card: label, big number, optional status dot. The whole card links when `moreTo` is set. */
function KpiCard({
  label,
  value,
  accent: _accent,
  status,
  delta,
  moreTo,
  context,
  footer,
  formula,
}: {
  label: string;
  value: string;
  /** Accepted for compatibility; cards are neutral. */
  accent?: string;
  status?: KpiStatus;
  delta?: number | null;
  moreTo?: string;
  context?: string;
  footer?: React.ReactNode;
  formula?: string;
}) {
  void _accent;
  const dot = status ? STATUS_DOT[status] : null;
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm text-[#667085]">
          {label}
          {dot ? (
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ background: dot.color }}
              role="img"
              aria-label={dot.label}
            />
          ) : null}
        </p>
        <div className="flex items-center gap-1">
          {formula ? (
            <span title={formula} className="text-[#98A2B3]">
              <Info className="size-3.5" aria-label="How this is calculated" />
            </span>
          ) : null}
          {delta != null && Number.isFinite(delta) ? (
            <span className="inline-flex items-center text-xs font-medium text-[#667085]">
              {delta >= 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
              {Math.abs(delta).toFixed(0)}
            </span>
          ) : null}
        </div>
      </div>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums text-[#04203F]">{value}</p>
      {context ? <p className="mt-1 text-xs text-[#667085]">{context}</p> : null}
    </>
  );

  if (moreTo && !footer) {
    return (
      <Link to={moreTo} className={cn(CARD_CLASS, CARD_LINK_CLASS)}>
        {body}
      </Link>
    );
  }
  return (
    <div className={CARD_CLASS}>
      {body}
      {footer}
    </div>
  );
}

/** Section title that doubles as the link to the full page (replaces "View more"). */
function TitleLink({ title, to }: { title: string; to?: string }) {
  if (!to) return <h3 className="text-sm font-semibold text-[#04203F]">{title}</h3>;
  return (
    <h3 className="text-sm font-semibold text-[#04203F]">
      <Link to={to} className="group inline-flex items-center gap-0.5 hover:underline">
        {title}
        <ChevronRight className="size-4 text-[#98A2B3] group-hover:text-[#04203F]" aria-hidden />
      </Link>
    </h3>
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
      <div className="mb-3">
        <TitleLink title={title} to={moreTo} />
      </div>
      {children}
    </div>
  );
}

/** One quiet line of headline counts; findings and actions link to their pages. */
function SummaryLine({ parts, links }: { parts: string[]; links: { to: string; label: string }[] }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[#667085]">
      {parts.map((p, i) => (
        <span key={p} className="inline-flex items-center gap-2">
          {i > 0 ? <span aria-hidden>·</span> : null}
          {p}
        </span>
      ))}
      {links.map((l) => (
        <span key={l.to} className="inline-flex items-center gap-2">
          <span aria-hidden>·</span>
          <Link to={l.to} className="font-medium text-[#04203F] hover:underline">
            {l.label}
          </Link>
        </span>
      ))}
    </p>
  );
}

/** Small label/value pair used in the "last audit" panels instead of tinted pills. */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-[#667085]">{label}</dt>
      <dd className="text-sm font-semibold tabular-nums text-[#04203F]">{value}</dd>
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
          <DialogTitle className="text-[#04203F]">AI analysis</DialogTitle>
        </DialogHeader>
        {incomplete ? (
          <p className="text-sm text-[#667085]">Finish the audit first to see its AI analysis.</p>
        ) : report ? (
          <div className="space-y-3 text-sm text-[#04203F]">
            <p className="font-medium">
              {report.auditName} · {report.storeName} · {fmtDate(report.date)}
            </p>
            <dl className="flex flex-wrap gap-x-6 gap-y-2">
              <Stat label="Compliance" value={fmt(report.compliancePct, "%")} />
              <Stat label="Findings" value={String(report.findingsCount)} />
              <Stat label="Confidence" value={fmt(report.confidencePct, "%")} />
            </dl>
            <ul className="list-disc space-y-1 pl-5 text-[#667085]">
              <li>
                <span className="font-medium text-[#04203F]">Good:</span> {report.good}
              </li>
              <li>
                <span className="font-medium text-[#04203F]">Attention:</span> {report.attention}
              </li>
              <li>
                <span className="font-medium text-[#04203F]">Next action:</span> {report.nextAction}
              </li>
            </ul>
            {report.scanId ? (
              <a
                href={`/results?scan=${encodeURIComponent(report.scanId)}`}
                className="inline-flex rounded-lg bg-[#04203F] px-3 py-2 text-xs font-medium text-white"
              >
                Open full report
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
    <div className="flex flex-wrap items-center gap-1.5">
      {(
        [
          ["all", "All"],
          ["completed", "Completed"],
          ["in_progress", "In progress"],
          ["not_started", "Not started"],
        ] as const
      ).map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            completion === id
              ? "border-[#04203F] bg-[#04203F] text-white"
              : "border-[#D9E2E8] bg-white text-[#667085] hover:text-[#04203F]",
          )}
        >
          {label}
        </button>
      ))}
      <span className="ml-1 text-xs text-[#667085]">{scopeLabel ?? "Showing your stores"}</span>
    </div>
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
  const [showAllMetrics, setShowAllMetrics] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filterKey = global?.filters
    ? {
        storeId: global.filters.storeId,
        category: global.filters.category,
        subCategory: global.filters.subCategory,
        teamMemberId: global.filters.teamMemberId,
        teamManagerId: global.filters.teamManagerId,
        datePreset: global.filters.datePreset,
        dateFrom: global.filters.dateFrom,
        dateTo: global.filters.dateTo,
        country: global.filters.country,
        city: global.filters.city,
        skuId: global.filters.skuId,
        completion,
      }
    : { completion };

  const setTab = (next: DashboardTab | "overview") => {
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
    staleTime: 60_000,
  });
  const digitalQuery = useQuery({
    queryKey: ["dashboard-digital-metrics-v2", filterKey, demoPreview.previewDemo],
    queryFn: () =>
      fetchDigitalDashboardMetrics(filterKey, {
        previewDemo: demoPreview.previewDemo,
        userEmail: demoPreview.userEmail,
      }),
    staleTime: 60_000,
    // Don't compete with AI dashboard on first paint — load digital when that tab is open
    // (or after AI settles so Ask Aislix can still see digital signals quickly).
    enabled: tab !== "ai" || (!opsQuery.isPending && Boolean(opsQuery.data)),
  });

  const { completion: _completion, ...insightFilters } = filterKey;
  const varianceQuery = useQuery({
    queryKey: ["dashboard-ai-variances-v1", insightFilters, demoPreview.previewDemo],
    queryFn: () =>
      fetchAiVarianceSummary(insightFilters, {
        previewDemo: demoPreview.previewDemo,
        userEmail: demoPreview.userEmail,
      }),
    staleTime: 60_000,
    enabled: tab === "ai",
  });
  const aiActionsQuery = useQuery({
    queryKey: ["dashboard-ai-actions-v1", insightFilters, demoPreview.previewDemo],
    queryFn: () =>
      fetchAiDashboardActions(insightFilters, {
        previewDemo: demoPreview.previewDemo,
        userEmail: demoPreview.userEmail,
      }),
    staleTime: 60_000,
    enabled: tab === "ai",
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
    // While AI ops loads, keep legacy chips (null = no data filter). Don't wait on digital.
    if (opsQuery.isPending) return null;
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
              className="mt-2 inline-flex items-center gap-1 text-xs text-[#04203F] hover:underline"
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
          <div className="rounded-xl border border-[#D9E2E8] bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[#04203F]">
                  Last completed audit
                  {data?.lastReport?.submitted === false ? (
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#D9E2E8] bg-white px-2 py-0.5 text-[11px] font-medium text-[#04203F]"
                      title="The AI analysis is finished; the audit has not been submitted yet."
                    >
                      <span className="size-1.5 rounded-full bg-[#9B86D9]" aria-hidden />
                      Not submitted
                    </span>
                  ) : null}
                </h3>
                {data?.lastReport ? (
                  <p className="mt-0.5 text-xs text-[#667085]">
                    {data.lastReport.auditName} · {data.lastReport.storeName} ·{" "}
                    {fmtDate(data.lastReport.date)}
                  </p>
                ) : null}
              </div>
              {data?.lastReport ? (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (data.lastReport) {
                        setModalIncomplete(false);
                        setModalReport(data.lastReport);
                        setModalOpen(true);
                      }
                    }}
                  >
                    Summary
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    {data.lastReport.scanId ? (
                      <Link to="/results" search={{ scan: data.lastReport.scanId }}>
                        Open report
                      </Link>
                    ) : (
                      <Link to="/history">Open report</Link>
                    )}
                  </Button>
                </div>
              ) : null}
            </div>
            {data?.lastReport ? (
              <div className="mt-3 space-y-3">
                <dl className="flex flex-wrap gap-x-8 gap-y-2">
                  <Stat label="Compliance" value={fmt(data.lastReport.compliancePct, "%")} />
                  <Stat label="Findings" value={String(data.lastReport.findingsCount)} />
                  <Stat label="Confidence" value={fmt(data.lastReport.confidencePct, "%")} />
                </dl>
                <ul className="space-y-1.5 text-sm text-[#667085]">
                  <li>
                    <span className="font-semibold text-[#04203F]">Good:</span> {data.lastReport.good}
                  </li>
                  <li>
                    <span className="font-semibold text-[#04203F]">Attention:</span>{" "}
                    {data.lastReport.attention}
                  </li>
                  <li>
                    <span className="font-semibold text-[#04203F]">Next action:</span>{" "}
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
                  ? "N/A — start an audit to see its AI analysis here."
                  : "No completed audit in this period."}
              </p>
            )}
          </div>
        );
      case "kpi_verification":
        return (
          <KpiCard
            label="Verification coverage"
            value={fmtOrEmpty(emptyRealAi, ai?.verificationCoveragePct, "%")}
            accent={accent}
            moreTo="/history"
          />
        );
      case "kpi_planogram":
        return (
          <KpiCard
            label="Planogram compliance"
            value={fmtOrEmpty(emptyRealAi, ai?.planogram.compliancePct, "%")}
            accent={accent}
            moreTo="/history"
          />
        );
      case "kpi_total_audits":
        return (
          <KpiCard
            label="Total audits"
            value={fmtOrEmpty(
              emptyRealAi,
              data?.executive.audits
                ?? data?.synopsis?.historyCount
                ?? ((data?.completionMix ?? []).reduce((sum, row) => sum + (row.value || 0), 0)
                  || ai?.auditCount),
            )}
            accent={accent}
            moreTo="/history"
          />
        );
      case "kpi_confidence":
        return (
          <KpiCard
            label="Average confidence"
            value={fmtOrEmpty(emptyRealAi, confPct, "%")}
            accent={accent}
            moreTo="/history"
          />
        );
      case "kpi_products":
        return (
          <KpiCard
            label="Products identified"
            value={fmtOrEmpty(emptyRealAi, ai?.productsIdentified)}
            accent={accent}
          />
        );
      case "kpi_brands":
        return (
          <KpiCard
            label="Brands identified"
            value={fmtOrEmpty(emptyRealAi, ai?.brandsIdentified)}
            accent={accent}
          />
        );
      case "kpi_facings":
        return (
          <KpiCard
            label="Total facings"
            value={fmtOrEmpty(emptyRealAi, ai?.totalFacings)}
            accent={accent}
          />
        );
      case "kpi_units":
        return (
          <KpiCard
            label="Visible units"
            value={fmtOrEmpty(emptyRealAi, ai?.totalVisibleUnits)}
            accent={accent}
          />
        );
      case "chart_planogram":
        return (
          <ChartCard title="Planogram: expected vs actual" moreTo="/history">
            {planogramGrouped.length ? (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={planogramGrouped}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E7EDF0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="expected" fill={AISLIX_PALETTE.blue} name="Expected" />
                    <Bar dataKey="actual" fill={AISLIX_PALETTE.purple} name="Actual" />
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
      case "chart_field_match": {
        const rows = (ai?.fieldMatchRates ?? []).filter((r) => r.checked > 0);
        return (
          <ChartCard title="Plan vs AI detected" moreTo="/history">
            <p className="-mt-1 mb-3 text-xs text-[#667085]">
              Planned products where what the AI read from the photo matched the plan.
            </p>
            {rows.length ? (
              <MpRankBars
                max={100}
                data={rows.map((r) => ({
                  label: r.notVisible ? `${r.label} · ${r.notVisible} not visible in photo` : r.label,
                  value: Math.round((r.matched / r.checked) * 100),
                  display: `${Math.round((r.matched / r.checked) * 100)}% · ${r.matched} of ${r.checked}`,
                  color: AISLIX_PALETTE.green,
                }))}
              />
            ) : (
              <p className="text-sm text-[#667085]">Data unavailable — no planogram audits yet.</p>
            )}
          </ChartCard>
        );
      }
      case "chart_ai_accuracy": {
        const rows = ai?.aiAccuracyByField ?? [];
        const audits = ai?.verifiedAudits;
        return (
          <ChartCard title="AI accuracy vs human checks" moreTo="/history">
            <p className="-mt-1 mb-3 text-xs text-[#667085]">
              {audits?.total
                ? `Human verified in ${audits.verified} of ${audits.total} recent audits. Share of checked fields where the AI read the same value.`
                : "Share of human-checked fields where the AI read the same value."}
            </p>
            {rows.length ? (
              <MpRankBars
                max={100}
                data={rows.map((r) => ({
                  label: r.label,
                  value: Math.round((r.agreed / r.verified) * 100),
                  display: `${Math.round((r.agreed / r.verified) * 100)}% · ${r.agreed} of ${r.verified}`,
                  color: AISLIX_PALETTE.blue,
                }))}
              />
            ) : (
              <p className="text-sm text-[#667085]">
                Verification required — no fields have been human verified yet.
              </p>
            )}
          </ChartCard>
        );
      }
      case "chart_open_by_field": {
        const rows = ai?.openFindingsByField ?? [];
        return (
          <ChartCard title="Open corrective actions by field" moreTo="/corrective-actions">
            {rows.length ? (
              <MpRankBars
                data={rows.map((r) => ({ label: r.label, value: r.value, color: AISLIX_PALETTE.purple }))}
                unit=" open"
              />
            ) : (
              <p className="text-sm text-[#667085]">No open AI corrective actions.</p>
            )}
          </ChartCard>
        );
      }
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
          <ChartCard title="Audits over time" moreTo="/history">
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
                      stroke={AISLIX_PALETTE.purple}
                      strokeWidth={2}
                      dot={{ fill: AISLIX_PALETTE.purple }}
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
          <ChartCard title="Brand share of facings" moreTo="/audit-intelligence">
            <BrandShareMultiRing rows={ai?.brandShare ?? []} />
          </ChartCard>
        );
      case "chart_category":
        return (
          <ChartCard title="Category share of facings" moreTo="/audit-intelligence">
            <CategoryShareDonut rows={ai?.categoryShare ?? []} />
          </ChartCard>
        );
      case "chart_units":
        return (
          <ChartCard title="Top products by visible units" moreTo="/audit-intelligence">
            <ProductRankingCards rows={ai?.topProductsByUnits ?? []} />
          </ChartCard>
        );
      case "chart_low_compliance":
        return (
          <ChartCard title="Stores with low planogram compliance" moreTo="/history">
            <BrandShareMultiRing
              rows={(data?.lowComplianceStores ?? []).map((s) => ({
                label: s.storeName,
                value: s.compliancePct,
              }))}
              colorAt={() => AISLIX_PALETTE.pink}
            />
          </ChartCard>
        );
      case "chart_performers_high":
        return (
          <ChartCard title="Best-performing stores" moreTo="/history">
            <PerformanceLeaderboard
              tone="high"
              rows={(data?.topPerformers ?? []).map((p) => ({
                storeName: p.storeName,
                score: p.composite,
              }))}
            />
          </ChartCard>
        );
      case "chart_performers_low":
        return (
          <ChartCard title="Stores that need attention" moreTo="/history">
            <PerformanceLeaderboard
              tone="low"
              rows={(data?.worstPerformers ?? []).map((p) => ({
                storeName: p.storeName,
                score: p.composite,
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
        <div className="rounded-xl border border-[#D9E2E8] bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-[#04203F]">Last completed digital audit</h3>
              {row ? (
                <p className="mt-0.5 text-xs text-[#667085]">
                  {row.auditName} · {row.store} · {fmtDate(row.date)}
                </p>
              ) : null}
            </div>
            {row ? (
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => void openDigitalAnalysis(row)}
                >
                  Summary
                </Button>
                <Button asChild variant="outline" size="sm">
                  {row.scanId ? (
                    <Link to="/results" search={{ scan: row.scanId }}>
                      Open report
                    </Link>
                  ) : (
                    <Link to="/history">Open history</Link>
                  )}
                </Button>
              </div>
            ) : null}
          </div>
          {row ? (
            <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-2">
              <Stat label="Expected" value={fmt(row.expected)} />
              <Stat label="Actual" value={fmt(row.actual)} />
              <Stat label="Variance" value={fmt(row.variance)} />
              <Stat label="Status" value={assignmentStatusLabel(row.status)} />
              <Stat label="Findings" value={fmt(row.findingsCount)} />
              <Stat label="Actions" value={fmt(row.caCount)} />
              <Stat label="Re-audit" value={row.reauditStatus} />
            </dl>
          ) : (
            <div className="mt-3 space-y-3">
              <p className="text-sm text-[#667085]">
                {emptyRealDigital
                  ? "N/A — start a digital audit to see its summary here."
                  : "No digital audits in this period."}
              </p>
              {emptyRealDigital ? (
                <Link
                  to="/new-audit"
                  className="inline-flex rounded-lg bg-[#04203F] px-3 py-2 text-xs font-medium text-white"
                >
                  Start an audit
                </Link>
              ) : null}
            </div>
          )}
        </div>
      );
    }
    const tip = digitalKpiTooltip(id);
    const kpis: Record<string, [string, string, KpiStatus?]> = {
      kpi_total: ["Total digital audits", fmtOrEmpty(emptyRealDigital, dig?.totalAudits)],
      kpi_completed: ["Completed", fmtOrEmpty(emptyRealDigital, dig?.completed)],
      kpi_in_progress: ["In progress", fmtOrEmpty(emptyRealDigital, dig?.inProgress)],
      kpi_pending_review: ["Pending review", fmtOrEmpty(emptyRealDigital, dig?.pendingReview)],
      kpi_reaudit_requested: [
        "Re-audit requested",
        fmtOrEmpty(emptyRealDigital, dig?.reauditRequested),
      ],
      kpi_overdue: [
        "Overdue audits",
        fmtOrEmpty(emptyRealDigital, dig?.overdue),
        overdueStatus(emptyRealDigital, dig?.overdue),
      ],
      kpi_completion_pct: ["Completion", fmtOrEmpty(emptyRealDigital, dig?.completionPct, "%")],
      kpi_ontime_pct: ["On-time completion", fmtOrEmpty(emptyRealDigital, dig?.onTimePct, "%")],
      kpi_total_expected: ["Total expected", fmtOrEmpty(emptyRealDigital, dig?.totalExpected)],
      kpi_total_actual: ["Total actual", fmtOrEmpty(emptyRealDigital, dig?.totalActual)],
      kpi_net_variance: ["Net variance", fmtOrEmpty(emptyRealDigital, dig?.netVariance)],
      kpi_abs_variance: ["Absolute variance", fmtOrEmpty(emptyRealDigital, dig?.absoluteVariance)],
      kpi_variance_pct: ["Variance", fmtOrEmpty(emptyRealDigital, dig?.variancePct, "%")],
      kpi_ca_open: ["Open actions", fmtOrEmpty(emptyRealDigital, dig?.caOpen)],
      kpi_ca_in_progress: ["Actions in progress", fmtOrEmpty(emptyRealDigital, dig?.caInProgress)],
      kpi_ca_completed: ["Actions completed", fmtOrEmpty(emptyRealDigital, dig?.caClosed)],
      kpi_ca_overdue: [
        "Overdue actions",
        fmtOrEmpty(emptyRealDigital, dig?.caOverdue),
        overdueStatus(emptyRealDigital, dig?.caOverdue),
      ],
      kpi_ca_closure: ["Closure rate", fmtOrEmpty(emptyRealDigital, dig?.caClosurePct, "%")],
      kpi_ca_sla: ["SLA compliance", fmtOrEmpty(emptyRealDigital, dig?.caSlaPct, "%")],
    };
    const kpi = kpis[id];
    if (kpi) {
      return (
        <KpiCard
          label={kpi[0]}
          value={kpi[1]}
          status={kpi[2]}
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
        <ChartCard title="Corrective actions" moreTo="/corrective-actions">
          <dl className="mb-4 flex flex-wrap gap-x-8 gap-y-2">
            <Stat label="Total" value={fmt(emptyRealDigital ? null : dig?.caTotal)} />
            <Stat label="Open" value={fmt(emptyRealDigital ? null : dig?.caOpen)} />
            <Stat label="In progress" value={fmt(emptyRealDigital ? null : dig?.caInProgress)} />
            <Stat label="Completed" value={fmt(emptyRealDigital ? null : dig?.caClosed)} />
            <Stat label="Overdue" value={fmt(emptyRealDigital ? null : dig?.caOverdue)} />
            <Stat label="Closure rate" value={fmt(emptyRealDigital ? null : dig?.caClosurePct, "%")} />
          </dl>
          {mix.length && !emptyRealDigital ? (
            <div className="space-y-2">
              <div className="flex h-3 overflow-hidden rounded-full">
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
              <p className="text-xs text-[#667085]">SLA compliance {fmt(dig?.caSlaPct, "%")}</p>
            </div>
          ) : (
            <p className="text-sm text-[#667085]">
              {emptyRealDigital ? "N/A — start an audit to see corrective actions." : "Data unavailable"}
            </p>
          )}
        </ChartCard>
      );
    }

    if (id === "chart_variance_rank") {
      const rows = (dig?.varianceByStore?.length ? dig.varianceByStore : dig?.varianceByCategory) ?? [];
      return (
        <ChartCard title="Largest variances (units)" moreTo="/intelligence/inventory-variance">
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
                : "N/A — needs expected and actual counts"}
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
                : "Comparison unavailable — no audits with expected and actual counts."}
            </p>
          ) : !compatible ? (
            <p className="text-sm text-[#667085]">
              Comparison unavailable — these audits use different measurement structures.
            </p>
          ) : (
            <>
              <p className="mb-3 text-xs text-[#667085]">
                Net variance: A {fmt(a?.variance)} · B {fmt(b?.variance)}
              </p>
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
    const cards: { id: string; title: string; body: React.ReactNode }[] = [];
    for (const id of visibleIds) {
      const def = catalog.find((c) => c.id === id);
      if (!def) continue;
      const accent = CHART_COLORS[accentIndex % CHART_COLORS.length]!;
      const body = render(id, accent);
      if (body == null) continue;
      accentIndex += 1;
      cards.push({ id, title: def.title, body });
    }
    // While customizing, every card is shown so drag-and-drop covers the whole layout.
    const primary = editLayout ? cards : cards.filter((c) => isPrimaryCard(tabKey, c.id));
    const extra = editLayout ? [] : cards.filter((c) => !isPrimaryCard(tabKey, c.id));

    const grid = (list: typeof cards) => (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {list.map((c) => (
          <SortableMetricCard
            key={c.id}
            id={c.id}
            title={c.title}
            editMode={editLayout}
            span={cardSpan(c.id)}
            onHide={() => hideCard(c.id)}
            onDragStart={sectionDrag.onDragStart}
            onDragOver={sectionDrag.onDragOver}
            onDrop={sectionDrag.onDrop}
          >
            {c.body}
          </SortableMetricCard>
        ))}
      </div>
    );

    return (
      <div className="space-y-3">
        {primary.length ? grid(primary) : null}
        {extra.length ? (
          <>
            <button
              type="button"
              onClick={() => setShowAllMetrics((v) => !v)}
              aria-expanded={showAllMetrics}
              className="inline-flex items-center gap-1 rounded-lg py-1 text-sm font-medium text-[#04203F] hover:underline"
            >
              {showAllMetrics ? "Show fewer metrics" : `Show all metrics (${extra.length})`}
              <ChevronDown
                className={cn("size-4 transition-transform", showAllMetrics && "rotate-180")}
                aria-hidden
              />
            </button>
            {showAllMetrics ? grid(extra) : null}
          </>
        ) : null}
        {!visibleIds.length ? (
          <p className="rounded-xl border border-dashed border-[#D9E2E8] p-4 text-sm text-[#667085]">
            All cards are hidden. Use Customize → Add card to bring them back.
          </p>
        ) : null}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Your stores, audits and actions at a glance."
        actions={
          <DemoPreviewToggle
            compact
            locked={isGuest}
            enabled={demoPreview.previewDemo}
            onChange={demoPreview.setPreviewDemo}
          />
        }
      />

      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-[#D9E2E8]">
        <div role="tablist" aria-label="Dashboard view" className="-mb-px flex gap-5">
          {(
            [
              ["overview", "Overview"],
              ["ai", "AI audits"],
              ["digital", "Digital audits"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={cn(
                "border-b-2 pb-2.5 pt-1 text-sm font-medium transition-colors",
                tab === id
                  ? "border-[#04203F] text-[#04203F]"
                  : "border-transparent text-[#667085] hover:text-[#04203F]",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mb-1.5 flex items-center gap-1.5">
          {tab !== "ai" ? (
            <WorkspaceFiltersToggle
              open={filtersOpen}
              onToggle={() => setFiltersOpen((v) => !v)}
              className="h-8 text-xs"
            />
          ) : null}
          {tab !== "overview" ? (
            <button
              type="button"
              onClick={() => setEditLayout((v) => !v)}
              className={cn(
                "h-8 rounded-lg px-2.5 text-xs font-medium transition-colors",
                editLayout
                  ? "bg-[#04203F] text-white"
                  : "text-[#667085] hover:bg-[#F4F7F9] hover:text-[#04203F]",
              )}
            >
              {editLayout ? "Done" : "Customize"}
            </button>
          ) : null}
        </div>
      </div>

      {tab === "ai" ? <WorkspaceFilterBar extended /> : filtersOpen ? <WorkspaceFilterBar /> : null}

      {tab === "overview" ? (
        <div className="flex flex-col gap-6">
          <AskAislixSection
            previewDemo={demoPreview.previewDemo || Boolean(data?.labeledDemo)}
            dataAvailability={askDataAvailability}
            city={global?.filters?.city ?? null}
          />
          <DashboardOverviewPanel
            ai={data}
            digital={dig}
            aiLoading={opsQuery.isPending}
            digitalLoading={digitalQuery.isPending}
            emptyAi={emptyRealAi}
            emptyDigital={emptyRealDigital}
          >
            <SegmentHomePanel
              filters={global?.filters ?? null}
              previewDemo={demoPreview.previewDemo}
              userEmail={demoPreview.userEmail}
            />
          </DashboardOverviewPanel>
        </div>
      ) : null}

      {editLayout && tab !== "overview" ? (
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

      {tab === "overview" ? null : tabKey === "ai" ? (
        <div className="flex flex-col gap-6">
          <AskAislixSection
            previewDemo={demoPreview.previewDemo || Boolean(data?.labeledDemo)}
            dataAvailability={askDataAvailability}
            city={global?.filters?.city ?? null}
          />

          {opsQuery.isPending ? (
            <div className="space-y-3 py-2" aria-busy="true" aria-live="polite">
              <p className="text-sm text-[#667085]">Loading AI dashboard…</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-24 animate-pulse rounded-xl border border-[#D9E2E8] bg-[#F4F7F9]"
                  />
                ))}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="h-48 animate-pulse rounded-xl border border-[#D9E2E8] bg-[#F4F7F9]" />
                <div className="h-48 animate-pulse rounded-xl border border-[#D9E2E8] bg-[#F4F7F9]" />
              </div>
            </div>
          ) : (
            <>
              {emptyRealAi ? <EmptyScopeBanner kind="ai" /> : null}
              <SummaryLine
                parts={
                  emptyRealAi
                    ? ["N/A audits", "N/A complete", "N/A open critical"]
                    : [
                        `${data?.executive.audits ?? 0} audits`,
                        `${fmt(data?.executive.completionPct, "%")} complete`,
                        `${data?.executive.openCritical ?? 0} open critical`,
                      ]
                }
                links={
                  emptyRealAi
                    ? []
                    : [
                        { to: "/findings", label: `${data?.synopsis.findingsOpen ?? 0} open findings` },
                        { to: "/corrective-actions", label: `${data?.synopsis.caOpen ?? 0} open actions` },
                      ]
                }
              />

              {renderMetricGrid(renderAiCard)}

              <AiVarianceSection summary={varianceQuery.data} loading={varianceQuery.isPending} />
              <AiActionsSlaSection actions={aiActionsQuery.data} loading={aiActionsQuery.isPending} />

              <div className="overflow-hidden rounded-xl border border-[#D9E2E8] bg-white">
                <div className="p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <TitleLink title="Last 10 audits" to="/history" />
                  <CompletionChips
                    completion={completion}
                    onChange={setCompletion}
                    scopeLabel={data?.scopeLabel}
                  />
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
                            ? "bg-[#04203F] text-white"
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
                    <option value="in_progress">In progress</option>
                    <option value="not_started">Not started</option>
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
                    <option value="date">Sort by date</option>
                    <option value="score">Sort by score</option>
                    <option value="completion">Sort by completion</option>
                  </select>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[960px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-[#D9E2E8] text-xs font-medium text-[#667085]">
                        <th className="py-2 pr-3 font-medium">Audit</th>
                        <th className="py-2 pr-3 font-medium">Template</th>
                        <th className="py-2 pr-3 font-medium">Store</th>
                        <th className="py-2 pr-3 font-medium">Assignee</th>
                        <th className="py-2 pr-3 font-medium">Type</th>
                        <th className="py-2 pr-3 font-medium">Completion</th>
                        <th className="py-2 pr-3 font-medium">Date</th>
                        <th className="py-2 pr-3 font-medium">Score</th>
                        <th className="py-2 font-medium"><span className="sr-only">Actions</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLastTen.map((row) => (
                        <tr key={row.id} className="border-b border-[#EEF1F4]">
                          <td className="py-2 pr-3 font-medium text-[#04203F]">{row.auditName}</td>
                          <td className="py-2 pr-3 text-[#667085]">{row.templateName || "—"}</td>
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
                              onClick={() => void openAiAnalysis(row)}
                            >
                              AI analysis
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
              <SummaryLine
                parts={
                  emptyRealDigital
                    ? ["N/A digital audits", "N/A complete", "N/A overdue"]
                    : [
                        `${dig?.totalAudits ?? 0} digital audits`,
                        `${fmt(dig?.completionPct, "%")} complete`,
                        `${dig?.overdue ?? 0} overdue`,
                      ]
                }
                links={
                  emptyRealDigital
                    ? []
                    : [
                        { to: "/findings", label: `${data?.synopsis.findingsOpen ?? 0} open findings` },
                        ...(dig?.caOpen != null
                          ? [{ to: "/corrective-actions", label: `${dig.caOpen} open actions` }]
                          : []),
                      ]
                }
              />

              {renderMetricGrid(renderDigitalCard)}

              <div className="overflow-hidden rounded-xl border border-[#D9E2E8] bg-white">
                <div className="p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <TitleLink title="Last 10 digital audits" to="/history" />
                    <CompletionChips
                      completion={completion}
                      onChange={setCompletion}
                      scopeLabel={data?.scopeLabel}
                    />
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
                              ? "bg-[#04203F] text-white"
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
                        <tr className="border-b border-[#D9E2E8] text-xs font-medium text-[#667085]">
                          <th className="py-2 pr-3 font-medium">Audit</th>
                          <th className="py-2 pr-3 font-medium">Template</th>
                          <th className="py-2 pr-3 font-medium">Location</th>
                          <th className="py-2 pr-3 font-medium">Assignee</th>
                          <th className="py-2 pr-3 font-medium">Date</th>
                          <th className="py-2 pr-3 font-medium">Status</th>
                          <th className="py-2 pr-3 font-medium">Expected</th>
                          <th className="py-2 pr-3 font-medium">Actual</th>
                          <th className="py-2 pr-3 font-medium">Variance</th>
                          <th className="py-2 pr-3 font-medium">Findings</th>
                          <th className="py-2 pr-3 font-medium">CA</th>
                          <th className="py-2 pr-3 font-medium">Re-audit</th>
                          <th className="py-2 font-medium"><span className="sr-only">Actions</span></th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredDigLastTen.map((row: DigitalLastTenRow) => (
                          <tr key={row.id} className="border-b border-[#EEF1F4]">
                            <td className="py-2 pr-3 font-medium text-[#04203F]">{row.auditName}</td>
                            <td className="py-2 pr-3 text-[#667085]">
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
                                onClick={() => void openDigitalAnalysis(row)}
                              >
                                AI analysis
                              </Button>
                            </td>
                          </tr>
                        ))}
                        {!filteredDigLastTen.length ? (
                          <tr>
                            <td colSpan={13} className="py-6 text-[#667085]">
                              {emptyRealDigital
                                ? "N/A — start an audit to see it here"
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
