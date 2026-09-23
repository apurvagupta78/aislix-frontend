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
  Plus,
  ShoppingCart,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { AskAislixSection } from "@/components/ask-aislix/AskAislixSection";
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
} from "@/lib/dashboard-ai-digital";
import { useOptionalGlobalFilters } from "@/lib/global-filters";
import { assignmentStatusLabel } from "@/lib/assignment-status-ui";
import { useDemoPreview } from "@/lib/use-demo-preview";
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
  "chart_planogram",
  "chart_top_facings",
  "chart_completion",
  "chart_trend",
  "chart_brand",
  "chart_category",
  "chart_units",
  "chart_low_compliance",
]);

type AssignmentFilter = "all" | "assigned_to_me" | "assigned_by_me";

function fmt(value: number | null | undefined, suffix = ""): string {
  if (value == null || Number.isNaN(value)) return "N/A";
  if (!Number.isFinite(value)) return "Data unavailable";
  return `${Number.isInteger(value) ? value : value.toFixed(1)}${suffix}`;
}

function fmtDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
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
}: {
  label: string;
  value: string;
  accent: string;
  delta?: number | null;
  moreTo?: string;
  context?: string;
  footer?: React.ReactNode;
}) {
  return (
    <div
      className="h-full rounded-xl border border-[#D9E2E8] bg-white p-4"
      style={{ borderLeftWidth: 3, borderLeftColor: accent }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-[#667085]">{label}</p>
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
      <p className="mt-2 text-2xl font-semibold text-[#102A43]">{value}</p>
      {context ? <p className="mt-1 text-xs text-[#557187]">{context}</p> : null}
      {moreTo ? (
        <a href={moreTo} className="mt-2 inline-block text-xs text-[#557187] hover:underline">
          View more
        </a>
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
                href="/history"
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
  const queryClient = useQueryClient();
  const [completion, setCompletion] = useState<CompletionFilter>("all");
  const [tableStage, setTableStage] = useState<string>("all");
  const [tableTemplate, setTableTemplate] = useState<string>("all");
  const [tableAssignee, setTableAssignee] = useState<string>("all");
  const [tableStore, setTableStore] = useState<string>("all");
  const [tableRelation, setTableRelation] = useState<AssignmentFilter>("all");
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
    queryKey: ["dashboard-digital-metrics", filterKey, demoPreview.previewDemo],
    queryFn: () => fetchDigitalDashboardMetrics(filterKey),
    staleTime: 30_000,
  });

  const data = opsQuery.data;
  const dig = digitalQuery.data;
  const ai = data?.metrics;

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
      case "kpi_verification":
        return (
          <KpiCard
            label="Verification Coverage %"
            value={fmt(ai?.verificationCoveragePct, "%")}
            accent={accent}
            moreTo="/history"
          />
        );
      case "kpi_planogram":
        return (
          <KpiCard
            label="Planogram Compliance %"
            value={fmt(ai?.planogram.compliancePct, "%")}
            accent={accent}
            moreTo="/history"
          />
        );
      case "kpi_total_audits":
        return (
          <KpiCard label="Total Audits" value={fmt(ai?.auditCount)} accent={accent} moreTo="/history" />
        );
      case "kpi_confidence":
        return <KpiCard label="Avg Confidence" value={fmt(confPct, "%")} accent={accent} moreTo="/history" />;
      case "kpi_products":
        return <KpiCard label="Products Identified" value={fmt(ai?.productsIdentified)} accent={accent} />;
      case "kpi_brands":
        return <KpiCard label="Brands Identified" value={fmt(ai?.brandsIdentified)} accent={accent} />;
      case "kpi_facings":
        return <KpiCard label="Total Facings" value={fmt(ai?.totalFacings)} accent={accent} />;
      case "kpi_units":
        return <KpiCard label="Visible Units" value={fmt(ai?.totalVisibleUnits)} accent={accent} />;
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

  const renderDigitalCard = (id: string, accent: string): React.ReactNode => {
    const kpis: Record<string, [string, string]> = {
      kpi_total: ["Total Digital Audits", fmt(dig?.totalAudits)],
      kpi_completed: ["Completed", fmt(dig?.completed)],
      kpi_in_progress: ["In Progress", fmt(dig?.inProgress)],
      kpi_completion_pct: ["Completion %", fmt(dig?.completionPct, "%")],
      kpi_overdue: ["Overdue", fmt(dig?.overdue)],
      kpi_net_variance: ["Net Variance", fmt(dig?.netVariance)],
      kpi_ca_open: ["Open CA", fmt(dig?.caOpen)],
      kpi_ca_overdue: ["Overdue CA", fmt(dig?.caOverdue)],
    };
    const kpi = kpis[id];
    if (kpi) return <KpiCard label={kpi[0]} value={kpi[1]} accent={accent} />;
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
            All metric cards are hidden. Use Edit layout → Add card to bring them back.
          </p>
        ) : null}
      </div>
    );
  };

  const selectClass = "rounded-lg border border-[#D9E2E8] bg-white px-2 py-1.5 text-xs";

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
              enabled={demoPreview.previewDemo}
              onChange={demoPreview.setPreviewDemo}
            />
            <Button variant="outline" size="sm" className={NEW_AUDIT_BUTTON_CLASS} asChild>
              <Link to="/new-audit">New Audit</Link>
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
          {editLayout ? "Done editing layout" : "Edit layout"}
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
          <AskAislixSection previewDemo={demoPreview.previewDemo || Boolean(data?.labeledDemo)} />

          <WorkspaceFilterBar
            footer={
              <CompletionChips
                completion={completion}
                onChange={setCompletion}
                scopeLabel={data?.scopeLabel}
              />
            }
          />

          {opsQuery.isPending ? (
            <p className="text-sm text-[#667085]">Loading AI dashboard…</p>
          ) : (
            <>
              <div className="rounded-xl border border-[#C1E4F8] bg-[#EAF6FD]/60 px-4 py-2 text-sm text-[#102A43]">
                {data?.executive.audits ?? 0} audits · {fmt(data?.executive.completionPct, "%")} complete ·{" "}
                {data?.executive.openCritical ?? 0} open critical
              </div>

              <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
                <div className="space-y-3">
                  {[
                    {
                      title: "Findings",
                      body: `${data?.synopsis.findingsOpen ?? 0} open`,
                      to: "/findings",
                      bg: AISLIX.localBg,
                      border: AISLIX.localBorder,
                      Icon: Building2,
                    },
                    {
                      title: "Corrective Actions",
                      body: `${data?.synopsis.caOpen ?? 0} open`,
                      to: "/corrective-actions",
                      bg: AISLIX.supermarketBg,
                      border: AISLIX.supermarketBorder,
                      Icon: ShoppingCart,
                    },
                    {
                      title: "History",
                      body: `${data?.synopsis.historyCount ?? 0} audits`,
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
                      <div className="grid gap-4 md:grid-cols-[1fr_1.2fr]">
                        <ul className="space-y-2 text-sm text-[#557187]">
                          <li>
                            <span className="font-semibold text-[#102A43]">Good:</span>{" "}
                            {data.lastReport.good}
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
                        <div className="grid grid-cols-3 gap-2">
                          {(data.lastReport.imageUrls.length
                            ? data.lastReport.imageUrls
                            : [null, null, null]
                          ).map((url, i) =>
                            url ? (
                              <img
                                key={url}
                                src={url}
                                alt=""
                                className="h-20 w-full rounded-lg border border-[#D9E2E8] object-cover"
                              />
                            ) : (
                              <div
                                key={`ph-${i}`}
                                className="flex h-20 items-center justify-center rounded-lg border border-dashed border-[#D9E2E8] bg-[#F4F7F9] text-[10px] text-[#667085]"
                              >
                                Evidence
                              </div>
                            ),
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-[#667085]">
                      No completed audit in range — run an audit to see the AI Analysis Report.
                    </p>
                  )}
                </div>
              </div>

              {renderMetricGrid(renderAiCard)}

              <div className="rounded-xl border border-[#D9E2E8] bg-white p-4">
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
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <WorkspaceFilterBar />

          {digitalQuery.isPending ? (
            <p className="text-sm text-[#667085]">Loading Digital metrics…</p>
          ) : (
            <>
              {renderMetricGrid(renderDigitalCard)}

              <div className="rounded-xl border border-[#D9E2E8] bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[#102A43]">Last 5 digital audits</h3>
                  <Link to="/history" className="text-sm text-[#557187] hover:underline">
                    View more
                  </Link>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-[#D9E2E8] text-xs uppercase text-[#667085]">
                        <th className="py-2 pr-3">Audit</th>
                        <th className="py-2 pr-3">Location</th>
                        <th className="py-2 pr-3">Assignee</th>
                        <th className="py-2 pr-3">Date</th>
                        <th className="py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(dig?.lastFive ?? []).map((row) => (
                        <tr key={row.id} className="border-b border-[#EEF1F4]">
                          <td className="py-2 pr-3 font-mono text-xs">{row.id.slice(0, 8)}</td>
                          <td className="py-2 pr-3">{row.store}</td>
                          <td className="py-2 pr-3">{row.assignee}</td>
                          <td className="py-2 pr-3">
                            {row.date ? new Date(row.date).toLocaleString() : "—"}
                          </td>
                          <td className="py-2">{assignmentStatusLabel(row.status)}</td>
                        </tr>
                      ))}
                      {!dig?.lastFive?.length ? (
                        <tr>
                          <td colSpan={5} className="py-6 text-[#667085]">
                            Data unavailable
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
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
        audits={data?.lastTen ?? []}
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
