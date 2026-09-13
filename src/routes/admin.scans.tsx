import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, ExternalLink, ImageIcon, RefreshCw, Search } from "lucide-react";
import { AdminPage } from "@/components/admin/AdminPage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/States";
import {
  getPlatformScanDetail,
  listPlatformScans,
  type PlatformScanRow,
} from "@/lib/platform-admin.functions";

export const Route = createFileRoute("/admin/scans")({
  validateSearch: (search: Record<string, unknown>) => ({
    userId: typeof search.userId === "string" ? search.userId : undefined,
    orgId: typeof search.orgId === "string" ? search.orgId : undefined,
  }),
  head: () => ({
    meta: [{ title: "All Scans â€” Platform Admin" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: AdminScansPage,
});

function statusVariant(status: string) {
  if (status === "completed") return "default" as const;
  if (status === "failed") return "destructive" as const;
  return "secondary" as const;
}

function AdminScansPage() {
  const { userId, orgId } = Route.useSearch();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<PlatformScanRow | null>(null);

  const fetchScans = useServerFn(listPlatformScans);
  const fetchDetail = useServerFn(getPlatformScanDetail);

  const query = useQuery({
    queryKey: ["platform-admin-scans", page, q, status, userId, orgId],
    queryFn: () =>
      fetchScans({
        data: { page, pageSize: 25, q: q || undefined, status, userId, orgId },
      }),
    staleTime: 15_000,
  });

  const detailQuery = useQuery({
    queryKey: ["platform-admin-scan-detail", selected?.id],
    queryFn: () => fetchDetail({ data: { scanId: selected!.id } }),
    enabled: Boolean(selected?.id),
  });

  const totalPages = Math.max(1, Math.ceil((query.data?.total ?? 0) / 25));

  return (
    <AdminPage
      title="All shelf scans"
      description="Every workspace scan with user id, org, store, uploaded photos and full results."
      actions={
        <Button variant="outline" size="sm" onClick={() => void query.refetch()} disabled={query.isFetching}>
          <RefreshCw className={`mr-2 size-4 ${query.isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      }
    >
        <div className="mb-4 flex flex-wrap gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search scan id, category, shelfâ€¦"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="queued">Queued</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {(userId || orgId) && (
          <p className="mb-3 text-xs text-muted-foreground">
            Filtered by {userId ? `user ${userId}` : ""}
            {userId && orgId ? " Â· " : ""}
            {orgId ? `org ${orgId}` : ""}
          </p>
        )}

        {query.isLoading ? (
          <Skeleton className="h-96 w-full rounded-xl" />
        ) : query.isError ? (
          <ErrorState
            title="Could not load scans"
            description={query.error instanceof Error ? query.error.message : "Try again."}
            onRetry={() => void query.refetch()}
          />
        ) : (
          <>
            <div className="overflow-hidden rounded-xl border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Photo</TableHead>
                    <TableHead>When</TableHead>
                    <TableHead>Scan ID</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Org</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Products</TableHead>
                    <TableHead>Health</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(query.data?.rows ?? []).map((row) => (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer"
                      onClick={() => setSelected(row)}
                    >
                      <TableCell>
                        {row.preview_image_url ? (
                          <img
                            src={row.preview_image_url}
                            alt=""
                            className="size-12 rounded-md object-cover"
                          />
                        ) : (
                          <span className="grid size-12 place-items-center rounded-md bg-muted text-muted-foreground">
                            <ImageIcon className="size-4" />
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {new Date(row.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{row.id.slice(0, 8)}â€¦</TableCell>
                      <TableCell className="max-w-[140px] truncate text-xs">
                        <div>{row.user_email ?? "â€”"}</div>
                        <div className="font-mono text-[10px] text-muted-foreground">
                          {row.created_by?.slice(0, 8) ?? "â€”"}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[120px] truncate text-xs">
                        {row.org_name ?? row.org_id.slice(0, 8)}
                      </TableCell>
                      <TableCell className="max-w-[140px] truncate text-xs">
                        {[row.category, row.sub_category].filter(Boolean).join(" Â· ") || "â€”"}
                      </TableCell>
                      <TableCell>{row.total_products}</TableCell>
                      <TableCell>
                        {row.shelf_health_score != null ? `${Math.round(row.shelf_health_score)}%` : "â€”"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="mt-4 flex items-center justify-between text-sm">
              <p className="text-muted-foreground">
                {query.data?.total ?? 0} scans Â· page {page} of {totalPages}
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

        <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
          <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Scan {selected?.id.slice(0, 8)}â€¦</DialogTitle>
            </DialogHeader>
            {selected ? (
              <div className="space-y-4 text-sm">
                <div className="grid gap-2 sm:grid-cols-2">
                  <p>
                    <span className="text-muted-foreground">User:</span> {selected.user_email ?? "â€”"}
                  </p>
                  <p>
                    <span className="text-muted-foreground">User ID:</span>{" "}
                    <code className="text-xs">{selected.created_by ?? "â€”"}</code>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Org:</span> {selected.org_name ?? selected.org_id}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Store:</span> {selected.store_name ?? "â€”"}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Status:</span> {selected.status}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Products:</span> {selected.total_products}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="brand">
                    <Link to="/results" search={{ scan: selected.id }}>
                      Open full results <ExternalLink className="size-4" />
                    </Link>
                  </Button>
                  {selected.created_by ? (
                    <Button asChild size="sm" variant="outline">
                      <Link to="/admin/scans" search={{ userId: selected.created_by }}>
                        More from this user
                      </Link>
                    </Button>
                  ) : null}
                </div>

                {detailQuery.isLoading ? (
                  <Skeleton className="h-40 w-full" />
                ) : detailQuery.data ? (
                  <>
                    {(detailQuery.data.assets.annotated_image_url ||
                      detailQuery.data.assets.original_image_url) && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {detailQuery.data.assets.annotated_image_url ? (
                          <div>
                            <p className="mb-1 text-xs font-medium text-muted-foreground">
                              Annotated shelf photo
                            </p>
                            <a
                              href={detailQuery.data.assets.annotated_image_url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <img
                                src={detailQuery.data.assets.annotated_image_url}
                                alt="Annotated shelf"
                                className="max-h-64 w-full rounded-lg border border-border object-contain bg-muted"
                              />
                            </a>
                          </div>
                        ) : null}
                        {detailQuery.data.assets.original_image_url ? (
                          <div>
                            <p className="mb-1 text-xs font-medium text-muted-foreground">
                              Original shelf photo
                            </p>
                            <a
                              href={detailQuery.data.assets.original_image_url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <img
                                src={detailQuery.data.assets.original_image_url}
                                alt="Original shelf"
                                className="max-h-64 w-full rounded-lg border border-border object-contain bg-muted"
                              />
                            </a>
                          </div>
                        ) : null}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {detailQuery.data.assets.pdf_url ? (
                        <Button asChild size="sm" variant="outline">
                          <a href={detailQuery.data.assets.pdf_url} target="_blank" rel="noreferrer">
                            <Download className="size-4" /> PDF report
                          </a>
                        </Button>
                      ) : null}
                      {detailQuery.data.assets.csv_url ? (
                        <Button asChild size="sm" variant="outline">
                          <a href={detailQuery.data.assets.csv_url} target="_blank" rel="noreferrer">
                            <Download className="size-4" /> CSV export
                          </a>
                        </Button>
                      ) : null}
                    </div>

                    {detailQuery.data.scan_result?.metrics ? (
                      <details className="rounded-lg border border-border p-3" open>
                        <summary className="cursor-pointer text-xs font-medium">Scan metrics</summary>
                        <pre className="mt-2 max-h-48 overflow-auto text-[10px]">
                          {JSON.stringify(detailQuery.data.scan_result.metrics, null, 2)}
                        </pre>
                      </details>
                    ) : null}

                    {detailQuery.data.scan_result?.executive_summary ? (
                      <div className="rounded-lg border border-border p-3">
                        <p className="text-xs font-medium text-muted-foreground">Executive summary</p>
                        <p className="mt-1 whitespace-pre-wrap">{detailQuery.data.scan_result.executive_summary}</p>
                      </div>
                    ) : null}

                    <div>
                      <p className="mb-2 font-medium">
                        Detected products ({detailQuery.data.detected_products.length})
                      </p>
                      <div className="max-h-56 overflow-auto rounded-lg border border-border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Brand</TableHead>
                              <TableHead>Product</TableHead>
                              <TableHead>Facings</TableHead>
                              <TableHead>Conf.</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {detailQuery.data.detected_products.map((p) => (
                              <TableRow key={p.id}>
                                <TableCell>{p.brand ?? "â€”"}</TableCell>
                                <TableCell>
                                  {p.name}
                                  {p.variant ? ` Â· ${p.variant}` : ""}
                                </TableCell>
                                <TableCell>{p.facings}</TableCell>
                                <TableCell>
                                  {p.confidence != null ? `${Math.round(p.confidence * 100)}%` : "â€”"}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>

                    {detailQuery.data.scan_result?.brand_share?.length ? (
                      <details className="rounded-lg border border-border p-3">
                        <summary className="cursor-pointer text-xs font-medium">Brand share</summary>
                        <pre className="mt-2 max-h-48 overflow-auto text-[10px]">
                          {JSON.stringify(detailQuery.data.scan_result.brand_share, null, 2)}
                        </pre>
                      </details>
                    ) : null}

                    {detailQuery.data.scan_result?.alerts?.length ? (
                      <details className="rounded-lg border border-border p-3">
                        <summary className="cursor-pointer text-xs font-medium">Alerts</summary>
                        <pre className="mt-2 max-h-48 overflow-auto text-[10px]">
                          {JSON.stringify(detailQuery.data.scan_result.alerts, null, 2)}
                        </pre>
                      </details>
                    ) : null}

                    {detailQuery.data.scan_result?.recommendations?.length ? (
                      <details className="rounded-lg border border-border p-3">
                        <summary className="cursor-pointer text-xs font-medium">Recommendations</summary>
                        <pre className="mt-2 max-h-48 overflow-auto text-[10px]">
                          {JSON.stringify(detailQuery.data.scan_result.recommendations, null, 2)}
                        </pre>
                      </details>
                    ) : null}

                    {detailQuery.data.scan_result?.raw_payload ? (
                      <details className="rounded-lg border border-border p-3">
                        <summary className="cursor-pointer text-xs font-medium">Raw AI payload (JSON)</summary>
                        <pre className="mt-2 max-h-64 overflow-auto text-[10px]">
                          {JSON.stringify(detailQuery.data.scan_result.raw_payload, null, 2)}
                        </pre>
                      </details>
                    ) : null}
                  </>
                ) : null}
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
    </AdminPage>
  );
}
