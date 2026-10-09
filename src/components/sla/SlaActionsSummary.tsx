import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";

import { CaKpiCard } from "@/components/corrective-actions/CaParts";
import { ChartUnavailable } from "@/components/corrective-actions/CaCharts";
import { StoreVarianceMatrix } from "@/components/corrective-actions/StoreVarianceMatrix";
import { MpCard } from "@/components/design-system/MpCard";
import {
  AuditChecksGrid,
  DelayReasonsChart,
  SlaAlertsPanel,
  SlaGroupTable,
  SlaTypeTargetChart,
  type AuditCheckKey,
} from "@/components/sla/SlaCharts";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { AislixAccent } from "@/lib/ai-audit/kpi-palette";
import type { ScopedActions } from "@/lib/ai-dashboard-actions";
import { auditChecks } from "@/lib/audit-checks";
import { correctiveActionKpis, variancesByStore } from "@/lib/corrective-action-insights";
import {
  SLA_TYPES,
  delayReasons,
  formatMinutes,
  matchesSlaFilters,
  slaAlerts,
  slaByStore,
  slaByType,
  slaSummary,
} from "@/lib/sla-insights";
import type { CorrectiveActionsSearch } from "@/routes/corrective-actions";
import { cn } from "@/lib/utils";

/** PURPLE → BLUE → PINK → GREEN → CYAN; no same accent side by side or stacked in the 4-column grid. */
const ACCENTS: AislixAccent[] = ["purple", "blue", "pink", "green", "cyan", "pink", "green", "grey"];

const CHECK_SEARCH: Record<AuditCheckKey, CorrectiveActionsSearch> = {
  quantity: { variance: "quantity" },
  location: { variance: "location" },
  extra_facings: { variance: "extra_facings" },
  implemented: { stage: "fixed" },
  pre_post: { variance: "pre_post" },
};

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

/**
 * Corrective actions and SLA for the audits in the dashboard filters (date, store, city, team,
 * category, SKU). Every card opens the SLA page or the action list with the same filters.
 */
export function SlaActionsSummary({
  data,
  loading,
  source,
}: {
  data: ScopedActions | undefined;
  loading: boolean;
  source: "ai" | "digital";
}) {
  const [slaType, setSlaType] = useState("all");
  const navigate = useNavigate();
  const sourceLabel = source === "ai" ? "AI audits" : "Digital audits";

  const all = useMemo(() => data?.actions ?? [], [data]);
  const rows = useMemo(() => all.filter((a) => matchesSlaFilters(a, slaType, "all")), [all, slaType]);
  const sla = useMemo(() => slaSummary(rows), [rows]);
  const kpis = useMemo(() => correctiveActionKpis(rows), [rows]);
  const byType = useMemo(() => slaByType(all), [all]);
  const reasons = useMemo(() => delayReasons(rows), [rows]);
  const stores = useMemo(() => slaByStore(rows), [rows]);
  const alerts = useMemo(() => slaAlerts(rows), [rows]);
  const checks = useMemo(() => auditChecks(rows, data?.verifications ?? []), [rows, data]);
  const byStoreVariance = useMemo(() => variancesByStore(rows), [rows]);

  const base: CorrectiveActionsSearch = { source, ...(slaType !== "all" ? { sla: slaType } : {}) };
  const openActions = (search: CorrectiveActionsSearch) =>
    void navigate({ to: "/corrective-actions", search: { ...base, ...search } });
  const openSla = (extra: { sla?: string } = {}) =>
    void navigate({ to: "/sla", search: { source, ...(slaType !== "all" ? { sla: slaType } : {}), ...extra } });

  const cards: Array<{
    label: string;
    value: string;
    context: string;
    info: string;
    go: () => void;
  }> = [
    {
      label: "SLA compliance",
      value: sla.compliancePct == null ? "N/A" : `${sla.compliancePct}%`,
      context:
        sla.compliancePct == null
          ? "No deadlines reached yet"
          : `${sla.met} on time of ${sla.met + sla.breaches} due`,
      info: "Fixes confirmed on time, out of every action that was fixed or is past its deadline.",
      go: () => openSla(),
    },
    {
      label: "Actual vs target",
      value: sla.medianActualMin == null ? "N/A" : formatMinutes(sla.medianActualMin),
      context: `Target ${formatMinutes(sla.medianTargetMin)} · median time to fix`,
      info: "Median time from when the action was raised to when the fix was submitted, for confirmed fixes.",
      go: () => openSla(),
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
      label: "Fixed (30 days)",
      value: String(kpis.closedLast30),
      context: "Verified or closed",
      info: "Actions verified or closed in the last 30 days.",
      go: () => openActions({ stage: "fixed" }),
    },
    {
      label: "Escalated",
      value: String(kpis.escalated),
      context: "Sent to a manager or admin",
      info: "Overdue actions escalated to the owner's manager, then to admins.",
      go: () => openActions({ stage: "escalated" }),
    },
  ];

  return (
    <section className="space-y-3" aria-label="Corrective actions and SLA">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-navy">Corrective actions & SLA</h2>
          <p className="mt-0.5 text-[13px] text-mp-muted">
            Are fixes from {sourceLabel.toLowerCase()} in these filters done on time, where are the delays, and what needs
            action?
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/escalation-settings">SLA settings</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/corrective-actions" search={{ source }}>
              Corrective actions
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/sla" search={{ source }}>
              SLA dashboard
            </Link>
          </Button>
        </div>
      </div>
      <SlaTypeChips value={slaType} onChange={setSlaType} />

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[104px] rounded-xl" />
          ))}
        </div>
      ) : !rows.length ? (
        <MpCard className="p-4">
          <ChartUnavailable
            reason={`No corrective actions from ${sourceLabel.toLowerCase()} match these filters${slaType !== "all" ? " and SLA type" : ""}.`}
          />
        </MpCard>
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

          <div>
            <h3 className="mb-2 text-sm font-semibold text-navy">Audit checks</h3>
            <AuditChecksGrid
              checks={checks}
              hideQuantity={source === "digital"}
              onSelect={(key) => openActions(CHECK_SEARCH[key])}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SlaTypeTargetChart rows={byType} onSelect={(type) => setSlaType(type)} />
            <SlaAlertsPanel alerts={alerts} limit={5} />
            <SlaGroupTable
              title="Stores with the most breaches"
              question="Where are deadlines being missed?"
              nameLabel="Store"
              rows={stores}
              limit={5}
              onSelect={(r) => openActions({ store: r.key, outcome: "breached" })}
            />
            <DelayReasonsChart rows={reasons} limit={3} onSelect={() => openSla()} />
          </div>

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
