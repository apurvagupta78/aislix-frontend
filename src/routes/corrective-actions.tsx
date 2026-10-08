import { useEffect, useMemo, useState } from "react";
import { Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Columns3, Rows3, Search, Wrench } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { MpBadge } from "@/components/design-system/MpBadge";
import { MpCard } from "@/components/design-system/MpCard";
import { PageHeader } from "@/components/design-system/PageHeader";
import {
  AgingChart,
  FlowTrendChart,
  OwnerWorkloadTable,
  PipelineChart,
  RecheckChart,
  SourceDonut,
  StoreChart,
  TypeChart,
} from "@/components/corrective-actions/CaCharts";
import { CaBoard, CaKpiCard, CaTable } from "@/components/corrective-actions/CaParts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, ErrorState } from "@/components/States";
import { toUserMessage } from "@/lib/api/errors";
import type { AislixAccent } from "@/lib/ai-audit/kpi-palette";
import {
  ACTION_SOURCES,
  ACTION_STAGES,
  ACTION_TYPES,
  actionStage,
  isActionLate,
} from "@/lib/corrective-action-catalog";
import {
  actionsBySource,
  actionsByType,
  agingBuckets,
  correctiveActionKpis,
  openActionsByStore,
  ownerWorkload,
  pipelineCounts,
  recheckResults,
  weeklyFlow,
} from "@/lib/corrective-action-insights";
import { fetchLifecycleActions, runActionEscalations } from "@/lib/corrective-action-lifecycle";
import { useGlobalFilters } from "@/lib/global-filters";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/corrective-actions")({
  head: () => ({
    meta: [
      { title: "Corrective Actions — Close shelf gaps | Aislix" },
      {
        name: "description",
        content:
          "Every fix raised by AI and Digital audits, assigned, tracked, verified and closed across your stores.",
      },
      { property: "og:title", content: "Corrective Actions — Aislix" },
      {
        property: "og:description",
        content: "Detect, assign, fix, verify and close every audit finding.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CorrectiveActionsLayout,
});

/** Nested /corrective-actions/$actionId needs an Outlet or the list page stays stuck. */
function CorrectiveActionsLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isIndex = pathname === "/corrective-actions" || pathname === "/corrective-actions/";
  if (!isIndex) return <Outlet />;
  return (
    <AppShell title="" hidePageHeader>
      <CorrectiveActionsMain />
    </AppShell>
  );
}

const PAGE_SIZE = 50;

/** Semantic accents, with no same accent next to each other across or down the 4-column grid. */
const KPI_ACCENTS: AislixAccent[] = ["purple", "blue", "pink", "green", "cyan", "pink", "green", "grey"];

function FilterSelect({
  value,
  onChange,
  allLabel,
  options,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  allLabel: string;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={cn("h-9 w-40 rounded-lg border-line bg-white text-sm", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{allLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function CorrectiveActionsMain() {
  const { filters: globalFilters } = useGlobalFilters();
  const queryClient = useQueryClient();
  const [source, setSource] = useState("all");
  const [stage, setStage] = useState("all");
  const [priority, setPriority] = useState("all");
  const [owner, setOwner] = useState("all");
  const [type, setType] = useState("all");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"table" | "board">("table");
  const [visible, setVisible] = useState(PAGE_SIZE);

  const actionsQuery = useQuery({
    queryKey: ["lifecycle-actions", globalFilters.storeId],
    queryFn: () =>
      fetchLifecycleActions({
        storeId: globalFilters.storeId !== "all" ? globalFilters.storeId : undefined,
      }),
    retry: false,
  });

  useEffect(() => {
    let cancelled = false;
    void runActionEscalations()
      .then(() => {
        if (!cancelled) void queryClient.invalidateQueries({ queryKey: ["lifecycle-actions"] });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [queryClient]);

  const all = useMemo(() => actionsQuery.data ?? [], [actionsQuery.data]);
  const owners = useMemo(
    () => [...new Set(all.map((row) => row.assigned_name).filter(Boolean))].sort(),
    [all],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter((row) => {
      if (source !== "all" && row.source !== source) return false;
      if (priority !== "all" && row.priority !== priority) return false;
      if (owner !== "all" && row.assigned_name !== owner) return false;
      if (type !== "all" && (row.action_type ?? "other") !== type) return false;
      if (stage === "overdue" && !isActionLate(row)) return false;
      if (stage !== "all" && stage !== "overdue" && actionStage(row.status) !== stage) return false;
      if (q) {
        const hay = [row.code, row.title, row.suggestion, row.sku, row.store_name, row.assigned_name]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [all, source, priority, owner, type, stage, search]);

  useEffect(() => setVisible(PAGE_SIZE), [source, priority, owner, type, stage, search]);

  const kpis = useMemo(() => correctiveActionKpis(filtered), [filtered]);
  const pipeline = useMemo(() => pipelineCounts(filtered), [filtered]);
  const flow = useMemo(() => weeklyFlow(filtered), [filtered]);
  const types = useMemo(() => actionsByType(filtered), [filtered]);
  const stores = useMemo(() => openActionsByStore(filtered), [filtered]);
  const aging = useMemo(() => agingBuckets(filtered), [filtered]);
  const sources = useMemo(() => actionsBySource(filtered), [filtered]);
  const workload = useMemo(() => ownerWorkload(filtered), [filtered]);
  const rechecks = useMemo(() => recheckResults(filtered), [filtered]);

  const kpiCards = [
    {
      label: "Open actions",
      value: String(kpis.open),
      context: "Open or in progress",
      info: "Actions the owner still has to fix.",
    },
    {
      label: "Awaiting verification",
      value: String(kpis.submitted),
      context: "Fix submitted, not yet verified",
      info: "Owner submitted the fix; waiting for an AI re-check or a manager.",
    },
    {
      label: "Overdue",
      value: String(kpis.overdue),
      context: "Past the due date",
      info: "Open or in-progress actions past their SLA due date.",
    },
    {
      label: "Fixed (30 days)",
      value: String(kpis.closedLast30),
      context: "Verified or closed",
      info: "Actions verified or closed in the last 30 days.",
    },
    {
      label: "Avg days to fix",
      value: kpis.avgDaysToClose == null ? "N/A" : `${kpis.avgDaysToClose}`,
      context: kpis.avgDaysToClose == null ? "No fixed actions yet" : "From raised to fixed",
      info: "Average days from when an action was raised to when it was verified or closed.",
    },
    {
      label: "Critical & high open",
      value: String(kpis.criticalHighOpen),
      context: "Root cause required",
      info: "Open critical and high priority actions. These need a root cause and preventive action.",
    },
    {
      label: "AI re-check pass rate",
      value: kpis.recheckPassRate == null ? "N/A" : `${kpis.recheckPassRate}%`,
      context:
        kpis.recheckPassRate == null ? "No AI re-checks yet" : `${kpis.recheckCount} re-check${kpis.recheckCount === 1 ? "" : "s"}`,
      info: "Share of after photos where the AI no longer found the issue.",
    },
    {
      label: "Escalated",
      value: String(kpis.escalated),
      context: "Sent to a manager or admin",
      info: "Overdue actions escalated to the owner's manager, then to admins after another SLA period.",
    },
  ];

  const rows = filtered.slice(0, visible);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Exceptions"
        title="Corrective actions"
        description="Every fix from AI and Digital audits — detect, assign, fix, verify, close."
        meta={
          <>
            {kpis.overdue > 0 ? (
              <MpBadge tone="attention" dot>
                {kpis.overdue} overdue
              </MpBadge>
            ) : null}
            {kpis.open > 0 ? (
              <MpBadge tone="active" dot>
                {kpis.open} open
              </MpBadge>
            ) : null}
            {kpis.submitted > 0 ? (
              <MpBadge tone="neutral" dot>
                {kpis.submitted} awaiting verification
              </MpBadge>
            ) : null}
          </>
        }
      />

      {actionsQuery.isLoading ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-[104px] rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
      ) : actionsQuery.isError ? (
        <ErrorState
          description={toUserMessage(actionsQuery.error)}
          onRetry={() => void actionsQuery.refetch()}
        />
      ) : !all.length ? (
        <EmptyState
          icon={<Wrench className="size-6" />}
          title="No corrective actions yet"
          description="Actions are raised automatically for every failed check and AI finding when an audit finishes."
        />
      ) : (
        <>
          <MpCard className="p-3 md:p-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-mp-muted" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search code, product, store…"
                  className="h-9 w-56 rounded-lg border-line pl-8 text-sm"
                  aria-label="Search corrective actions"
                />
              </div>
              <FilterSelect value={source} onChange={setSource} allLabel="All sources" options={ACTION_SOURCES} />
              <FilterSelect
                value={stage}
                onChange={setStage}
                allLabel="All statuses"
                options={[...ACTION_STAGES, { value: "overdue", label: "Overdue" }]}
              />
              <FilterSelect
                value={priority}
                onChange={setPriority}
                allLabel="All priorities"
                options={[
                  { value: "critical", label: "Critical" },
                  { value: "high", label: "High" },
                  { value: "medium", label: "Medium" },
                  { value: "low", label: "Low" },
                ]}
              />
              <FilterSelect
                value={owner}
                onChange={setOwner}
                allLabel="All owners"
                options={owners.map((o) => ({ value: o, label: o }))}
                className="w-44"
              />
              <FilterSelect value={type} onChange={setType} allLabel="All types" options={ACTION_TYPES} />
              <span className="ml-auto text-xs text-mp-muted">
                {filtered.length} of {all.length} actions
              </span>
            </div>
          </MpCard>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {kpiCards.map((card, i) => (
              <CaKpiCard key={card.label} {...card} accent={KPI_ACCENTS[i] ?? "grey"} />
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <PipelineChart counts={pipeline} />
            <FlowTrendChart points={flow} />
            <TypeChart rows={types} />
            <StoreChart rows={stores} />
            <AgingChart buckets={aging} />
            <SourceDonut ai={sources.ai} digital={sources.digital} />
            <OwnerWorkloadTable rows={workload} />
            <RecheckChart rows={rechecks} />
          </div>

          <MpCard className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 md:px-5">
              <div>
                <h2 className="font-display text-[15px] font-semibold text-navy">All actions</h2>
                <p className="mt-0.5 text-[13px] text-mp-muted">Open an action to fix, upload evidence and verify.</p>
              </div>
              <div className="inline-flex rounded-lg border border-line bg-white p-0.5" role="tablist" aria-label="View">
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === "table"}
                  onClick={() => setView("table")}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold",
                    view === "table" ? "bg-[#EEF6FA] text-navy" : "text-mp-muted",
                  )}
                >
                  <Rows3 className="size-3.5" /> Table
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === "board"}
                  onClick={() => setView("board")}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold",
                    view === "board" ? "bg-[#F3EFFB] text-navy" : "text-mp-muted",
                  )}
                >
                  <Columns3 className="size-3.5" /> Board
                </button>
              </div>
            </div>
            {!filtered.length ? (
              <div className="p-6">
                <EmptyState
                  icon={<Wrench className="size-6" />}
                  title="No actions match these filters"
                  description="Clear a filter to see more actions."
                />
              </div>
            ) : view === "board" ? (
              <CaBoard rows={filtered} />
            ) : (
              <>
                <CaTable rows={rows} />
                {filtered.length > visible ? (
                  <div className="border-t border-line p-3 text-center">
                    <Button variant="outline" size="sm" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
                      Show more ({filtered.length - visible} left)
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </MpCard>
        </>
      )}
    </div>
  );
}
