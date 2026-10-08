import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, Info } from "lucide-react";

import { MpRankBars } from "@/components/control-tower/MpCharts";
import { AISLIX_PALETTE } from "@/lib/ai-audit/kpi-palette";
import type { DigitalDashboardMetrics } from "@/lib/dashboard-ai-digital";
import type { OpsAiDashboardData } from "@/lib/dashboard-ops-ai";

type Props = {
  ai: OpsAiDashboardData | undefined;
  digital: DigitalDashboardMetrics | undefined;
  aiLoading: boolean;
  digitalLoading: boolean;
  emptyAi: boolean;
  emptyDigital: boolean;
  /** Rendered between the headline KPIs and the rest of the overview. */
  children?: ReactNode;
};

type CombinedRow = {
  key: string;
  kind: "AI audit" | "Digital audit";
  name: string;
  store: string;
  date: string;
  status: string;
  result: string;
  scanId: string | null;
};

function fmt(value: number | null | undefined, suffix = ""): string {
  if (value == null || !Number.isFinite(value)) return "N/A";
  return `${Number.isInteger(value) ? value : value.toFixed(1)}${suffix}`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const STAGE_LABEL = {
  completed: "Completed",
  in_progress: "In progress",
  not_started: "Not started",
} as const;

type OverviewKpiDef = {
  label: string;
  value: string;
  context: string;
  formula: string;
  primary?: boolean;
  risk?: boolean;
};

function OverviewKpi({ label, value, context, formula, risk }: OverviewKpiDef) {
  return (
    <div className="h-full rounded-xl border border-[#D9E2E8] bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm text-[#667085]">
          {risk ? (
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: "#ECBDCC" }}
              aria-label="Needs attention"
            />
          ) : null}
          {label}
        </p>
        <span title={formula} className="text-[#98A2B3]">
          <Info className="size-3.5" aria-label="How this is calculated" />
        </span>
      </div>
      <p
        className={
          value === "N/A"
            ? "mt-2 text-2xl font-semibold tabular-nums text-[#667085]"
            : "mt-2 text-2xl font-semibold tabular-nums text-[#04203F]"
        }
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-[#667085]">{context}</p>
    </div>
  );
}

function isPositive(value: number | null | undefined): boolean {
  return value != null && Number.isFinite(value) && value > 0;
}

function KpiSkeleton({ count }: { count: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="h-24 animate-pulse rounded-xl border border-[#D9E2E8] bg-[#F4F7F9]" />
      ))}
    </div>
  );
}

export function DashboardOverviewPanel({
  ai,
  digital,
  aiLoading,
  digitalLoading,
  emptyAi,
  emptyDigital,
  children,
}: Props) {
  const [showAll, setShowAll] = useState(false);

  if (aiLoading && digitalLoading) {
    return (
      <div className="flex flex-col gap-6">
        <KpiSkeleton count={4} />
        {children}
      </div>
    );
  }

  const m = ai?.metrics;
  const aiCount = emptyAi ? null : (m?.auditCount ?? null);
  const digCount = emptyDigital ? null : (digital?.totalAudits ?? null);
  const totalAudits = aiCount == null && digCount == null ? null : (aiCount ?? 0) + (digCount ?? 0);
  const planogramApplicable = Boolean(m?.planogram.applicable);

  const kpis: OverviewKpiDef[] = [
    {
      label: "Total audits",
      value: fmt(totalAudits),
      context: `${fmt(aiCount)} AI · ${fmt(digCount)} digital`,
      formula: "AI audits plus digital audits in your current filters and store scope.",
      primary: true,
    },
    {
      label: "Open critical",
      value: emptyAi ? "N/A" : fmt(ai?.executive.openCritical),
      context: "Critical findings still open",
      formula: "Open findings with critical severity across your stores.",
      primary: true,
      risk: !emptyAi && isPositive(ai?.executive.openCritical),
    },
    {
      label: "Open findings",
      value: emptyAi && emptyDigital ? "N/A" : fmt(ai?.synopsis.findingsOpen),
      context: "Issues waiting for action",
      formula: "Findings not yet resolved across AI and digital audits.",
      primary: true,
    },
    {
      label: "Overdue actions",
      value: emptyDigital ? "N/A" : fmt(digital?.caOverdue),
      context: `${fmt(digital?.caOpen ?? ai?.synopsis.caOpen)} corrective actions open`,
      formula: "Corrective actions past their SLA due date.",
      primary: true,
      risk: !emptyDigital && isPositive(digital?.caOverdue),
    },
    {
      label: "Evidence coverage",
      value: emptyAi ? "N/A" : fmt(m?.verificationCoveragePct, "%"),
      context: "AI audits with human-verified evidence",
      formula: "Share of AI audit products confirmed against photo evidence.",
    },
    {
      label: "Planogram compliance",
      value: emptyAi || !planogramApplicable ? "N/A" : fmt(m?.planogram.compliancePct, "%"),
      context: planogramApplicable ? "AI audits with a planogram" : "No planogram audits yet",
      formula: "Average planogram compliance from AI audits run against a planogram.",
    },
    {
      label: "Net unit variance",
      value: emptyDigital ? "N/A" : fmt(digital?.netVariance),
      context: "Digital counts vs expected units",
      formula: "Sum of actual minus expected units across digital audits.",
    },
    {
      label: "Digital completion",
      value: emptyDigital ? "N/A" : fmt(digital?.completionPct, "%"),
      context: emptyDigital
        ? "No digital audits yet"
        : `${fmt(digital?.completed)} of ${fmt(digital?.totalAudits)} completed`,
      formula: "Completed digital audits divided by all digital audits in scope.",
    },
  ];
  const primaryKpis = kpis.filter((k) => k.primary);
  const extraKpis = kpis.filter((k) => !k.primary);

  const combined: CombinedRow[] = [
    ...(emptyAi ? [] : (ai?.lastTen ?? [])).map((r) => ({
      key: `ai-${r.id}`,
      kind: "AI audit" as const,
      name: r.templateName || r.auditName,
      store: r.storeName,
      date: r.date,
      status: STAGE_LABEL[r.completionStage],
      result: r.scorePct == null ? "N/A" : `${Math.round(r.scorePct)}% score`,
      scanId: r.scanId,
    })),
    ...(emptyDigital ? [] : (digital?.lastTen ?? [])).map((r) => ({
      key: `dg-${r.id}`,
      kind: "Digital audit" as const,
      name: r.templateName || r.auditName,
      store: r.store,
      date: r.date,
      status: r.status,
      result: r.variance == null ? "N/A" : `${r.variance > 0 ? "+" : ""}${r.variance} units`,
      scanId: r.scanId,
    })),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10);

  const mix =
    aiCount == null && digCount == null
      ? []
      : [
          { label: "AI audits", value: aiCount ?? 0, color: AISLIX_PALETTE.purple },
          { label: "Digital audits", value: digCount ?? 0, color: AISLIX_PALETTE.blue },
        ];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {primaryKpis.map((kpi) => (
          <OverviewKpi key={kpi.label} {...kpi} />
        ))}
      </div>

      {children}

      <div>
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          aria-expanded={showAll}
          className="inline-flex items-center gap-1 rounded-lg text-sm font-medium text-[#04203F] hover:underline"
        >
          {showAll ? "Show fewer metrics" : `Show all metrics (${extraKpis.length + 1})`}
          {showAll ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </button>
        {showAll ? (
          <div className="mt-3 flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {extraKpis.map((kpi) => (
                <OverviewKpi key={kpi.label} {...kpi} />
              ))}
            </div>
            <div className="rounded-xl border border-[#D9E2E8] bg-white p-4 lg:max-w-[50%]">
              <h3 className="text-sm font-semibold text-[#04203F]">Audit mix</h3>
              <p className="mb-3 text-xs text-[#667085]">AI and digital audits in your scope.</p>
              {mix.length ? (
                <MpRankBars data={mix} />
              ) : (
                <p className="rounded-lg bg-[#EEF1F4] px-3 py-6 text-center text-sm text-[#667085]">
                  Data unavailable until your first audit.
                </p>
              )}
            </div>
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-[#D9E2E8] bg-white p-4">
        <Link
          to="/history"
          className="group inline-flex items-center gap-1 text-sm font-semibold text-[#04203F] hover:underline"
        >
          Latest audits
          <ChevronRight className="size-4 text-[#667085] group-hover:text-[#04203F]" />
        </Link>
        <p className="mb-3 text-xs text-[#667085]">The 10 most recent AI and digital audits.</p>
        {combined.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-[#D9E2E8] text-left text-xs text-[#667085]">
                  <th className="py-2 pr-3 font-medium">Type</th>
                  <th className="py-2 pr-3 font-medium">Audit</th>
                  <th className="py-2 pr-3 font-medium">Store</th>
                  <th className="py-2 pr-3 font-medium">Date</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">Result</th>
                  <th className="py-2 font-medium">
                    <span className="sr-only">Report</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {combined.map((row) => (
                  <tr key={row.key} className="border-b border-[#EEF1F4] last:border-0">
                    <td className="py-2 pr-3 text-[#667085]">{row.kind === "AI audit" ? "AI" : "Digital"}</td>
                    <td className="max-w-[200px] truncate py-2 pr-3 text-[#04203F]">{row.name}</td>
                    <td className="max-w-[160px] truncate py-2 pr-3 text-[#04203F]">{row.store || "—"}</td>
                    <td className="py-2 pr-3 text-[#667085]">{fmtDate(row.date)}</td>
                    <td className="py-2 pr-3 text-[#04203F] first-letter:uppercase">
                      {row.status.replace(/_/g, " ").toLowerCase()}
                    </td>
                    <td className="py-2 pr-3 tabular-nums text-[#04203F]">{row.result}</td>
                    <td className="py-2 text-right">
                      {row.scanId ? (
                        <Link
                          to="/results"
                          search={{ scan: row.scanId } as never}
                          className="text-xs font-medium text-[#04203F] hover:underline"
                        >
                          Open report
                        </Link>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="rounded-lg bg-[#EEF1F4] px-3 py-6 text-center text-sm text-[#667085]">
            No audits in your scope yet.
          </p>
        )}
      </div>
    </div>
  );
}
