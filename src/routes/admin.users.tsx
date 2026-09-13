import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw, Search } from "lucide-react";
import { AdminPage } from "@/components/admin/AdminPage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/States";
import { listPlatformUsers } from "@/lib/platform-admin.functions";

export const Route = createFileRoute("/admin/users")({
  head: () => ({
    meta: [{ title: "Users — Platform Admin" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: AdminUsersPage,
});

function AdminUsersPage() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");

  const fetchUsers = useServerFn(listPlatformUsers);
  const query = useQuery({
    queryKey: ["platform-admin-users", page, q],
    queryFn: () => fetchUsers({ data: { page, pageSize: 25, q: q || undefined } }),
    staleTime: 15_000,
  });

  const totalPages = Math.max(1, Math.ceil((query.data?.total ?? 0) / 25));

  return (
    <AdminPage
      title="All users"
      description="Profiles, workspace memberships and audit counts by user id."
      actions={
        <Button variant="outline" size="sm" onClick={() => void query.refetch()} disabled={query.isFetching}>
          <RefreshCw className={`mr-2 size-4 ${query.isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      }
    >
        <div className="relative mb-4 max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search email, name or user id…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </div>

        {query.isLoading ? (
          <Skeleton className="h-96 w-full rounded-xl" />
        ) : query.isError ? (
          <ErrorState
            title="Could not load users"
            description={query.error instanceof Error ? query.error.message : "Try again."}
            onRetry={() => void query.refetch()}
          />
        ) : (
          <>
            <div className="overflow-hidden rounded-xl border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User ID</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Orgs</TableHead>
                    <TableHead>Audits</TableHead>
                    <TableHead>Onboarded</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(query.data?.rows ?? []).map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs">{row.id}</TableCell>
                      <TableCell>{row.email ?? "—"}</TableCell>
                      <TableCell>{row.full_name ?? "—"}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {new Date(row.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>{row.org_count}</TableCell>
                      <TableCell>
                        <Link
                          to="/admin/scans"
                          search={{ userId: row.id }}
                          className="font-medium text-brand hover:underline"
                        >
                          {row.scan_count}
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs">
                        {row.onboarding_completed_at ? "Yes" : "No"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="mt-4 flex items-center justify-between text-sm">
              <p className="text-muted-foreground">
                {query.data?.total ?? 0} users · page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
    </AdminPage>
  );
}
