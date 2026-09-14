import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Image as ImageIcon, RefreshCw } from "lucide-react";
import { AdminPage } from "@/components/admin/AdminPage";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState } from "@/components/States";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listLandingDemoScans } from "@/lib/landing-demo-admin.functions";

export const Route = createFileRoute("/admin/demo-scans")({
  head: () => ({
    meta: [{ title: "Demo Audits — Platform Admin" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: AdminDemoScansPage,
});

function statusTone(status: string | null) {
  if (status === "completed") return "default" as const;
  if (status === "processing") return "secondary" as const;
  return "destructive" as const;
}

function AdminDemoScansPage() {
  const [days, setDays] = useState("7");
  const fetchScans = useServerFn(listLandingDemoScans);
  const query = useQuery({
    queryKey: ["landing-demo-scans", days],
    queryFn: () => fetchScans({ data: { days: Number(days) } }),
    staleTime: 30_000,
  });

  return (
    <AdminPage
      title="Landing demo audits"
      description="Anonymous homepage and campaign audits — photos, status and UTM attribution."
      actions={
        <div className="flex items-center gap-2">
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Last 24 hours</SelectItem>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="180">Last 6 months</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => void query.refetch()} disabled={query.isFetching}>
            <RefreshCw className={`mr-2 size-4 ${query.isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      }
    >
        {query.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-72 w-full rounded-xl" />
            ))}
          </div>
        ) : query.isError ? (
          <ErrorState
            title="Could not load demo audits"
            description={query.error instanceof Error ? query.error.message : "Please try again."}
            onRetry={() => void query.refetch()}
          />
        ) : !query.data || query.data.rows.length === 0 ? (
          <EmptyState
            icon={<ImageIcon className="size-5" />}
            title="No demo audits in this period"
            description="Anonymous audits from landing pages will appear here."
          />
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Audit attempts", value: query.data.totals.attempts },
                { label: "Completed", value: query.data.totals.completed },
                { label: "Photo uploads", value: query.data.totals.uploads },
                { label: "Images stored", value: query.data.totals.withImage },
              ].map((stat) => (
                <Card key={stat.label} className="card-surface">
                  <CardContent className="p-5">
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="mt-1 text-2xl font-semibold">{stat.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {query.data.rows.map((row) => (
                <Card key={row.id} className="card-surface overflow-hidden">
                  {row.image_url ? (
                    <a href={row.image_url} target="_blank" rel="noreferrer">
                      <img
                        src={row.image_url}
                        alt={`Shelf photo uploaded on ${new Date(row.created_at).toLocaleString()}`}
                        loading="lazy"
                        className="h-48 w-full bg-muted object-cover"
                      />
                    </a>
                  ) : (
                    <div className="flex h-48 w-full flex-col items-center justify-center gap-2 bg-muted text-muted-foreground">
                      <ImageIcon className="size-6" />
                      <span className="text-xs">No stored photo</span>
                    </div>
                  )}
                  <CardContent className="space-y-2 p-4 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{new Date(row.created_at).toLocaleString()}</span>
                      <Badge variant={statusTone(row.scan_status)}>{row.scan_status ?? "unknown"}</Badge>
                    </div>
                    <p className="font-mono text-[10px] text-muted-foreground">{row.id}</p>
                    {row.lead_email ? <p className="text-muted-foreground">Lead: {row.lead_email}</p> : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
    </AdminPage>
  );
}
