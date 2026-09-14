import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton } from "@/components/States";
import { fetchMyInspections, INSPECTION_STATUS_LABEL } from "@/lib/expiry-control";

export const Route = createFileRoute("/expiry-control/my-inspections")({
  head: () => ({ meta: [{ title: "My Inspections — Expiry Control" }] }),
  component: MyInspectionsPage,
});

function MyInspectionsPage() {
  const query = useQuery({ queryKey: ["expiry-my"], queryFn: fetchMyInspections, retry: false });

  return (
    <AppShell title="My Inspections" description="Assigned expiry inspections — mobile-first execution.">
      {query.isLoading && <Skeleton className="h-48" />}
      {query.isError && <ErrorState description="Could not load inspections." />}
      {query.data?.length === 0 && (
        <EmptyState title="No assigned inspections" description="Check back when a manager assigns an expiry inspection." />
      )}
      <div className="mx-auto max-w-lg space-y-3">
        {(query.data ?? []).map((row) => (
          <div key={row.id} className="rounded-2xl border p-4">
            <p className="font-medium">{row.product_name || row.sku || "Inspection"}</p>
            <p className="text-sm text-muted-foreground">{INSPECTION_STATUS_LABEL[row.inspection_status]}</p>
            <Button className="mt-3 w-full" asChild>
              <Link to="/expiry-control/inspect/$attemptId" params={{ attemptId: row.id }}>
                {row.inspection_status === "in_progress" ? "Continue" : "Start inspection"}
              </Link>
            </Button>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
