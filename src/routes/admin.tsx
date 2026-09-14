import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight } from "lucide-react";
import { AdminPage } from "@/components/admin/AdminPage";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/States";
import {
  getPlatformAdminOverview,
  listPlatformScans,
  listPlatformUsers,
} from "@/lib/platform-admin.functions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Platform Admin — Aislix" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: AdminOverviewPage,
});

function AdminOverviewPage() {
  const fetchOverview = useServerFn(getPlatformAdminOverview);
  const fetchScans = useServerFn(listPlatformScans);
  const fetchUsers = useServerFn(listPlatformUsers);

  const query = useQuery({
    queryKey: ["platform-admin-overview"],
    queryFn: () => fetchOverview(),
    staleTime: 30_000,
  });
  const recentScans = useQuery({
    queryKey: ["platform-admin-recent-scans"],
    queryFn: () => fetchScans({ data: { page: 1, pageSize: 8 } }),
    staleTime: 30_000,
  });
  const recentUsers = useQuery({
    queryKey: ["platform-admin-recent-users"],
    queryFn: () => fetchUsers({ data: { page: 1, pageSize: 8 } }),
    staleTime: 30_000,
  });

  return (
    <AdminPage
      title="Overview"
      description="Cross-tenant snapshot of workspaces, users and shelf audits."
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
              { label: "Shelf audits", value: query.data?.shelf_scans ?? 0 },
              { label: "Completed audits", value: query.data?.completed_scans ?? 0 },
              { label: "Failed audits", value: query.data?.failed_scans ?? 0 },
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
              <Link to="/admin/scans" search={{}}>
                Browse all audits <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="rounded-xl">
              <Link to="/admin/users">View users</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-xl">
              <Link to="/admin/orgs">View organizations</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-xl">
              <Link to="/admin/demo-scans">Demo sessions</Link>
            </Button>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="overflow-hidden rounded-xl border border-border">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <p className="text-sm font-semibold">Recent audits</p>
                <Link to="/admin/scans" search={{}} className="text-xs text-brand hover:underline">
                  View all
                </Link>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Products</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(recentScans.data?.rows ?? []).map((row) => (
                    <TableRow key={row.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell className="text-xs">
                        <Link to="/admin/scans" search={{}} className="block">
                          {new Date(row.created_at).toLocaleString()}
                        </Link>
                      </TableCell>
                      <TableCell className="max-w-[120px] truncate text-xs">
                        {row.user_email ?? row.created_by?.slice(0, 8) ?? "—"}
                      </TableCell>
                      <TableCell>{row.total_products}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="overflow-hidden rounded-xl border border-border">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <p className="text-sm font-semibold">Recent users</p>
                <Link to="/admin/users" className="text-xs text-brand hover:underline">
                  View all
                </Link>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Audits</TableHead>
                    <TableHead>Orgs</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(recentUsers.data?.rows ?? []).map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="max-w-[160px] truncate text-xs">
                        {row.email ?? row.id.slice(0, 8)}
                      </TableCell>
                      <TableCell>{row.scan_count}</TableCell>
                      <TableCell>{row.org_count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}
    </AdminPage>
  );
}
