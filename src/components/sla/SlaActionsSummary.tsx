import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";

import { CaKpiCard } from "@/components/corrective-actions/CaParts";
import {
  ChartUnavailable,
  PipelineChart,
  RecheckChart,
  StoreChart,
  TypeChart,
} from "@/components/corrective-actions/CaCharts";
import { StoreVarianceMatrix } from "@/components/corrective-actions/StoreVarianceMatrix";
import { MpCard } from "@/components/design-system/MpCard";
import {
  AuditChecksGrid,
  ComplianceTrendChart,
  DelayReasonsChart,
  OpenActionsList,
  SlaAlertsPanel,
  SlaGroupTable,
  SlaStatusChart,
  SlaTypeTargetChart,
  type AuditCheckKey,
  type SlaStatusKey,
} from "@/components/sla/SlaCharts";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { AislixAccent } from "@/lib/ai-audit/kpi-palette";
import type { ScopedActions } from "@/lib/ai-dashboard-actions";
import { auditChecks } from "@/lib/audit-checks";
import {
  actionsByType,
  correctiveActionKpis,
  openActionsByStore,
  pipelineCounts,
  recheckResults,
  variancesByStore,
} from "@/lib/corrective-action-insights";
import {
  SLA_TYPES,
  delayReasons,
  formatMinutes,
  matchesSlaFilters,
  slaAlerts,
  slaByOwner,
  slaByStore,
  slaByType,
  slaSummary,
  weeklyCompliance,
} from "@/lib/sla-insights";
import type { CorrectiveActionsSearch } from "@/routes/corrective-actions";
import { cn } from "@/lib/utils";

type SectionProps = {
  data: ScopedActions | undefined;
  loading: boolean;
  source: "ai" | "digital";
};

type KpiCardDef = { label: string; value: string; context: string; info: string; go: () => void };

const CHECK_SEARCH: Record<AuditCheckKey, CorrectiveActionsSearch> = {
  quantity: { variance: "quantity" },
  location: { variance: "location" },
  extra_facings: { variance: "extra_facings" },
  implemented: { stage: "fixed" },
  pre_post: { variance: "pre_post" },
};

const sourceText = (source: "ai" | "digital") => (source === "ai" ? "AI audits" : "digital audits");

function SectionHeader({ title, question, actions }: { title: string; question: string; actions: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="font-display text-lg font-semibold text-navy">{title}</h2>
        <p className="mt-0.5 text-[13px] text-mp-muted">{question}</p>
      </div>
      <div className="flex flex-wrap gap-2">{actions}</div>
    </div>
  );
}

function KpiGrid({ cards, accents }: { cards: KpiCardDef[]; accents: AislixAccent[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(({ go, ...card }, i) => (
        <button
          key={card.label}
          type="button"
          onClick={go}
          className="block rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy [&>*]:transition-colors hover:[&>*]:bg-[#F4F7F9]"
          aria-label={`${card.label}: ${card.value}`}
        >
          <CaKpiCard {...card} accent={accents[i] ?? "grey"} />
        </button>
      ))}
    </div>
  );
}

function SectionSkeleton({ count }: { count: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-[104px] rounded-xl" />
      ))}
    </div>
  );
}

/**
 * Corrective actions: what the audits found wrong on the shelf (the five checks), who is fixing it,
 * and whether the fix improved the shelf. Follows the dashboard filters.
 */
export function CorrectiveActionsSummary({ data, loading, source }: SectionProps) {
  const navigate = useNavigate();
  const label = sourceText(source);
  const rows = useMemo(() => data?.actions ?? [], [data]);
  const kpis = useMemo(() => correctiveActionKpis(rows), [rows]);
  const checks = useMemo(() => auditChecks(rows, data?.verifications ?? []), [rows, data]);
  const byStoreVariance = useMemo(() => variancesByStore(rows), [rows]);
  const pipeline = useMemo(() => pipelineCounts(rows), [rows]);
  const types = useMemo(() => actionsByType(rows), [rows]);
  const stores = useMemo(() => openActionsByStore(rows, 6), [rows]);
  const rechecks = useMemo(() => recheckResults(rows, 6), [rows]);

  const openActions = (search: CorrectiveActionsSearch) =>
    void navigate({ to: "/corrective-actions", search: { source, ...search } });

  const cards: KpiCardDef[] = [
    {
      label: "Open actions",
      value: String(kpis.open),
      context: "Open or in progress",
      info: "Corrective actions from these audits that the store team still has to fix.",
      go: () => openActions({ stage: "active" }),
    },
    {
      label: "Awaiting verification",
      value: String(kpis.submitted),
      context: "Fix submitted, not yet confirmed",
      info: "The store team submitted a fix; a manager or AI re-check still has to confirm it.",
      go: () => openActions({ stage: "submitted" }),
    },
    {
      label: "Critical & high open",
      value: String(kpis.criticalHighOpen),
      context: "Most urgent fixes",
      info: "Open actions with critical or high priority.",
      go: () => openActions({ stage: "active", priority: "critical_high" }),
    },
    {
      label: "Fixed (30 days)",
      value: String(kpis.closedLast30),
      context: kpis.recheckPassRate == null ? "Verified or closed" : `${kpis.recheckPassRate}% passed AI re-check`,
      info: "Actions verified or closed in the last 30 days.",
      go: () => openActions({ stage: "fixed" }),
    },
  ];

  return (
    <section className="space-y-3" aria-label="Corrective actions">
      <SectionHeader
        title="Corrective actions"
        question={`What did ${label} find wrong on the shelf, who is fixing it, and did the fix improve the shelf?`}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/corrective-actions" search={{ source }}>
              Corrective actions
            </Link>
          </Button>
        }
      />
      {loading ? (
        <SectionSkeleton count={4} />
      ) : !rows.length ? (
        <MpCard className="p-4">
          <ChartUnavailable reason={`No corrective actions from ${label} match these filters.`} />
        </MpCard>
      ) : (
        <>
          <KpiGrid cards={cards} accents={["purple", "blue", "pink", "green"]} />
          <div>
            <h3 className="mb-2 text-sm font-semibold text-navy">Audit checks</h3>
            <AuditChecksGrid
              checks={checks}
              hideQuantity={source === "digital"}
              onSelect={(key) => openActions(CHECK_SEARCH[key])}
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <PipelineChart counts={pipeline} />
            <TypeChart rows={types} />
            <StoreChart rows={stores} />
            {source === "ai" ? <RecheckChart rows={rechecks} /> : <OpenActionsList actions={rows} limit={5} />}
          </div>
          {source === "ai" ? <OpenActionsList actions={rows} limit={6} /> : null}
          <StoreVarianceMatrix
            rows={byStoreVariance.rows}
            totals={byStoreVariance.totals}
            description="What went wrong in each store — planogram, quantity, location, brand, price, promotion. Click a number to open those actions."
            onSelect={(storeId, type) => openActions({ store: storeId ?? undefined, variance: type ?? undefined })}
          />
        </>
      )}
    </section>
  );
}

function SlaTypeChips({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const options = [{ value: "all", short: "All SLAs" }, ...SLA_TYPES];
  return (
    <div className="flex flex-wrap gap-1 rounded-lg border border-line bg-white p-0.5" role="tablist" aria-label="SLA type">
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
          {o.short}
        </button>
      ))}
    </div>
  );
}

const STATUS_SEARCH: Record<SlaStatusKey, CorrectiveActionsSearch> = {
  met: { outcome: "met" },
  breached: { outcome: "breached" },
  late_open: { stage: "overdue" },
  due_soon: { outcome: "due_soon" },
  on_track: { stage: "active" },
  awaiting: { stage: "submitted" },
};

/** No same accent side by side or stacked, in the 4- and 2-column layouts. */
const SLA_ACCENTS: AislixAccent[] = ["green", "blue", "pink", "cyan", "purple", "pink", "grey", "green"];

/**
 * SLA: are the fixes done within the target time (replenishment, expiry & damaged, issue resolution,
 * corrective action), where are the delays, and who needs a nudge. Follows the dashboard filters.
 */
export function SlaSummarySection({ data, loading, source }: SectionProps) {
  const [slaType, setSlaType] = useState("all");
  const navigate = useNavigate();
  const label = sourceText(source);

  const all = useMemo(() => data?.actions ?? [], [data]);
  const rows = useMemo(() => all.filter((a) => matchesSlaFilters(a, slaType, "all")), [all, slaType]);
  const sla = useMemo(() => slaSummary(rows), [rows]);
  const kpis = useMemo(() => correctiveActionKpis(rows), [rows]);
  const byType = useMemo(() => slaByType(all), [all]);
  const reasons = useMemo(() => delayReasons(rows), [rows]);
  const stores = useMemo(() => slaByStore(rows), [rows]);
  const owners = useMemo(() => slaByOwner(rows), [rows]);
  const alerts = useMemo(() => slaAlerts(rows), [rows]);
  const trend = useMemo(() => weeklyCompliance(rows), [rows]);

  const typeSearch = slaType !== "all" ? { sla: slaType } : {};
  const openActions = (search: CorrectiveActionsSearch) =>
    void navigate({ to: "/corrective-actions", search: { source, ...typeSearch, ...search } });
  const openSla = () => void navigate({ to: "/sla", search: { source, ...typeSearch } });

  const cards: KpiCardDef[] = [
    {
      label: "SLA compliance",
      value: sla.compliancePct == null ? "N/A" : `${sla.compliancePct}%`,
      context:
        sla.compliancePct == null ? "No deadlines reached yet" : `${sla.met} on time of ${sla.met + sla.breaches} due`,
      info: "Fixes confirmed on time, out of every action that was fixed or is past its deadline.",
      go: openSla,
    },
    {
      label: "Actual vs target",
      value: sla.medianActualMin == null ? "N/A" : formatMinutes(sla.medianActualMin),
      context: `Target ${formatMinutes(sla.medianTargetMin)} · median time to fix`,
      info: "Median time from when the action was raised to when the fix was submitted, for confirmed fixes.",
      go: openSla,
    },
    {
      label: "SLA breaches",
      value: String(sla.breaches),
      context: `${sla.breached} fixed late · ${sla.lateOpen} still open`,
      info: "Actions fixed after their deadline, plus actions still open past their deadline.",
      go: () => openActions({ outcome: "breached" }),
    },
    {
      label: "Pending tasks",
      value: String(sla.pending),
      context: `${sla.awaiting} awaiting approval`,
      info: "Actions not yet confirmed as fixed: open, in progress, or submitted and waiting for a manager or AI re-check.",
      go: () => openActions({ outcome: "pending" }),
    },
    {
      label: "Due soon",
      value: String(sla.dueSoon),
      context: "Less than 20% of the SLA time left",
      info: "Open actions close to their deadline. The owner gets an alert.",
      go: () => openActions({ outcome: "due_soon" }),
    },
    {
      label: "Overdue now",
      value: String(sla.lateOpen),
      context: "Past the deadline, not fixed",
      info: "Open or in-progress actions past their SLA deadline. The owner and their manager get an alert.",
      go: () => openActions({ stage: "overdue" }),
    },
    {
      label: "Escalated",
      value: String(kpis.escalated),
      context: "Sent to a manager or admin",
      info: "Overdue actions escalated to the owner's manager, then to admins.",
      go: () => openActions({ stage: "escalated" }),
    },
    {
      label: "Fixed on time",
      value: String(sla.met),
      context: "Confirmed before the deadline",
      info: "Fixes submitted before the SLA deadline and confirmed by a manager or AI re-check.",
      go: () => openActions({ outcome: "met" }),
    },
  ];

  return (
    <section className="space-y-3" aria-label="SLA">
      <SectionHeader
        title="SLA"
        question={`Are fixes from ${label} done on time, where are the delays, and what action is needed?`}
        actions={
          <>
            <Button asChild variant="ghost" size="sm">
              <Link to="/escalation-settings">SLA settings</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/sla" search={{ source }}>
                SLA dashboard
              </Link>
            </Button>
          </>
        }
      />
      <SlaTypeChips value={slaType} onChange={setSlaType} />
      {loading ? (
        <SectionSkeleton count={8} />
      ) : !rows.length ? (
        <MpCard className="p-4">
          <ChartUnavailable
            reason={`No actions with an SLA from ${label} match these filters${slaType !== "all" ? " and SLA type" : ""}.`}
          />
        </MpCard>
      ) : (
        <>
          <KpiGrid cards={cards} accents={SLA_ACCENTS} />
          <SlaStatusChart summary={sla} onSelect={(key) => openActions(STATUS_SEARCH[key])} />
          <div className="grid gap-4 lg:grid-cols-2">
            <SlaTypeTargetChart rows={byType} onSelect={(type) => setSlaType(type)} />
            <SlaAlertsPanel alerts={alerts} limit={5} />
            <SlaGroupTable
              title="Store performance"
              question="Which stores meet their SLA targets and which are falling behind?"
              nameLabel="Store"
              rows={stores}
              limit={5}
              onSelect={(r) => openActions({ store: r.key, outcome: "breached" })}
            />
            <SlaGroupTable
              title="Employee performance"
              question="Who completes assigned tasks on time?"
              nameLabel="Employee"
              rows={owners}
              limit={5}
              onSelect={openSla}
            />
            <DelayReasonsChart rows={reasons} limit={4} onSelect={openSla} />
            <ComplianceTrendChart points={trend} />
          </div>
        </>
      )}
    </section>
  );
}
