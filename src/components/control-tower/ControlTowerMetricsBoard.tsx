import { IndianRupee } from "lucide-react";

import { cn } from "@/lib/utils";
import { AISLIX_STATUS_MIX } from "@/lib/aislix-theme";
import { MpCard, MpCardHeader } from "@/components/design-system/MpCard";
import type { ControlTowerDemoPayload, ControlTowerKpi } from "@/lib/control-tower";
import { KpiInfoPopover } from "./KpiInfoPopover";
import { MpDonut, MpRadialGauge, MpRankBars } from "./MpCharts";

function byId(kpis: ControlTowerKpi[], id: string) {
  return kpis.find((k) => k.id === id);
}

function parsePct(value: string) {
  const n = Number(String(value).replace("%", "").replace("—", "").trim());
  return Number.isFinite(n) ? n : 0;
}

export function ControlTowerMetricsBoard({
  data,
  onDrill,
}: {
  data: ControlTowerDemoPayload;
  onDrill: (kpi: ControlTowerKpi) => void;
}) {
  const completion = byId(data.universalKpis, "audit_completion");
  const variance = byId(data.universalKpis, "value_variance");
  const openFindings = byId(data.universalKpis, "open_findings");
  const critical = byId(data.universalKpis, "critical_findings");
  const openActions = byId(data.universalKpis, "open_actions");
  const overdue = byId(data.universalKpis, "overdue_actions");
  const pending = data.universalKpis.filter((k) => !k.available);

  const pct = completion ? parsePct(completion.value) : 0;

  const status = data.auditStatus.map((b) => ({
    ...b,
    color: AISLIX_STATUS_MIX[b.name] ?? "#E7EDF0",
  }));
  const statusTotal = status.reduce((sum, row) => sum + row.value, 0);
  const slaBars = [
    { label: "Overdue", value: data.correctiveActionHealth.overdue, color: "#F5C6CB" },
    { label: "Due today", value: data.correctiveActionHealth.dueToday, color: "#FFE8A3" },
    { label: "Open", value: data.correctiveActionHealth.open, color: "#AEDEF9" },
    { label: "Closed", value: data.correctiveActionHealth.closed, color: "#C8E6C9" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        {completion ? (
          <MpCard className="lg:col-span-2">
            <MpCardHeader
              title={completion.label}
              description={completion.detail}
              action={<KpiInfoPopover kpi={completion} />}
            />
            <button
              type="button"
              onClick={() => completion.available && onDrill(completion)}
              className="grid w-full gap-6 p-5 text-left sm:grid-cols-[auto,1fr] sm:items-center"
            >
              <MpRadialGauge value={pct} label="Complete" sublabel={completion.detail} />
              <div>
                <p className="font-display text-4xl font-semibold tracking-tight text-navy">{completion.value}</p>
                <p className="mt-2 text-sm text-mp-muted">{completion.detail}</p>
              </div>
            </button>
          </MpCard>
        ) : null}

        <MpCard>
          <MpCardHeader title="Response SLA" description="Corrective actions by workload bucket." />
          <div className="p-5">
            <MpRankBars data={slaBars} />
            {(openFindings || critical) &&
            (parseInt(String(openFindings?.value ?? "0"), 10) > 0 ||
              parseInt(String(critical?.value ?? "0"), 10) > 0) ? (
              <div className="mt-5 rounded-lg border border-dark-line bg-dark-bg px-3.5 py-3">
                <p className="text-[13px] font-semibold text-navy">
                  {critical?.value ?? 0} critical · {openFindings?.value ?? 0} open findings
                </p>
                <p className="mt-0.5 text-[12px] text-navy/70">
                  Review exceptions to assign owners and close breaches.
                </p>
              </div>
            ) : null}
          </div>
        </MpCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <MpCard>
          <MpCardHeader title="Assignment mix" description="Status breakdown for assignments in period." />
          <div className="p-5">
            {status.every((b) => b.value === 0) ? (
              <p className="text-sm text-mp-muted">No assignments in this period</p>
            ) : (
              <MpDonut
                slices={status.map((b) => ({ label: b.name, value: b.value, color: b.color }))}
                total={statusTotal}
                totalLabel="Assignments"
              />
            )}
          </div>
        </MpCard>

        <MpCard className="border-dark-line bg-dark-bg">
          <MpCardHeader title="Exceptions" description="Open findings requiring attention." />
          <div className="grid grid-cols-2 gap-3 p-5">
            {[openFindings, critical].map((kpi) =>
              kpi ? (
                <button
                  key={kpi.id}
                  type="button"
                  onClick={() => kpi.available && onDrill(kpi)}
                  className="rounded-lg border border-dark-line bg-white/80 p-3 text-left"
                >
                  <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-mp-muted">{kpi.label}</p>
                  <p className="mt-1 font-display text-3xl font-semibold tabular-nums text-navy">{kpi.value}</p>
                  <p className="mt-1 line-clamp-2 text-[0.7rem] text-mp-muted">{kpi.detail}</p>
                </button>
              ) : null,
            )}
          </div>
        </MpCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        {variance ? (
          <button
            type="button"
            onClick={() => variance.available && onDrill(variance)}
            className="lg:col-span-5 rounded-xl border border-warehouse-line bg-warehouse-bg p-5 text-left shadow-card"
          >
            <p className="flex items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-wider text-mp-muted">
              <IndianRupee className="size-3.5" /> {variance.label}
            </p>
            <p className="mt-3 font-display text-4xl font-semibold tracking-tight text-navy">{variance.value}</p>
            <p className="mt-2 text-xs text-mp-muted">{variance.detail}</p>
          </button>
        ) : null}

        <div className="lg:col-span-7 rounded-xl border border-market-line bg-market-bg p-5 shadow-card">
          <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-mp-muted">Corrective action load</p>
          <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-market-line bg-market-line sm:grid-cols-4">
            {[
              { kpi: openActions, label: "Open" },
              { kpi: overdue, label: "Overdue" },
              { label: "Due today", value: String(data.correctiveActionHealth.dueToday) },
              { label: "Closed", value: String(data.correctiveActionHealth.closed) },
            ].map((cell) => (
              <button
                key={cell.label}
                type="button"
                disabled={"kpi" in cell && cell.kpi ? !cell.kpi.available : true}
                onClick={() => {
                  if ("kpi" in cell && cell.kpi?.available) onDrill(cell.kpi);
                }}
                className="bg-white/80 p-3 text-left"
              >
                <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-mp-muted">{cell.label}</p>
                <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-navy">
                  {"kpi" in cell && cell.kpi ? cell.kpi.value : cell.value}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {pending.length > 0 ? (
        <div className="rounded-xl border border-neutral-line bg-neutral-bg p-4">
          <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-mp-muted">Not computed yet</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {pending.map((kpi) => (
              <div
                key={kpi.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-neutral-line bg-white px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-navy">{kpi.label}</p>
                  <p className="truncate text-[0.7rem] text-mp-muted">{kpi.detail}</p>
                </div>
                <span className="shrink-0 text-sm font-semibold text-mp-muted">{kpi.value}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {data.contextualKpis.length > 0 ? (
        <div className="rounded-xl border border-line bg-white p-4 shadow-card">
          <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-mp-muted">Operating-model metrics</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {data.contextualKpis.map((kpi, i) => (
              <span
                key={kpi.id}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs text-navy",
                  i % 3 === 0 && "border-warehouse-line bg-warehouse-bg",
                  i % 3 === 1 && "border-market-line bg-market-bg",
                  i % 3 === 2 && "border-neutral-line bg-neutral-bg",
                )}
              >
                <span className="font-medium">{kpi.label}</span>
                <span className="text-mp-muted">{kpi.value}</span>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {data.auditSpecificKpis.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-line bg-white shadow-card">
          <div className="border-b border-line bg-canvas px-4 py-3">
            <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-mp-muted">Audit-specific metrics</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-canvas text-left text-[0.7rem] uppercase tracking-wide text-navy">
              <tr>
                <th className="px-4 py-2 font-semibold">Metric</th>
                <th className="px-4 py-2 font-semibold">Value</th>
                <th className="px-4 py-2 font-semibold">Note</th>
              </tr>
            </thead>
            <tbody>
              {data.auditSpecificKpis.map((kpi) => (
                <tr key={kpi.id} className="border-t border-line">
                  <td className="px-4 py-2.5 text-navy">{kpi.label}</td>
                  <td className="px-4 py-2.5 font-semibold tabular-nums text-navy">{kpi.value}</td>
                  <td className="px-4 py-2.5 text-mp-muted">{kpi.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-line bg-white px-4 py-6 text-sm text-mp-muted">
          No audit-specific metrics apply yet. Map Expected Qty, Actual Qty, Expiry Date or QC Status on templates to
          enable them.
        </p>
      )}
    </div>
  );
}
