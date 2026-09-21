import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/design-system/PageHeader";
import { fetchDigitalDashboardMetrics } from "@/lib/dashboard-ai-digital";

function fmt(value: number | null | undefined, suffix = ""): string {
  if (value == null || Number.isNaN(value)) return "N/A";
  return `${Number.isInteger(value) ? value : value.toFixed(1)}${suffix}`;
}

export const Route = createFileRoute("/intelligence/inventory-variance")({
  head: () => ({ meta: [{ title: "Inventory & Variance — Aislix" }] }),
  component: InventoryVariancePage,
});

function InventoryVariancePage() {
  const query = useQuery({
    queryKey: ["inventory-variance-metrics"],
    queryFn: fetchDigitalDashboardMetrics,
  });
  const m = query.data;
  const accuracy =
    m?.totalExpected != null && m.totalExpected > 0 && m.absoluteVariance != null
      ? Math.max(0, 100 - (m.absoluteVariance / m.totalExpected) * 100)
      : null;

  const kpis: [string, string][] = [
    ["Total Expected", fmt(m?.totalExpected)],
    ["Total Actual", fmt(m?.totalActual)],
    ["Net Variance", fmt(m?.netVariance)],
    ["Absolute Variance", fmt(m?.absoluteVariance)],
    ["Variance %", fmt(m?.variancePct, "%")],
    ["Inventory Accuracy %", fmt(accuracy, "%")],
    [
      "Potential Inventory Value Variance",
      m?.potentialInventoryValueVariance != null
        ? `₹${Math.round(m.potentialInventoryValueVariance).toLocaleString("en-IN")}`
        : "N/A",
    ],
    ["Re-audit Improvement %", fmt(m?.reauditImprovementPct, "%")],
    ["Recurring Issue Rate %", fmt(m?.recurringIssueRate, "%")],
  ];

  return (
    <AppShell title="" hidePageHeader>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Intelligence"
          title="Inventory & Variance"
          description="Expected vs actual aggregates from digital audits with Expected+Actual mapping."
        />
        {query.isPending ? (
          <p className="text-sm text-[#667085]">Loading variance metrics…</p>
        ) : (
          <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {kpis.map(([label, value], i) => {
              const accents = ["#9B86D9", "#7DB7D6", "#FFEAF1", "#79E2A8", "#8EC9E8"];
              return (
                <div
                  key={label}
                  className="rounded-xl border border-[#D9E2E8] bg-white p-4"
                  style={{ borderLeftWidth: 3, borderLeftColor: accents[i % accents.length] }}
                >
                  <p className="text-xs font-medium uppercase tracking-wide text-[#667085]">
                    {label}
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-[#102A43]">{value}</p>
                </div>
              );
            })}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-[#D9E2E8] bg-white p-4">
              <h3 className="text-sm font-semibold text-[#102A43]">Variance by store</h3>
              {(m?.varianceByStore ?? []).length ? (
                <ul className="mt-4 space-y-3">
                  {m!.varianceByStore.map((row) => {
                    const max = Math.max(...m!.varianceByStore.map((r) => r.value), 1);
                    return (
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
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-[#667085]">Data unavailable</p>
              )}
            </div>
            <div className="rounded-xl border border-[#D9E2E8] bg-white p-4">
              <h3 className="text-sm font-semibold text-[#102A43]">Variance by category</h3>
              {(m?.varianceByCategory ?? []).length ? (
                <ul className="mt-4 space-y-3">
                  {m!.varianceByCategory.map((row) => {
                    const max = Math.max(...m!.varianceByCategory.map((r) => r.value), 1);
                    return (
                      <li key={row.label}>
                        <div className="mb-1 flex justify-between text-xs text-[#667085]">
                          <span className="truncate pr-2 text-[#102A43]">{row.label}</span>
                          <span>{row.value.toFixed(1)}</span>
                        </div>
                        <div className="h-2 rounded-full bg-[#EEF1F4]">
                          <div
                            className="h-2 rounded-full bg-[#7DB7D6]"
                            style={{ width: `${Math.min(100, (row.value / max) * 100)}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-[#667085]">Data unavailable</p>
              )}
            </div>
          </div>
          </>
        )}
        <p className="text-sm text-[#667085]">
          Variance charts use Expected+Actual mapped digital lines only. Potential value variance
          shows N/A until unit value is mapped on the template.
        </p>
      </div>
    </AppShell>
  );
}
