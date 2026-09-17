import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Package, Search } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { SeverityBadge } from "@/components/audit/AuditStatusBadges";
import { MpFilterCard } from "@/components/design-system/MpFilterCard";
import { PageHeader } from "@/components/design-system/PageHeader";
import {
  MpTableShell,
  mpTableCellClassName,
  mpTableClassName,
  mpTableHeadClassName,
  mpTableRowClassName,
} from "@/components/design-system/MpTableShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState, Skeleton } from "@/components/States";
import { toUserMessage } from "@/lib/api/errors";
import { SkuHistoryPanel } from "@/components/sku/SkuHistoryPanel";
import { fetchSkuIntelligence, type SkuAggregate } from "@/lib/sku-intelligence";
import { useGlobalFilters } from "@/lib/global-filters";
import { isOrgManager } from "@/lib/assignments";

type SkuSearch = { sku?: string };

export const Route = createFileRoute("/sku-intelligence")({
  validateSearch: (search: Record<string, unknown>): SkuSearch => {
    if (typeof search.sku === "string" && search.sku.trim()) return { sku: search.sku.trim() };
    return {};
  },
  head: () => ({ meta: [{ title: "SKU & Shelf Intelligence — Aislix" }] }),
  component: SkuIntelligencePage,
});

function SkuIntelligencePage() {
  return (
    <AppShell title="" hidePageHeader>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Intelligence"
          title="SKUs & Shelf Intelligence"
          description="Cross-store variance, shortages, and recurrence — drill down to store, shelf, audit and evidence."
        />
        <SkuIntelligenceMain />
      </div>
    </AppShell>
  );
}

function SkuIntelligenceMain() {
  const { filters } = useGlobalFilters();
  const { sku: skuFromUrl } = Route.useSearch();
  const [search, setSearch] = useState(skuFromUrl ?? "");
  const [selected, setSelected] = useState<SkuAggregate | null>(null);

  const managerQuery = useQuery({
    queryKey: ["is-org-manager"],
    queryFn: () => isOrgManager(),
  });

  const query = useQuery({
    queryKey: ["sku-intelligence", filters.storeId, search],
    queryFn: () =>
      fetchSkuIntelligence({
        storeId: filters.storeId,
        search: search || undefined,
        days: 90,
      }),
    enabled: managerQuery.data === true,
  });

  const selectedSku = selected?.sku ?? skuFromUrl ?? null;

  if (!managerQuery.data && !managerQuery.isLoading) {
    return (
      <EmptyState title="Manager access required" description="Cross-store SKU intelligence is for managers." />
    );
  }

  return (
    <>
      <MpFilterCard>
        <div className="relative min-w-[240px] flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-mp-muted" />
          <Input
            className="rounded-lg border-line pl-9"
            placeholder="Search SKU, product name, barcode…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </MpFilterCard>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div>
          {query.isLoading ? (
            <Skeleton className="h-64 w-full rounded-xl" />
          ) : query.isError ? (
            <ErrorState description={toUserMessage(query.error)} onRetry={() => void query.refetch()} />
          ) : !query.data?.length ? (
            <EmptyState
              icon={<Package className="size-6" />}
              title="No SKU variances in this period"
              description="Digital audit line variances appear here once audits are submitted."
            />
          ) : (
            <MpTableShell title="SKU variances" description="90-day cross-store rollup">
              <table className={mpTableClassName()}>
                <thead className={mpTableHeadClassName()}>
                  <tr>
                    <th className="p-3">SKU / Product</th>
                    <th className="p-3">Stores</th>
                    <th className="p-3">Qty variance</th>
                    <th className="p-3">Signed value (₹)</th>
                    <th className="p-3">Severity</th>
                  </tr>
                </thead>
                <tbody>
                  {query.data.map((row) => (
                    <tr
                      key={row.sku}
                      className={`${mpTableRowClassName()} cursor-pointer ${selected?.sku === row.sku ? "bg-local-bg" : ""}`}
                      onClick={() => setSelected(row)}
                    >
                      <td className={mpTableCellClassName()}>
                        <p className="font-medium">{row.product_name}</p>
                        <p className="text-xs text-mp-muted">
                          {row.sku}
                          {row.barcode ? ` · ${row.barcode}` : ""}
                        </p>
                      </td>
                      <td className={`${mpTableCellClassName()} tabular-nums`}>{row.store_count}</td>
                      <td className={`${mpTableCellClassName()} tabular-nums`}>{row.total_variance_qty}</td>
                      <td className={`${mpTableCellClassName()} tabular-nums`}>
                        ₹{Math.abs(row.total_variance_value_inr).toLocaleString("en-IN")}
                      </td>
                      <td className={mpTableCellClassName()}>
                        <SeverityBadge tier={row.worst_tier} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </MpTableShell>
          )}
        </div>

        <aside className="overflow-hidden rounded-xl border border-line bg-white p-4 shadow-card lg:sticky lg:top-4 lg:self-start">
          {selected ? (
            <>
              <h3 className="font-display text-[15px] font-semibold text-navy">{selected.product_name}</h3>
              <p className="text-xs text-mp-muted">
                {selected.category ?? "Uncategorized"} · {selected.finding_count} finding(s) across{" "}
                {selected.store_count} store(s)
              </p>
              <div className="mt-4">
                <SkuHistoryPanel sku={selected.sku} />
              </div>
              <div className="mt-4 space-y-3">
                <Button asChild size="sm" variant="outline" className="rounded-xl">
                  <Link to="/findings">Open findings for this SKU</Link>
                </Button>
                {selected.stores.slice(0, 6).map((s, i) => (
                  <div key={`${s.store_id}-${i}`} className="rounded-lg border border-line bg-canvas p-3 text-xs">
                    <p className="font-medium text-navy">{s.store_name}</p>
                    <p className="text-mp-muted">
                      {s.shelf_label} · Expected {s.expected_qty} · Actual {s.actual_qty} · Δ
                      {s.variance_qty}
                    </p>
                    <p className="mt-1 tabular-nums">₹{s.variance_value_inr.toFixed(0)} potential value variance</p>
                    <Button asChild size="sm" variant="link" className="mt-1 h-auto p-0">
                      <Link to="/results" search={{ scan: s.scan_id }}>
                        Open audit & evidence →
                      </Link>
                    </Button>
                  </div>
                ))}
              </div>
            </>
          ) : selectedSku ? (
            <>
              <h3 className="font-semibold">{selectedSku}</h3>
              <SkuHistoryPanel sku={selectedSku} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Select a SKU to see historical variance, findings, RCA and corrective actions.
            </p>
          )}
        </aside>
      </div>
    </>
  );
}
