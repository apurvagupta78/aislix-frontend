import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { PlatformAdminGate } from "@/components/admin/PlatformAdminGate";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/States";
import { getPlatformAdminOverview } from "@/lib/platform-admin.functions";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Platform Admin — Aislix" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: AdminOverviewPage,
});

function AdminOverviewPage() {
  const fetchOverview = useServerFn(getPlatformAdminOverview);
  const query = useQuery({
    queryKey: ["platform-admin-overview"],
    queryFn: () => fetchOverview({ data: {} }),
    staleTime: 30_000,
  });

  return (
    <PlatformAdminGate>
      <AdminShell
        title="Overview"
        description="Cross-tenant snapshot of workspaces, users and shelf scans."
      >
        {query.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : query.isError ? (
          <ErrorState
            title="Could not load overview"
            description={query.error instanceof Error ? query.error.message : "Try again."}
            onRetry={() => void query.refetch()}
          />
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Organizations", value: query.data?.organizations ?? 0 },
                { label: "Users", value: query.data?.users ?? 0 },
                { label: "Stores", value: query.data?.stores ?? 0 },
                { label: "Shelf scans", value: query.data?.shelf_scans ?? 0 },
                { label: "Completed scans", value: query.data?.completed_scans ?? 0 },
                { label: "Failed scans", value: query.data?.failed_scans ?? 0 },
                { label: "Landing demo sessions", value: query.data?.landing_demo_sessions ?? 0 },
              ].map((stat) => (
                <Card key={stat.label} className="card-surface">
                  <CardContent className="p-5">
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="mt-1 text-2xl font-semibold">{stat.value.toLocaleString()}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild variant="brand" className="rounded-xl">
                <Link to="/admin/scans">
                  Browse all scans <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="rounded-xl">
                <Link to="/admin/users">View users</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-xl">
                <Link to="/admin/orgs">View organizations</Link>
              </Button>
            </div>
          </div>
        )}
      </AdminShell>
    </PlatformAdminGate>
  );
}
