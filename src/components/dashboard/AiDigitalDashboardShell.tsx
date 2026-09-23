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
import { ArrowDownRight, ArrowUpRight, Building2, ShoppingCart, Users } from "lucide-react";

import { AskAislixSection } from "@/components/ask-aislix/AskAislixSection";
import { WorkspaceFilterBar } from "@/components/filters/GlobalFilterBarShell";
import { MpDonut } from "@/components/control-tower/MpCharts";
import { DemoPreviewToggle } from "@/components/control-tower/DemoPreviewToggle";
import {
  BrandShareMultiRing,
  CategoryShareDonut,
  CircularComplianceScores,
  PerformanceLeaderboard,
  ProductRankingCards,
} from "@/components/dashboard/DashboardMetricVisuals";
import {
  DashboardLayoutToolbar,
  SortableSection,
  useSectionDrag,
  visibleSectionIds,
} from "@/components/dashboard/DashboardLayoutControls";
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
  parseDashboardLayout,
  type DashboardLayoutPrefs,
  type TabLayoutState,
} from "@/lib/dashboard-layout";
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
import { toast } from "sonner";

const CHART_COLORS = [
  AISLIX.localBorder,
  AISLIX.supermarketBorder,
  AISLIX.darkstoreBorder,
  AISLIX.warehouseBorder,
  AISLIX.accentBorder,
];

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
}: {
  label: string;
  value: string;
  accent: string;
  delta?: number | null;
  moreTo?: string;
}) {
  return (
    <div
      className="rounded-xl border border-[#D9E2E8] bg-white p-4"
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
      {moreTo ? (
        <a href={moreTo} className="mt-2 inline-block text-xs text-[#557187] hover:underline">
          View more
        </a>
      ) : null}
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
    <div className={cn("rounded-xl border border-[#D9E2E8] bg-white p-4", className)}>
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

export function AiDigitalDashboardShell() {
  const navigate = useNavigate({ from: DashboardRoute.fullPath });
  const { tab } = DashboardRoute.useSearch();
  const global = useOptionalGlobalFilters();
  const demoPreview = useDemoPreview();
  const queryClient = useQueryClient();
  const [completion, setCompletion] = useState<CompletionFilter>("all");
  const [tableStage, setTableStage] = useState<string>("all");
  const [tableTemplate, setTableTemplate] = useState<string>("all");
  const [tableAssignee, setTableAssignee] = useState<string>("all");
  const [tableStore, setTableStore] = useState<string>("all");
  const [sortKey, setSortKey] = useState<"date" | "score" | "completion">("date");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalReport, setModalReport] = useState<LastAuditReport | null>(null);
  const [modalIncomplete, setModalIncomplete] = useState(false);
  const [editLayout, setEditLayout] = useState(true);
  const [layoutPrefs, setLayoutPrefs] = useState<DashboardLayoutPrefs>(() => defaultDashboardLayout());
  const [savedLayout, setSavedLayout] = useState<DashboardLayoutPrefs>(() => defaultDashboardLayout());
  const [layoutSaving, setLayoutSaving] = useState(false);

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

  const layoutQuery = useQuery({
    queryKey: ["dashboard-layout-prefs"],
    queryFn: async () => {
      const prefs = await fetchNotificationPreferences();
      return parseDashboardLayout(prefs.dashboard_layout);
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    if (layoutQuery.data) {
      setLayoutPrefs(layoutQuery.data);
      setSavedLayout(layoutQuery.data);
    }
  }, [layoutQuery.data]);

  const activeTabLayout: TabLayoutState =
    tab === "ai" ? layoutPrefs.ai : layoutPrefs.digital;
  const setActiveTabLayout = (next: TabLayoutState) => {
    setLayoutPrefs((prev) =>
      tab === "ai" ? { ...prev, ai: next } : { ...prev, digital: next },
    );
  };
  const layoutDirty =
    JSON.stringify(layoutPrefs.ai) !== JSON.stringify(savedLayout.ai) ||
    JSON.stringify(layoutPrefs.digital) !== JSON.stringify(savedLayout.digital);

  const sectionDrag = useSectionDrag(activeTabLayout, setActiveTabLayout);
  const visibleIds = visibleSectionIds(tab === "digital" ? "digital" : "ai", activeTabLayout);
  const catalog = catalogForTab(tab === "digital" ? "digital" : "ai");

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
    const defaults = defaultDashboardLayout();
    const next =
      tab === "ai"
        ? { ...layoutPrefs, ai: defaultTabLayout(catalogForTab("ai")) }
        : { ...layoutPrefs, digital: defaultTabLayout(catalogForTab("digital")) };
    setLayoutPrefs(next);
    setLayoutSaving(true);
    try {
      await updateNotificationPreferences({ dashboard_layout: next });
      setSavedLayout(next);
      toast.success("Reset to Aislix default layout");
    } catch (err) {
      setLayoutPrefs(defaults);
      toast.error(err instanceof Error ? err.message : "Could not reset layout");
    } finally {
      setLayoutSaving(false);
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

  const applyTableFilters = <T extends {
    completionStage: string;
    templateName?: string;
    assigneeName: string;
    storeName: string;
    date: string;
    scorePct: number | null;
  }>(rows: T[]) => {
    let next = [...rows];
    if (tableStage !== "all") next = next.filter((r) => r.completionStage === tableStage);
    if (tableTemplate !== "all") next = next.filter((r) => r.templateName === tableTemplate);
    if (tableAssignee !== "all") next = next.filter((r) => r.assigneeName === tableAssignee);
    if (tableStore !== "all") next = next.filter((r) => r.storeName === tableStore);
    next.sort((a, b) => {
      if (sortKey === "score") return (b.scorePct ?? -1) - (a.scorePct ?? -1);
      if (sortKey === "completion") return a.completionStage.localeCompare(b.completionStage);
      return (b.date || "").localeCompare(a.date || "");
    });
    return next;
  };

  const filteredLastTen = useMemo(
    () => applyTableFilters(data?.lastTen ?? []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data?.lastTen, tableStage, tableTemplate, tableAssignee, tableStore, sortKey],
  );

  const filteredAssigned = useMemo(
    () => applyTableFilters(data?.myAssignedAudits ?? []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data?.myAssignedAudits, tableStage, tableTemplate, tableAssignee, tableStore, sortKey],
  );

  const templateOptions = useMemo(
    () =>
      [
        ...new Set([
          ...(data?.lastTen ?? []).map((r) => r.templateName),
          ...(data?.myAssignedAudits ?? []).map((r) => r.templateName),
        ]),
      ].filter(Boolean),
    [data?.lastTen, data?.myAssignedAudits],
  );
  const assigneeOptions = useMemo(
    () =>
      [
        ...new Set([
          ...(data?.lastTen ?? []).map((r) => r.assigneeName),
          ...(data?.myAssignedAudits ?? []).map((r) => r.assigneeName),
        ]),
      ].filter(Boolean),
    [data?.lastTen, data?.myAssignedAudits],
  );
  const storeOptions = useMemo(
    () =>
      [
        ...new Set([
          ...(data?.lastTen ?? []).map((r) => r.storeName),
          ...(data?.myAssignedAudits ?? []).map((r) => r.storeName),
        ]),
      ].filter(Boolean),
    [data?.lastTen, data?.myAssignedAudits],
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
          tab={tab === "digital" ? "digital" : "ai"}
          layout={activeTabLayout}
          dirty={layoutDirty}
          saving={layoutSaving}
          onChange={setActiveTabLayout}
          onSave={() => void saveLayout()}
          onReset={() => void resetLayout()}
        />
      ) : null}

      {tab === "ai" ? (
        <div className="flex flex-col gap-6">
          {visibleIds.map((sectionId) => {
            const def = catalog.find((s) => s.id === sectionId);
            if (!def) return null;
            const order = visibleIds.indexOf(sectionId);
            const wrap = (body: React.ReactNode) => (
              <SortableSection
                key={sectionId}
                id={sectionId}
                title={def.title}
                pinned={def.pinned}
                editMode={editLayout}
                order={order}
                onHide={
                  def.pinned
                    ? undefined
                    : () =>
                        setActiveTabLayout({
                          ...activeTabLayout,
                          hidden: [...activeTabLayout.hidden, sectionId],
                        })
                }
                onDragStart={sectionDrag.onDragStart}
                onDragOver={sectionDrag.onDragOver}
                onDrop={sectionDrag.onDrop}
              >
                {body}
              </SortableSection>
            );

            if (sectionId === "ask") {
              return wrap(
                <AskAislixSection
                  previewDemo={demoPreview.previewDemo || Boolean(data?.labeledDemo)}
                />,
              );
            }
            if (sectionId === "filters") {
              return wrap(
                <WorkspaceFilterBar
                  footer={
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
                          onClick={() => setCompletion(id)}
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
                        {data?.scopeLabel ?? "Showing your stores"}
                      </span>
                    </>
                  }
                />,
              );
            }
            if (opsQuery.isPending) {
              return sectionId === "executive"
                ? wrap(<p className="text-sm text-[#667085]">Loading AI dashboard…</p>)
                : null;
            }
            if (sectionId === "executive") {
              return wrap(
                <div className="rounded-xl border border-[#C1E4F8] bg-[#EAF6FD]/60 px-4 py-2 text-sm text-[#102A43]">
                  {data?.executive.audits ?? 0} audits ·{" "}
                  {fmt(data?.executive.completionPct, "%")} complete ·{" "}
                  {data?.executive.openCritical ?? 0} open critical
                </div>,
              );
            }
            return null;
          })}

          {opsQuery.isPending ? null : (
            <div className="contents">
              {visibleIds.includes("synopsis_kpis") ? (
                <SortableSection
                  id="synopsis_kpis"
                  title="Synopsis & KPIs"
                  editMode={editLayout}
                  order={visibleIds.indexOf("synopsis_kpis")}
                  onHide={() =>
                    setActiveTabLayout({
                      ...activeTabLayout,
                      hidden: [...activeTabLayout.hidden, "synopsis_kpis"],
                    })
                  }
                  onDragStart={sectionDrag.onDragStart}
                  onDragOver={sectionDrag.onDragOver}
                  onDrop={sectionDrag.onDrop}
                >
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

                <div className="space-y-4">
                  {/* Last completed — AI Analysis Report */}
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
                          Audit: {data.lastReport.auditName} | Store: {data.lastReport.storeName} |{" "}
                          Date: {fmtDate(data.lastReport.date)}
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
                                  className="h-20 w-full rounded-lg object-cover border border-[#D9E2E8]"
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

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <KpiCard
                      label="Verification Coverage %"
                      value={fmt(ai?.verificationCoveragePct, "%")}
                      accent={AISLIX.localBorder}
                      moreTo="/history"
                    />
                    <KpiCard
                      label="Planogram Compliance %"
                      value={fmt(ai?.planogram.compliancePct, "%")}
                      accent={AISLIX.supermarketBorder}
                      moreTo="/history"
                    />
                    <KpiCard
                      label="Total Audits"
                      value={fmt(ai?.auditCount)}
                      accent={AISLIX.warehouseBorder}
                      moreTo="/history"
                    />
                    <KpiCard
                      label="Avg Confidence"
                      value={fmt(confPct, "%")}
                      accent={AISLIX.darkstoreBorder}
                      moreTo="/history"
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <KpiCard
                      label="Products Identified"
                      value={fmt(ai?.productsIdentified)}
                      accent={AISLIX.localBorder}
                    />
                    <KpiCard
                      label="Brands Identified"
                      value={fmt(ai?.brandsIdentified)}
                      accent={AISLIX.supermarketBorder}
                    />
                    <KpiCard
                      label="Total Facings"
                      value={fmt(ai?.totalFacings)}
                      accent={AISLIX.warehouseBorder}
                    />
                    <KpiCard
                      label="Visible Units"
                      value={fmt(ai?.totalVisibleUnits)}
                      accent={AISLIX.darkstoreBorder}
                    />
                  </div>
                </div>
              </div>
                </SortableSection>
              ) : null}

              {/* Charts — each section independently reorderable */}
              {visibleIds.includes("chart_planogram") ? (
                <SortableSection
                  id="chart_planogram"
                  title="Planogram Expected vs Actual"
                  editMode={editLayout}
                  order={visibleIds.indexOf("chart_planogram")}
                  onHide={() =>
                    setActiveTabLayout({
                      ...activeTabLayout,
                      hidden: [...activeTabLayout.hidden, "chart_planogram"],
                    })
                  }
                  onDragStart={sectionDrag.onDragStart}
                  onDragOver={sectionDrag.onDragOver}
                  onDrop={sectionDrag.onDrop}
                >
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
                </SortableSection>
              ) : null}

              {visibleIds.includes("chart_top_facings") ? (
                <SortableSection
                  id="chart_top_facings"
                  title="Top products by facings"
                  editMode={editLayout}
                  order={visibleIds.indexOf("chart_top_facings")}
                  onHide={() =>
                    setActiveTabLayout({
                      ...activeTabLayout,
                      hidden: [...activeTabLayout.hidden, "chart_top_facings"],
                    })
                  }
                  onDragStart={sectionDrag.onDragStart}
                  onDragOver={sectionDrag.onDragOver}
                  onDrop={sectionDrag.onDrop}
                >
                <ChartCard title="Top products by facings" moreTo="/audit-intelligence">
                  {(ai?.topProductsByFacings ?? []).length ? (
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={(ai?.topProductsByFacings ?? []).slice(0, 6).map((r, i) => ({
                            ...r,
                            label: r.label.length > 16 ? `${r.label.slice(0, 16)}…` : r.label,
                            fill: CHART_COLORS[i % CHART_COLORS.length],
                          }))}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#E7EDF0" />
                          <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Bar dataKey="value" name="Facings">
                            {(ai?.topProductsByFacings ?? []).slice(0, 6).map((_, i) => (
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
                </SortableSection>
              ) : null}

              {visibleIds.includes("charts_analytics") ? (
                <SortableSection
                  id="charts_analytics"
                  title="Analytics charts & performance"
                  editMode={editLayout}
                  order={visibleIds.indexOf("charts_analytics")}
                  onHide={() =>
                    setActiveTabLayout({
                      ...activeTabLayout,
                      hidden: [...activeTabLayout.hidden, "charts_analytics"],
                    })
                  }
                  onDragStart={sectionDrag.onDragStart}
                  onDragOver={sectionDrag.onDragOver}
                  onDrop={sectionDrag.onDrop}
                >
              <div className="grid gap-4 lg:grid-cols-2">
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

                <ChartCard title="Brand Share of Facings" moreTo="/audit-intelligence">
                  <BrandShareMultiRing rows={ai?.brandShare ?? []} />
                </ChartCard>

                <ChartCard title="Category Share of Facings" moreTo="/audit-intelligence">
                  <CategoryShareDonut rows={ai?.categoryShare ?? []} />
                </ChartCard>

                <ChartCard title="Top Products by Visible Units" moreTo="/audit-intelligence">
                  <ProductRankingCards rows={ai?.topProductsByUnits ?? []} />
                </ChartCard>

                <ChartCard
                  title="Top 5 stores — low planogram compliance (need visits)"
                  moreTo="/history"
                >
                  <CircularComplianceScores rows={data?.lowComplianceStores ?? []} />
                </ChartCard>

                <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
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
                </div>
              </div>
                </SortableSection>
              ) : null}

              {visibleIds.includes("table_last_ten") ? (
                <SortableSection
                  id="table_last_ten"
                  title="Last 10 Audits"
                  editMode={editLayout}
                  order={visibleIds.indexOf("table_last_ten")}
                  onHide={() =>
                    setActiveTabLayout({
                      ...activeTabLayout,
                      hidden: [...activeTabLayout.hidden, "table_last_ten"],
                    })
                  }
                  onDragStart={sectionDrag.onDragStart}
                  onDragOver={sectionDrag.onDragOver}
                  onDrop={sectionDrag.onDrop}
                >
              {/* Last 10 */}
              <div className="rounded-xl border border-[#D9E2E8] bg-white p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-[#102A43]">Last 10 Audits</h3>
                  <ViewMore to="/history" />
                </div>
                <WorkspaceFilterBar
                  className="mb-4"
                  embedded
                  footer={
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
                          onClick={() => setCompletion(id)}
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
                        {data?.scopeLabel ?? "Showing your stores"}
                      </span>
                    </>
                  }
                />
                <div className="mb-3 flex flex-wrap gap-2">
                  <select
                    className="rounded-lg border border-[#D9E2E8] bg-white px-2 py-1.5 text-xs"
                    value={tableStage}
                    onChange={(e) => setTableStage(e.target.value)}
                  >
                    <option value="all">Completion stage</option>
                    <option value="completed">Completed</option>
                    <option value="in_progress">In Progress</option>
                    <option value="not_started">Not Started</option>
                  </select>
                  <select
                    className="rounded-lg border border-[#D9E2E8] bg-white px-2 py-1.5 text-xs"
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
                    className="rounded-lg border border-[#D9E2E8] bg-white px-2 py-1.5 text-xs"
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
                  <select
                    className="rounded-lg border border-[#D9E2E8] bg-white px-2 py-1.5 text-xs"
                    value={tableStore}
                    onChange={(e) => setTableStore(e.target.value)}
                  >
                    <option value="all">Store</option>
                    {storeOptions.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <select
                    className="rounded-lg border border-[#D9E2E8] bg-white px-2 py-1.5 text-xs"
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
                            Data unavailable
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
                </SortableSection>
              ) : null}

              {visibleIds.includes("table_assigned") ? (
                <SortableSection
                  id="table_assigned"
                  title="Assigned Audits"
                  editMode={editLayout}
                  order={visibleIds.indexOf("table_assigned")}
                  onHide={() =>
                    setActiveTabLayout({
                      ...activeTabLayout,
                      hidden: [...activeTabLayout.hidden, "table_assigned"],
                    })
                  }
                  onDragStart={sectionDrag.onDragStart}
                  onDragOver={sectionDrag.onDragOver}
                  onDrop={sectionDrag.onDrop}
                >
              {/* Assigned audits — to me / by me */}
              <div className="rounded-xl border border-[#D9E2E8] bg-white p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-[#102A43]">
                    Assigned Audits (to me &amp; by me)
                  </h3>
                  <ViewMore to="/history" />
                </div>
                <div className="mb-3 flex flex-wrap gap-2">
                  <select
                    className="rounded-lg border border-[#D9E2E8] bg-white px-2 py-1.5 text-xs"
                    value={tableStage}
                    onChange={(e) => setTableStage(e.target.value)}
                  >
                    <option value="all">Completion stage</option>
                    <option value="completed">Completed</option>
                    <option value="in_progress">In Progress</option>
                    <option value="not_started">Not Started</option>
                  </select>
                  <select
                    className="rounded-lg border border-[#D9E2E8] bg-white px-2 py-1.5 text-xs"
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
                    className="rounded-lg border border-[#D9E2E8] bg-white px-2 py-1.5 text-xs"
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
                  <select
                    className="rounded-lg border border-[#D9E2E8] bg-white px-2 py-1.5 text-xs"
                    value={tableStore}
                    onChange={(e) => setTableStore(e.target.value)}
                  >
                    <option value="all">Store</option>
                    {storeOptions.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <select
                    className="rounded-lg border border-[#D9E2E8] bg-white px-2 py-1.5 text-xs"
                    value={sortKey}
                    onChange={(e) => setSortKey(e.target.value as typeof sortKey)}
                  >
                    <option value="date">Sort: Date</option>
                    <option value="score">Sort: Score</option>
                    <option value="completion">Sort: Completion</option>
                  </select>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1040px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-[#D9E2E8] text-xs uppercase text-[#667085]">
                        <th className="py-2 pr-3">Audit</th>
                        <th className="py-2 pr-3">Template</th>
                        <th className="py-2 pr-3">Store</th>
                        <th className="py-2 pr-3">Assignee</th>
                        <th className="py-2 pr-3">Assigner</th>
                        <th className="py-2 pr-3">Relation</th>
                        <th className="py-2 pr-3">Type</th>
                        <th className="py-2 pr-3">Status</th>
                        <th className="py-2 pr-3">Due</th>
                        <th className="py-2 pr-3">Date</th>
                        <th className="py-2">Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAssigned.map((row) => (
                        <tr key={row.id} className="border-b border-[#EEF1F4]">
                          <td className="py-2 pr-3 font-medium text-[#102A43]">{row.auditName}</td>
                          <td className="py-2 pr-3 text-[#557187]">{row.templateName}</td>
                          <td className="py-2 pr-3">{row.storeName}</td>
                          <td className="py-2 pr-3">{row.assigneeName}</td>
                          <td className="py-2 pr-3">{row.assignerName}</td>
                          <td className="py-2 pr-3">
                            <span
                              className={cn(
                                "rounded-full border px-2 py-0.5 text-xs font-medium",
                                row.relation === "assigned_to_me"
                                  ? "border-[#C1E4F8] bg-[#EAF6FD] text-[#102A43]"
                                  : "border-[#D9C5F2] bg-[#F0E9FF] text-[#102A43]",
                              )}
                            >
                              {row.relation === "assigned_to_me" ? "Assigned to me" : "Assigned by me"}
                            </span>
                          </td>
                          <td className="py-2 pr-3">{row.type}</td>
                          <td className="py-2 pr-3">
                            <StagePill stage={row.completionStage} />
                          </td>
                          <td className="py-2 pr-3">{fmtDate(row.dueAt ?? "")}</td>
                          <td className="py-2 pr-3">{fmtDate(row.date)}</td>
                          <td className="py-2">{fmt(row.scorePct, "%")}</td>
                        </tr>
                      ))}
                      {!filteredAssigned.length ? (
                        <tr>
                          <td colSpan={11} className="py-6 text-[#667085]">
                            No assigned audits in this range
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
                </SortableSection>
              ) : null}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {visibleIds.map((sectionId) => {
            const def = catalog.find((s) => s.id === sectionId);
            if (!def) return null;
            const order = visibleIds.indexOf(sectionId);
            if (sectionId === "filters") {
              return (
                <SortableSection
                  key={sectionId}
                  id={sectionId}
                  title={def.title}
                  pinned
                  editMode={editLayout}
                  order={order}
                  onDragStart={sectionDrag.onDragStart}
                  onDragOver={sectionDrag.onDragOver}
                  onDrop={sectionDrag.onDrop}
                >
                  <WorkspaceFilterBar />
                </SortableSection>
              );
            }
            if (digitalQuery.isPending) {
              return sectionId === "kpi_digital" ? (
                <p key={sectionId} className="text-sm text-[#667085]" style={{ order }}>
                  Loading Digital metrics…
                </p>
              ) : null;
            }
            if (sectionId === "kpi_digital") {
              return (
                <SortableSection
                  key={sectionId}
                  id={sectionId}
                  title={def.title}
                  editMode={editLayout}
                  order={order}
                  onHide={() =>
                    setActiveTabLayout({
                      ...activeTabLayout,
                      hidden: [...activeTabLayout.hidden, sectionId],
                    })
                  }
                  onDragStart={sectionDrag.onDragStart}
                  onDragOver={sectionDrag.onDragOver}
                  onDrop={sectionDrag.onDrop}
                >
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                      ["Total Digital Audits", fmt(dig?.totalAudits), AISLIX.localBorder],
                      ["Completed", fmt(dig?.completed), AISLIX.supermarketBorder],
                      ["In Progress", fmt(dig?.inProgress), AISLIX.warehouseBorder],
                      ["Completion %", fmt(dig?.completionPct, "%"), AISLIX.darkstoreBorder],
                      ["Overdue", fmt(dig?.overdue), AISLIX.darkstoreBorder],
                      ["Net Variance", fmt(dig?.netVariance), AISLIX.localBorder],
                      ["Open CA", fmt(dig?.caOpen), AISLIX.supermarketBorder],
                      ["Overdue CA", fmt(dig?.caOverdue), AISLIX.darkstoreBorder],
                    ].map(([label, value, accent]) => (
                      <KpiCard
                        key={label as string}
                        label={label as string}
                        value={value as string}
                        accent={accent as string}
                      />
                    ))}
                  </div>
                </SortableSection>
              );
            }
            if (sectionId === "table_last_five") {
              return (
                <SortableSection
                  key={sectionId}
                  id={sectionId}
                  title={def.title}
                  editMode={editLayout}
                  order={order}
                  onHide={() =>
                    setActiveTabLayout({
                      ...activeTabLayout,
                      hidden: [...activeTabLayout.hidden, sectionId],
                    })
                  }
                  onDragStart={sectionDrag.onDragStart}
                  onDragOver={sectionDrag.onDragOver}
                  onDrop={sectionDrag.onDrop}
                >
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
                </SortableSection>
              );
            }
            return null;
          })}
        </div>
      )}

      <AiAnalysisModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        report={modalReport}
        incomplete={modalIncomplete}
      />
    </div>
  );
}
