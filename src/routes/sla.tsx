import { useEffect, useMemo, useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { Timer } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { CaKpiCard } from "@/components/corrective-actions/CaParts";
import { PageHeader } from "@/components/design-system/PageHeader";
import {
  ComplianceTrendChart,
  DelayReasonsChart,
  SlaAlertsPanel,
  SlaGroupTable,
  SlaTypeTargetChart,
} from "@/components/sla/SlaCharts";
import { EmptyState, ErrorState } from "@/components/States";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { AislixAccent } from "@/lib/ai-audit/kpi-palette";
import { fetchScopedActions, type ActionSourceFilter } from "@/lib/ai-dashboard-actions";
import { toUserMessage } from "@/lib/api/errors";
import { runActionEscalations } from "@/lib/corrective-action-lifecycle";
import { useGlobalFilters } from "@/lib/global-filters";
import {
  SLA_TYPES,
  delayReasons,
  formatMinutes,
  matchesSlaFilters,
  slaAlerts,
  slaByOwner,
  slaByStore,
  slaByTeam,
  slaByType,
  slaSummary,
  weeklyCompliance,
} from "@/lib/sla-insights";
import type { CorrectiveActionsSearch } from "@/routes/corrective-actions";
import { cn } from "@/lib/utils";

export type SlaSearch = { source?: string; sla?: string };

const param = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v : undefined);

export const Route = createFileRoute("/sla")({
  validateSearch: (s: Record<string, unknown>): SlaSearch => ({ source: param(s.source), sla: param(s.sla) }),
  head: () => ({
    meta: [
      { title: "SLA dashboard — Are store tasks done on time? | Aislix" },
      {
        name: "description",
        content: "SLA compliance, breaches, pending tasks, store and team performance, and delay reasons for every audit fix.",
      },
    ],
  }),
  component: SlaPage,
});

/** PURPLE → BLUE → PINK → GREEN → CYAN; no same accent side by side or stacked in the 4-column grid. */
const ACCENTS: AislixAccent[] = ["purple", "blue", "pink", "green", "cyan", "pink", "green", "grey"];

const SOURCES: Array<{ value: ActionSourceFilter; label: string }> = [
  { value: "all", label: "All audits" },
  { value: "ai", label: "AI audits" },
  { value: "digital", label: "Digital audits" },
];

function Segmented({
  options,
  value,
  onChange,
  label,
}: {
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg border border-line bg-white p-0.5" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            value === o.value ? "bg-[#04203F] text-white" : "text-[#667085] hover:bg-[#F4F7F9] hover:text-navy",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function SlaPage() {
  return (
    <AppShell title="" hidePageHeader>
      <SlaMain />
    </AppShell>
  );
}

function SlaMain() {
  const initial = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { filters, options } = useGlobalFilters();
  const [source, setSource] = useState<ActionSourceFilter>(
    initial.source === "ai" || initial.source === "digital" ? initial.source : "all",
  );
  const [slaType, setSlaType] = useState(initial.sla ?? "all");

  const scopeKey = {
    storeId: filters.storeId,
    country: filters.country,
    city: filters.city,
    category: filters.category,
    teamMemberId: filters.teamMemberId,
    teamManagerId: filters.teamManagerId,
    skuId: filters.skuId,
    datePreset: filters.datePreset,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
  };
  const query = useQuery({
    queryKey: ["sla-dashboard", scopeKey, source],
    queryFn: () => fetchScopedActions(scopeKey, { source }),
    placeholderData: keepPreviousData,
    retry: false,
  });

  useEffect(() => {
    let cancelled = false;
    void runActionEscalations()
      .then(() => {
        if (!cancelled) void queryClient.invalidateQueries({ queryKey: ["sla-dashboard"] });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [queryClient]);

  const all = useMemo(() => query.data?.actions ?? [], [query.data]);
  const rows = useMemo(() => all.filter((a) => matchesSlaFilters(a, slaType, "all")), [all, slaType]);
  const summary = useMemo(() => slaSummary(rows), [rows]);
  const byType = useMemo(() => slaByType(all), [all]);
  const stores = useMemo(() => slaByStore(rows), [rows]);
  const teams = useMemo(() => slaByTeam(rows, options?.team_members ?? []), [rows, options]);
  const owners = useMemo(() => slaByOwner(rows), [rows]);
  const reasons = useMemo(() => delayReasons(rows), [rows]);
  const alerts = useMemo(() => slaAlerts(rows), [rows]);
  const trend = useMemo(() => weeklyCompliance(rows), [rows]);

  const listSearch = (extra: CorrectiveActionsSearch): CorrectiveActionsSearch => ({
    ...(source !== "all" ? { source } : {}),
    ...(slaType !== "all" ? { sla: slaType } : {}),
    ...extra,
  });
  const openList = (extra: CorrectiveActionsSearch) =>
    void navigate({ to: "/corrective-actions", search: listSearch(extra) });

  const cards = [
    {
      label: "SLA compliance",
      value: summary.compliancePct == null ? "N/A" : `${summary.compliancePct}%`,
      context:
        summary.compliancePct == null ? "No deadlines reached yet" : `${summary.met} on time of ${summary.met + summary.breaches} due`,
      info: "Fixes confirmed on time, out of every action that was fixed or is past its deadline.",
      go: () => openList({ outcome: "met" }),
    },
    {
      label: "Actual vs target",
      value: summary.medianActualMin == null ? "N/A" : formatMinutes(summary.medianActualMin),
      context: `Target ${formatMinutes(summary.medianTargetMin)} · median time to fix`,
      info: "Median time from when the action was raised to when the fix was submitted, for confirmed fixes.",
      go: () => openList({ stage: "fixed" }),
    },
    {
      label: "SLA breaches",
      value: String(summary.breaches),
      context: `${summary.breached} fixed late · ${summary.lateOpen} still open`,
      info: "Actions fixed after their deadline, plus actions still open past their deadline.",
      go: () => openList({ outcome: "breached" }),
    },
    {
      label: "Pending tasks",
      value: String(summary.pending),
      context: `${summary.awaiting} awaiting approval`,
      info: "Actions not yet confirmed as fixed.",
      go: () => openList({ outcome: "pending" }),
    },
    {
      label: "Due soon",
      value: String(summary.dueSoon),
      context: "Less than 20% of the SLA time left",
      info: "Open actions close to their deadline. The owner gets an alert.",
      go: () => openList({ outcome: "due_soon" }),
    },
    {
      label: "Overdue now",
      value: String(summary.lateOpen),
      context: "Past the deadline, not fixed",
      info: "The owner and their manager get an alert, then it escalates.",
      go: () => openList({ stage: "overdue" }),
    },
    {
      label: "Fixed on time",
      value: String(summary.met),
      context: `${summary.breached} fixed late`,
      info: "Confirmed fixes submitted before the deadline.",
      go: () => openList({ outcome: "met" }),
    },
    {
      label: "Actions in scope",
      value: String(summary.total),
      context: source === "all" ? "AI and Digital audits" : source === "ai" ? "AI audits" : "Digital audits",
      info: "Every corrective action in these filters.",
      go: () => openList({}),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="SLA dashboard"
        description="Are store tasks completed on time, where are the delays, and what needs action?"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/escalation-settings">SLA settings</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/corrective-actions" search={listSearch({})}>
                Corrective actions
              </Link>
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          label="Audit type"
          options={SOURCES}
          value={source}
          onChange={(v) => setSource(v as ActionSourceFilter)}
        />
        <Segmented
          label="SLA type"
          options={[{ value: "all", label: "All SLAs" }, ...SLA_TYPES.map((t) => ({ value: t.value, label: t.short }))]}
          value={slaType}
          onChange={setSlaType}
        />
        {query.isPlaceholderData ? (
          <span className="flex items-center gap-2 text-xs text-mp-muted" aria-live="polite">
            <span className="size-1.5 animate-pulse rounded-full bg-[#7DB7D6]" aria-hidden />
            Updating…
          </span>
        ) : null}
      </div>

      {query.isPending ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-[104px] rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
      ) : query.isError ? (
        <ErrorState description={toUserMessage(query.error)} onRetry={() => void query.refetch()} />
      ) : !rows.length ? (
        <EmptyState
          icon={<Timer className="size-6" />}
          title="No actions match these filters"
          description="Corrective actions are raised automatically when an audit finds a problem. Clear a filter to see more."
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map(({ go, ...card }, i) => (
              <button
                key={card.label}
                type="button"
                onClick={go}
                className="block rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy [&>*]:transition-colors hover:[&>*]:bg-[#F4F7F9]"
                aria-label={`${card.label}: ${card.value}`}
              >
                <CaKpiCard {...card} accent={ACCENTS[i] ?? "grey"} />
              </button>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SlaAlertsPanel alerts={alerts} />
            <SlaTypeTargetChart rows={byType} onSelect={setSlaType} />
          </div>

          <SlaGroupTable
            title="Store performance"
            question="Which stores meet their SLAs, and where are tasks piling up?"
            nameLabel="Store"
            rows={stores}
            limit={12}
            onSelect={(r) => openList({ store: r.key })}
          />

          <div className="grid gap-4 lg:grid-cols-2">
            <SlaGroupTable
              title="Team performance"
              question="Which manager's team completes tasks on time?"
              nameLabel="Team"
              rows={teams}
            />
            <SlaGroupTable
              title="Employee performance"
              question="Who is behind on their tasks?"
              nameLabel="Owner"
              rows={owners}
            />
            <DelayReasonsChart rows={reasons} onSelect={() => openList({ outcome: "breached" })} />
            <ComplianceTrendChart points={trend} />
          </div>

          <p className="text-xs text-mp-muted">
            Times come from Aislix task timestamps: when the action was raised, its deadline, and when the store team
            submitted the fix. A fix counts once a manager or the AI re-check confirms it.
          </p>
        </>
      )}
    </div>
  );
}
