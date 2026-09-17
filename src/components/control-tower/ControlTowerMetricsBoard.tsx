import { Cell, Pie, PieChart, PolarAngleAxis, RadialBar, RadialBarChart, ResponsiveContainer, Tooltip } from "recharts";
import { AlertTriangle, IndianRupee } from "lucide-react";

import { cn } from "@/lib/utils";
import { AISLIX, AISLIX_STATUS_MIX } from "@/lib/aislix-theme";
import type { ControlTowerDemoPayload, ControlTowerKpi } from "@/lib/control-tower";
import { KpiInfoPopover } from "./KpiInfoPopover";

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
    color: AISLIX_STATUS_MIX[b.name] ?? AISLIX.customBg,
  }));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-12">
        {completion ? (
          <button
            type="button"
            onClick={() => completion.available && onDrill(completion)}
            className="xl:col-span-4 rounded-xl border border-[var(--aislix-border)] bg-[var(--aislix-primary)] p-5 text-left text-white shadow-[0_2px_10px_rgba(16,42,67,0.06)]"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-white/70">
                {completion.label}
              </p>
              <span className="text-white/80">
                <KpiInfoPopover kpi={completion} />
              </span>
            </div>
            <div className="mt-2 grid grid-cols-[7.5rem_1fr] items-center gap-3">
              <div className="h-28">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart
                    data={[{ name: "pct", value: pct, fill: "#FFFFFF" }]}
                    innerRadius="68%"
                    outerRadius="100%"
                    startAngle={90}
                    endAngle={-270}
                  >
                    <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                    <RadialBar dataKey="value" background={{ fill: "rgba(255,255,255,0.18)" }} cornerRadius={8} />
                  </RadialBarChart>
                </ResponsiveContainer>
              </div>
              <div>
                <p className="text-4xl font-semibold tracking-tight">{completion.value}</p>
                <p className="mt-1 text-xs text-white/75">{completion.detail}</p>
              </div>
            </div>
          </button>
        ) : null}

        <div className="xl:col-span-4 rounded-xl border border-[var(--aislix-border)] bg-white p-5 shadow-[0_2px_10px_rgba(16,42,67,0.06)]">
          <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--aislix-secondary)]">
            Assignment mix
          </p>
          {status.every((b) => b.value === 0) ? (
            <p className="mt-8 text-sm text-[var(--aislix-secondary)]">No assignments in this period</p>
          ) : (
            <div className="mt-2 grid grid-cols-[8rem_1fr] items-center gap-3">
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={status} dataKey="value" nameKey="name" innerRadius={34} outerRadius={52} paddingAngle={2}>
                      {status.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} stroke={AISLIX.white} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="space-y-1.5 text-xs">
                {status.map((b) => (
                  <li key={b.name} className="flex items-center justify-between gap-2 text-[var(--aislix-primary)]">
                    <span className="flex items-center gap-2">
                      <span className="size-2 rounded-full" style={{ background: b.color }} />
                      {b.name}
                    </span>
                    <span className="font-semibold tabular-nums">{b.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="xl:col-span-4 rounded-xl border border-[var(--aislix-darkstore-border)] bg-[var(--aislix-darkstore-bg)] p-5 shadow-[0_2px_10px_rgba(16,42,67,0.06)]">
          <p className="flex items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--aislix-primary)]">
            <AlertTriangle className="size-3.5" /> Exceptions
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {[openFindings, critical].map((kpi) =>
              kpi ? (
                <button
                  key={kpi.id}
                  type="button"
                  onClick={() => kpi.available && onDrill(kpi)}
                  className="rounded-lg border border-[var(--aislix-darkstore-border)] bg-white/70 p-3 text-left"
                >
                  <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--aislix-secondary)]">
                    {kpi.label}
                  </p>
                  <p className="mt-1 text-3xl font-semibold tabular-nums text-[var(--aislix-primary)]">{kpi.value}</p>
                  <p className="mt-1 line-clamp-2 text-[0.7rem] text-[var(--aislix-secondary)]">{kpi.detail}</p>
                </button>
              ) : null,
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        {variance ? (
          <button
            type="button"
            onClick={() => variance.available && onDrill(variance)}
            className="lg:col-span-5 rounded-xl border border-[var(--aislix-warehouse-border)] bg-[var(--aislix-warehouse-bg)] p-5 text-left shadow-[0_2px_10px_rgba(16,42,67,0.06)]"
          >
            <p className="flex items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--aislix-secondary)]">
              <IndianRupee className="size-3.5" /> {variance.label}
            </p>
            <p className="mt-3 text-4xl font-semibold tracking-tight text-[var(--aislix-primary)]">{variance.value}</p>
            <p className="mt-2 text-xs text-[var(--aislix-secondary)]">{variance.detail}</p>
          </button>
        ) : null}

        <div className="lg:col-span-7 rounded-xl border border-[var(--aislix-supermarket-border)] bg-[var(--aislix-supermarket-bg)] p-5 shadow-[0_2px_10px_rgba(16,42,67,0.06)]">
          <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--aislix-secondary)]">
            Corrective action load
          </p>
          <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-[var(--aislix-supermarket-border)] bg-[var(--aislix-supermarket-border)] sm:grid-cols-4">
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
                <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--aislix-secondary)]">
                  {cell.label}
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--aislix-primary)]">
                  {"kpi" in cell && cell.kpi ? cell.kpi.value : cell.value}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {pending.length > 0 ? (
        <div className="rounded-xl border border-[var(--aislix-custom-border)] bg-[var(--aislix-custom-bg)] p-4">
          <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--aislix-secondary)]">
            Not computed yet
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {pending.map((kpi) => (
              <div
                key={kpi.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-[var(--aislix-custom-border)] bg-white px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-[var(--aislix-primary)]">{kpi.label}</p>
                  <p className="truncate text-[0.7rem] text-[var(--aislix-secondary)]">{kpi.detail}</p>
                </div>
                <span className="shrink-0 text-sm font-semibold text-[var(--aislix-secondary)]">{kpi.value}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {data.contextualKpis.length > 0 ? (
        <div className="rounded-xl border border-[var(--aislix-border)] bg-white p-4">
          <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--aislix-secondary)]">
            Operating-model metrics
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {data.contextualKpis.map((kpi, i) => (
              <span
                key={kpi.id}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs text-[var(--aislix-primary)]",
                  i % 3 === 0 && "border-[var(--aislix-warehouse-border)] bg-[var(--aislix-warehouse-bg)]",
                  i % 3 === 1 && "border-[var(--aislix-supermarket-border)] bg-[var(--aislix-supermarket-bg)]",
                  i % 3 === 2 && "border-[var(--aislix-custom-border)] bg-[var(--aislix-custom-bg)]",
                )}
              >
                <span className="font-medium">{kpi.label}</span>
                <span className="text-[var(--aislix-secondary)]">{kpi.value}</span>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {data.auditSpecificKpis.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-[var(--aislix-border)] bg-white">
          <div className="border-b border-[var(--aislix-border)] bg-[var(--aislix-surface)] px-4 py-3">
            <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--aislix-secondary)]">
              Audit-specific metrics
            </p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-[var(--aislix-surface)] text-left text-[0.7rem] uppercase tracking-wide text-[var(--aislix-primary)]">
              <tr>
                <th className="px-4 py-2 font-semibold">Metric</th>
                <th className="px-4 py-2 font-semibold">Value</th>
                <th className="px-4 py-2 font-semibold">Note</th>
              </tr>
            </thead>
            <tbody>
              {data.auditSpecificKpis.map((kpi) => (
                <tr key={kpi.id} className="border-t border-[var(--aislix-border)]">
                  <td className="px-4 py-2.5 text-[var(--aislix-primary)]">{kpi.label}</td>
                  <td className="px-4 py-2.5 font-semibold tabular-nums text-[var(--aislix-primary)]">{kpi.value}</td>
                  <td className="px-4 py-2.5 text-[var(--aislix-secondary)]">{kpi.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-[var(--aislix-border)] bg-white px-4 py-6 text-sm text-[var(--aislix-secondary)]">
          No audit-specific metrics apply yet. Map Expected Qty, Actual Qty, Expiry Date or QC Status on templates to
          enable them.
        </p>
      )}
    </div>
  );
}
