import { Link } from "@tanstack/react-router";
import { ArrowRight, Info } from "lucide-react";

import { MpRankBars } from "@/components/control-tower/MpCharts";
import { AISLIX_PALETTE, type AislixAccent } from "@/lib/ai-audit/kpi-palette";
import type { DigitalDashboardMetrics } from "@/lib/dashboard-ai-digital";
import type { OpsAiDashboardData } from "@/lib/dashboard-ops-ai";

type Props = {
  ai: OpsAiDashboardData | undefined;
  digital: DigitalDashboardMetrics | undefined;
  aiLoading: boolean;
  digitalLoading: boolean;
  emptyAi: boolean;
  emptyDigital: boolean;
  onOpenTab: (tab: "ai" | "digital") => void;
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

/** Two rows of four: no repeat side-by-side or stacked. */
const KPI_ACCENTS: AislixAccent[] = ["purple", "blue", "pink", "green", "cyan", "purple", "blue", "pink"];

const STAGE_LABEL = {
  completed: "Completed",
  in_progress: "In progress",
  not_started: "Not started",
} as const;

function OverviewKpi({
  label,
  value,
  context,
  formula,
  index,
}: {
  label: string;
  value: string;
  context: string;
  formula: string;
  index: number;
}) {
  return (
    <div
      className="h-full rounded-xl border border-[#D9E2E8] bg-white p-4"
      style={{
        borderLeftWidth: 3,
        borderLeftColor: AISLIX_PALETTE[KPI_ACCENTS[index % KPI_ACCENTS.length]!],
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-[#667085]">{label}</p>
        <span title={formula} className="text-[#667085]">
          <Info className="size-3.5" aria-label="How this is calculated" />
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold text-[#102A43]">{value}</p>
      <p className="mt-1 text-xs text-[#667085]">{context}</p>
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
  onOpenTab,
}: Props) {
  if (aiLoading && digitalLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl border border-[#D9E2E8] bg-[#F4F7F9]" />
        ))}
      </div>
    );
  }

  const m = ai?.metrics;
  const aiCount = emptyAi ? null : (m?.auditCount ?? null);
  const digCount = emptyDigital ? null : (digital?.totalAudits ?? null);
  const totalAudits = aiCount == null && digCount == null ? null : (aiCount ?? 0) + (digCount ?? 0);
  const planogramApplicable = Boolean(m?.planogram.applicable);

  const kpis = [
    {
      label: "Total audits",
      value: fmt(totalAudits),
      context: `${fmt(aiCount)} AI · ${fmt(digCount)} digital`,
      formula: "AI audits plus digital audits in your current filters and store scope.",
    },
    {
      label: "Evidence coverage",
      value: emptyAi ? "N/A" : fmt(m?.verificationCoveragePct, "%"),
      context: "AI audits with human-verified evidence",
      formula: "Share of AI audit products confirmed against photo evidence.",
    },
    {
      label: "Open critical",
      value: emptyAi ? "N/A" : fmt(ai?.executive.openCritical),
      context: "Critical findings still open",
      formula: "Open findings with critical severity across your stores.",
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
    {
      label: "Open findings",
      value: emptyAi && emptyDigital ? "N/A" : fmt(ai?.synopsis.findingsOpen),
      context: "Issues waiting for action",
      formula: "Findings not yet resolved across AI and digital audits.",
    },
    {
      label: "Overdue actions",
      value: emptyDigital ? "N/A" : fmt(digital?.caOverdue),
      context: `${fmt(digital?.caOpen ?? ai?.synopsis.caOpen)} corrective actions open`,
      formula: "Corrective actions past their SLA due date.",
    },
  ];

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
        {kpis.map((kpi, i) => (
          <OverviewKpi key={kpi.label} index={i} {...kpi} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-[#D9E2E8] bg-white p-4">
          <h3 className="text-sm font-semibold text-[#102A43]">Audit mix</h3>
          <p className="mb-3 text-xs text-[#667085]">How many AI and digital audits are in your scope.</p>
          {mix.length ? (
            <MpRankBars data={mix} />
          ) : (
            <p className="rounded-lg bg-[#EEF1F4] px-3 py-6 text-center text-sm text-[#667085]">
              Data unavailable — run your first audit to see the mix.
            </p>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ["ai", "AI Audits", "Shelf photos, products, brands, planogram compliance."],
              ["digital", "Digital Audits", "Counts, variance, corrective actions, re-audits."],
            ] as const
          ).map(([id, title, body]) => (
            <button
              key={id}
              type="button"
              onClick={() => onOpenTab(id)}
              className="flex flex-col justify-between rounded-xl border border-[#D9E2E8] bg-white p-4 text-left transition-colors hover:bg-[#F4F7F9]"
            >
              <span>
                <span className="block text-sm font-semibold text-[#102A43]">{title}</span>
                <span className="mt-1 block text-xs text-[#667085]">{body}</span>
              </span>
              <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-[#102A43]">
                Open detailed dashboard <ArrowRight className="size-3.5" />
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-[#D9E2E8] bg-white p-4">
        <h3 className="text-sm font-semibold text-[#102A43]">Latest audits — AI and digital</h3>
        <p className="mb-3 text-xs text-[#667085]">The 10 most recent audits across both audit types.</p>
        {combined.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-[#D9E2E8] text-left text-xs uppercase tracking-wide text-[#667085]">
                  <th className="py-2 pr-3 font-medium">Type</th>
                  <th className="py-2 pr-3 font-medium">Audit</th>
                  <th className="py-2 pr-3 font-medium">Store</th>
                  <th className="py-2 pr-3 font-medium">Date</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">Result</th>
                  <th className="py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {combined.map((row) => (
                  <tr key={row.key} className="border-b border-[#EEF1F4] last:border-0">
                    <td className="py-2 pr-3">
                      <span
                        className="rounded-full border px-2 py-0.5 text-xs font-medium text-[#102A43]"
                        style={{
                          borderColor: row.kind === "AI audit" ? AISLIX_PALETTE.purple : AISLIX_PALETTE.blue,
                        }}
                      >
                        {row.kind}
                      </span>
                    </td>
                    <td className="max-w-[200px] truncate py-2 pr-3 text-[#102A43]">{row.name}</td>
                    <td className="max-w-[160px] truncate py-2 pr-3 text-[#102A43]">{row.store || "—"}</td>
                    <td className="py-2 pr-3 text-[#667085]">{fmtDate(row.date)}</td>
                    <td className="py-2 pr-3 capitalize text-[#102A43]">{row.status.replace(/_/g, " ")}</td>
                    <td className="py-2 pr-3 tabular-nums text-[#102A43]">{row.result}</td>
                    <td className="py-2 text-right">
                      {row.scanId ? (
                        <Link
                          to="/results"
                          search={{ scan: row.scanId } as never}
                          className="text-xs font-medium text-[#102A43] hover:underline"
                        >
                          View report
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
