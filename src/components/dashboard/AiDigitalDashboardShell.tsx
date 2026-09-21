import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  fetchAiDashboardMetrics,
  fetchDigitalDashboardMetrics,
  type DashboardTab,
} from "@/lib/dashboard-ai-digital";
import { PageHeader } from "@/components/design-system/PageHeader";
import { cn } from "@/lib/utils";
import { useOptionalGlobalFilters } from "@/lib/global-filters";
import { assignmentStatusLabel } from "@/lib/assignment-status-ui";
import { Route as DashboardRoute } from "@/routes/dashboard";

function fmt(value: number | null | undefined, suffix = ""): string {
  if (value == null || Number.isNaN(value)) return "N/A";
  if (!Number.isFinite(value)) return "Data unavailable";
  return `${Number.isInteger(value) ? value : value.toFixed(1)}${suffix}`;
}

function KpiCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div
      className="rounded-xl border border-[#D9E2E8] bg-white p-4"
      style={{ borderLeftWidth: 3, borderLeftColor: accent }}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-[#667085]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[#102A43]">{value}</p>
    </div>
  );
}

const ACCENTS = ["#9B86D9", "#7DB7D6", "#FFEAF1", "#79E2A8", "#8EC9E8"];

function HorizontalBars({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: number }[];
}) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="rounded-xl border border-[#D9E2E8] bg-white p-4">
      <h3 className="text-sm font-semibold text-[#102A43]">{title}</h3>
      {!rows.length ? (
        <p className="mt-4 text-sm text-[#667085]">Data unavailable</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {rows.map((row) => (
            <li key={row.label}>
              <div className="mb-1 flex justify-between text-xs text-[#667085]">
                <span className="truncate pr-2 text-[#102A43]">{row.label}</span>
                <span>{row.value.toFixed(1)}</span>
              </div>
              <div className="h-2 rounded-full bg-[#EEF1F4]">
                <div
                  className="h-2 rounded-full bg-[#9B86D9]"
                  style={{ width: `${Math.min(100, (row.value / max) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AiDigitalDashboardShell() {
  const navigate = useNavigate({ from: DashboardRoute.fullPath });
  const { tab } = DashboardRoute.useSearch();
  const global = useOptionalGlobalFilters();
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
      }
    : undefined;

  const setTab = (next: DashboardTab) => {
    void navigate({
      search: (prev) => ({ ...prev, tab: next }),
      replace: true,
    });
  };

  const aiQuery = useQuery({
    queryKey: ["dashboard-ai-metrics", filterKey],
    queryFn: () => fetchAiDashboardMetrics(filterKey),
    staleTime: 30_000,
  });
  const digitalQuery = useQuery({
    queryKey: ["dashboard-digital-metrics", filterKey],
    queryFn: () => fetchDigitalDashboardMetrics(filterKey),
    staleTime: 30_000,
  });

  const ai = aiQuery.data;
  const dig = digitalQuery.data;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Dashboard"
        title="Operations dashboard"
        description="AI Audits and Digital Audits — shared filters and deterministic metrics."
      />

      <div className="flex gap-2 rounded-xl border border-[#D9E2E8] bg-white p-1 w-fit">
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

      {tab === "ai" ? (
        <div className="space-y-6">
          {aiQuery.isPending ? (
            <p className="text-sm text-[#667085]">Loading AI metrics…</p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["AI Audits", fmt(ai?.auditCount)],
                  ["Products Identified", fmt(ai?.productsIdentified)],
                  ["Brands Identified", fmt(ai?.brandsIdentified)],
                  ["Variants Identified", fmt(ai?.variantsIdentified)],
                  ["Categories Identified", fmt(ai?.categoriesIdentified)],
                  ["Total Actual Facings", fmt(ai?.totalFacings)],
                  ["Total Actual Visible Units", fmt(ai?.totalVisibleUnits)],
                  ["Average AI Confidence", fmt(ai?.avgConfidence != null ? ai.avgConfidence * (ai.avgConfidence <= 1 ? 100 : 1) : null, "%")],
                  ["Verification Coverage", fmt(ai?.verificationCoveragePct, "%")],
                  ["AI vs Verified Unit Variance", fmt(ai?.aiVsVerifiedUnitVariance)],
                  ["AI Unit Accuracy", fmt(ai?.aiUnitAccuracyPct, "%")],
                  ["AI Facing Accuracy", fmt(ai?.aiFacingAccuracyPct, "%")],
                ].map(([label, value], i) => (
                  <KpiCard key={label} label={label} value={value} accent={ACCENTS[i % ACCENTS.length]!} />
                ))}
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <HorizontalBars title="Brand share of facings (%)" rows={ai?.brandShare ?? []} />
                <HorizontalBars title="Category share of facings (%)" rows={ai?.categoryShare ?? []} />
                <HorizontalBars title="Top products by facings" rows={ai?.topProductsByFacings ?? []} />
                <HorizontalBars title="Top products by visible units" rows={ai?.topProductsByUnits ?? []} />
              </div>

              {ai?.planogram.applicable ? (
                <div className="rounded-xl border border-[#D9E2E8] bg-white p-4">
                  <h3 className="text-sm font-semibold text-[#102A43]">Planogram section</h3>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <KpiCard
                      label="Planogram Compliance %"
                      value={fmt(ai.planogram.compliancePct, "%")}
                      accent="#9B86D9"
                    />
                    <KpiCard
                      label="Actual Facings"
                      value={fmt(ai.planogram.actualFacings)}
                      accent="#7DB7D6"
                    />
                    <KpiCard label="Facing %" value={fmt(ai.planogram.facingPct, "%")} accent="#79E2A8" />
                    <KpiCard
                      label="Facing Variance"
                      value={fmt(ai.planogram.facingVariance)}
                      accent="#8EC9E8"
                    />
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[#667085]">
                  Planogram metrics: N/A (no planogram audits in the current set).
                </p>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {digitalQuery.isPending ? (
            <p className="text-sm text-[#667085]">Loading Digital metrics…</p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["Total Digital Audits", fmt(dig?.totalAudits)],
                  ["Completed", fmt(dig?.completed)],
                  ["In Progress", fmt(dig?.inProgress)],
                  ["Pending Review", fmt(dig?.pendingReview)],
                  ["Re-audit Requested", fmt(dig?.reauditRequested)],
                  ["Overdue", fmt(dig?.overdue)],
                  ["Completion %", fmt(dig?.completionPct, "%")],
                  ["On-Time Completion %", fmt(dig?.onTimePct, "%")],
                  ["Total Expected", fmt(dig?.totalExpected)],
                  ["Total Actual", fmt(dig?.totalActual)],
                  ["Net Variance", fmt(dig?.netVariance)],
                  ["Absolute Variance", fmt(dig?.absoluteVariance)],
                  ["Variance %", fmt(dig?.variancePct, "%")],
                ].map(([label, value], i) => (
                  <KpiCard key={label} label={label} value={value} accent={ACCENTS[i % ACCENTS.length]!} />
                ))}
              </div>

              <div className="rounded-xl border border-[#D9E2E8] bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[#102A43]">Last 5 digital audits</h3>
                  <Link to="/history" className="text-sm text-[#0f766e] hover:underline">
                    View all
                  </Link>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-[#D9E2E8] text-xs uppercase text-[#667085]">
                        <th className="py-2 pr-3">Audit</th>
                        <th className="py-2 pr-3">Location</th>
                        <th className="py-2 pr-3">Assignee</th>
                        <th className="py-2 pr-3">Expected</th>
                        <th className="py-2 pr-3">Actual</th>
                        <th className="py-2 pr-3">Variance</th>
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
                          <td className="py-2 pr-3">{fmt(row.expected)}</td>
                          <td className="py-2 pr-3">{fmt(row.actual)}</td>
                          <td className="py-2 pr-3">{fmt(row.variance)}</td>
                          <td className="py-2 pr-3">
                            {row.date ? new Date(row.date).toLocaleString() : "—"}
                          </td>
                          <td className="py-2">{assignmentStatusLabel(row.status)}</td>
                        </tr>
                      ))}
                      {!dig?.lastFive?.length ? (
                        <tr>
                          <td colSpan={8} className="py-6 text-[#667085]">
                            Data unavailable
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>

              {dig?.fnv.applicable ? (
                <div className="rounded-xl border border-[#D9E2E8] bg-white p-4">
                  <h3 className="text-sm font-semibold text-[#102A43]">FNV QC</h3>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <KpiCard label="FNV QC Audits" value={fmt(dig.fnv.audits)} accent="#9B86D9" />
                    <KpiCard label="Units Inspected" value={fmt(dig.fnv.unitsInspected)} accent="#7DB7D6" />
                    <KpiCard label="Sellable Rate" value={fmt(dig.fnv.sellableRate, "%")} accent="#79E2A8" />
                    <KpiCard label="Damage Rate" value={fmt(dig.fnv.damageRate, "%")} accent="#FFEAF1" />
                    <KpiCard
                      label="Human Review Rate"
                      value={fmt(dig.fnv.humanReviewRate, "%")}
                      accent="#8EC9E8"
                    />
                  </div>
                </div>
              ) : null}

              <div className="grid gap-4 lg:grid-cols-2">
                <HorizontalBars
                  title="Variance Explorer — by store (absolute)"
                  rows={dig?.varianceByStore ?? []}
                />
                <HorizontalBars
                  title="Variance Explorer — by category (absolute)"
                  rows={dig?.varianceByCategory ?? []}
                />
              </div>

              <div className="rounded-xl border border-[#D9E2E8] bg-white p-4">
                <h3 className="text-sm font-semibold text-[#102A43]">Audit A vs Audit B</h3>
                <p className="mt-1 text-sm text-[#667085]">
                  Side-by-side comparison of two completed audits (products, gaps, confidence).
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link
                    to="/history"
                    className="rounded-lg bg-[#102A43] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                  >
                    Pick audits in All Audits
                  </Link>
                  <Link
                    to="/compare"
                    className="rounded-lg border border-[#D9E2E8] px-4 py-2 text-sm font-medium text-[#102A43] hover:bg-[#F4F7F9]"
                  >
                    Open Compare
                  </Link>
                </div>
              </div>

              <div className="rounded-xl border border-[#D9E2E8] bg-white p-4">
                <h3 className="text-sm font-semibold text-[#102A43]">Corrective actions</h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  <KpiCard label="Open CA" value={fmt(dig?.caOpen)} accent="#9B86D9" />
                  <KpiCard label="Overdue CA" value={fmt(dig?.caOverdue)} accent="#FFEAF1" />
                  <KpiCard label="Closed CA" value={fmt(dig?.caClosed)} accent="#79E2A8" />
                  <KpiCard
                    label="Re-audit Improvement %"
                    value={fmt(dig?.reauditImprovementPct, "%")}
                    accent="#7DB7D6"
                  />
                  <KpiCard
                    label="Recurring Issue Rate %"
                    value={fmt(dig?.recurringIssueRate, "%")}
                    accent="#8EC9E8"
                  />
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
