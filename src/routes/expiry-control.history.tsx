import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { AppShell } from "@/components/AppShell";
import { ClassificationBadge } from "@/components/expiry-control/SeverityBadge";
import { EmptyState, Skeleton } from "@/components/States";
import { fetchHistory, INSPECTION_STATUS_LABEL, REMOVAL_STATUS_LABEL } from "@/lib/expiry-control";

export const Route = createFileRoute("/expiry-control/history")({
  head: () => ({ meta: [{ title: "Expiry History — Aislix" }] }),
  component: HistoryPage,
});

function HistoryPage() {
  const query = useQuery({ queryKey: ["expiry-history"], queryFn: fetchHistory, retry: false });

  return (
    <AppShell title="Expiry History" description="Historical inspections with immutable policy snapshots.">
      {query.isLoading && <Skeleton className="h-48" />}
      {query.data?.length === 0 && <EmptyState title="No history yet" />}
      <div className="overflow-x-auto rounded-2xl border">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3">SKU</th>
              <th className="p-3">Inspection</th>
              <th className="p-3">Removal</th>
              <th className="p-3">Disposition</th>
              <th className="p-3">Counts</th>
            </tr>
          </thead>
          <tbody>
            {(query.data ?? []).map((row) => (
              <tr key={row.id} className="border-b">
                <td className="p-3">{row.sku}</td>
                <td className="p-3">{INSPECTION_STATUS_LABEL[row.inspection_status]}</td>
                <td className="p-3">{REMOVAL_STATUS_LABEL[row.removal_status]}</td>
                <td className="p-3">{row.disposition_status.replace(/_/g, " ")}</td>
                <td className="p-3">
                  <span className="mr-2">
                    <ClassificationBadge value="sellable" /> {row.sellable_count}
                  </span>
                  <ClassificationBadge value="expired" /> {row.remove_count}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
