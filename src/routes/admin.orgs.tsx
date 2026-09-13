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
import { listPlatformOrgs } from "@/lib/platform-admin.functions";

export const Route = createFileRoute("/admin/orgs")({
  head: () => ({
    meta: [{ title: "Organizations — Platform Admin" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: AdminOrgsPage,
});

function AdminOrgsPage() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");

  const fetchOrgs = useServerFn(listPlatformOrgs);
  const query = useQuery({
    queryKey: ["platform-admin-orgs", page, q],
    queryFn: () => fetchOrgs({ data: { page, pageSize: 25, q: q || undefined } }),
    staleTime: 15_000,
  });

  const totalPages = Math.max(1, Math.ceil((query.data?.total ?? 0) / 25));

  return (
    <AdminPage
      title="All organizations"
      description="Workspaces, plans, members, stores and audit volume."
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
            placeholder="Search org name or id…"
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
            title="Could not load organizations"
            description={query.error instanceof Error ? query.error.message : "Try again."}
            onRetry={() => void query.refetch()}
          />
        ) : (
          <>
            <div className="overflow-hidden rounded-xl border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organization</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Members</TableHead>
                    <TableHead>Stores</TableHead>
                    <TableHead>Audits</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(query.data?.rows ?? []).map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="font-medium">{row.name}</div>
                        <div className="font-mono text-[10px] text-muted-foreground">{row.id}</div>
                      </TableCell>
                      <TableCell className="text-xs">{row.owner_email ?? row.owner_id.slice(0, 8)}</TableCell>
                      <TableCell className="text-xs">
                        {row.plan_name ?? row.plan_code ?? "—"}
                        {row.scans_used != null ? ` · ${row.scans_used} used` : ""}
                      </TableCell>
                      <TableCell>{row.member_count}</TableCell>
                      <TableCell>{row.store_count}</TableCell>
                      <TableCell>
                        <Link
                          to="/admin/scans"
                          search={{ orgId: row.id }}
                          className="font-medium text-brand hover:underline"
                        >
                          {row.scan_count}
                        </Link>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {new Date(row.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="mt-4 flex items-center justify-between text-sm">
              <p className="text-muted-foreground">
                {query.data?.total ?? 0} organizations · page {page} of {totalPages}
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
