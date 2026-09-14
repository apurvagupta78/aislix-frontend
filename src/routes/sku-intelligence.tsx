import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Package, Search } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { SeverityBadge } from "@/components/audit/AuditStatusBadges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState, Skeleton } from "@/components/States";
import { toUserMessage } from "@/lib/api/errors";
import { fetchSkuIntelligence, type SkuAggregate } from "@/lib/sku-intelligence";
import { useGlobalFilters } from "@/lib/global-filters";
import { isOrgManager } from "@/lib/assignments";

export const Route = createFileRoute("/sku-intelligence")({
  head: () => ({ meta: [{ title: "SKU & Shelf Intelligence — Aislix" }] }),
  component: SkuIntelligencePage,
});

function SkuIntelligencePage() {
  return (
    <AppShell
      title="SKUs & Shelf Intelligence"
      description="Cross-store variance, shortages, and recurrence — drill down to store, shelf, audit and evidence."
    >
      <SkuIntelligenceMain />
    </AppShell>
  );
}

function SkuIntelligenceMain() {
  const { filters } = useGlobalFilters();
  const [search, setSearch] = useState("");
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

  if (!managerQuery.data && !managerQuery.isLoading) {
    return (
      <EmptyState title="Manager access required" description="Cross-store SKU intelligence is for managers." />
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-[240px] flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search SKU, product name, barcode…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

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
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
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
                      className={`cursor-pointer border-b border-border/60 hover:bg-surface/50 ${selected?.sku === row.sku ? "bg-brand-soft/30" : ""}`}
                      onClick={() => setSelected(row)}
                    >
                      <td className="p-3">
                        <p className="font-medium">{row.product_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {row.sku}
                          {row.barcode ? ` · ${row.barcode}` : ""}
                        </p>
                      </td>
                      <td className="p-3 tabular-nums">{row.store_count}</td>
                      <td className="p-3 tabular-nums">{row.total_variance_qty}</td>
                      <td className="p-3 tabular-nums">
                        ₹{Math.abs(row.total_variance_value_inr).toLocaleString("en-IN")}
                      </td>
                      <td className="p-3">
                        <SeverityBadge tier={row.worst_tier} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <aside className="rounded-xl border border-border bg-card p-4 lg:sticky lg:top-4 lg:self-start">
          {selected ? (
            <>
              <h3 className="font-semibold">{selected.product_name}</h3>
              <p className="text-xs text-muted-foreground">
                {selected.category ?? "Uncategorized"} · {selected.finding_count} finding(s) across{" "}
                {selected.store_count} store(s)
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Observed shelf variance — not store-wide inventory or confirmed financial loss.
              </p>
              <div className="mt-4 space-y-3">
                {selected.stores.slice(0, 8).map((s, i) => (
                  <div key={`${s.store_id}-${i}`} className="rounded-lg border border-border/60 p-3 text-xs">
                    <p className="font-medium">{s.store_name}</p>
                    <p className="text-muted-foreground">
                      {s.shelf_label} · Expected {s.expected_qty} · Actual {s.actual_qty} · Δ
                      {s.variance_qty}
                    </p>
                    <p className="mt-1 tabular-nums">₹{s.variance_value_inr.toFixed(0)} signed value</p>
                    <Button asChild size="sm" variant="link" className="mt-1 h-auto p-0">
                      <Link to="/audit-review/$scanId" params={{ scanId: s.scan_id }}>
                        Open audit & evidence →
                      </Link>
                    </Button>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Select a SKU to see store distribution, shelf locations, and linked audits.
            </p>
          )}
        </aside>
      </div>
    </>
  );
}
