import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Image as ImageIcon, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/AppShell";
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

export const Route = createFileRoute("/demo-scans")({
  component: DemoScansPage,
  head: () => ({
    meta: [
      { title: "Campaign Demo Scans — Aislix" },
      {
        name: "description",
        content:
          "Platform admin view of anonymous landing page shelf scans: uploaded photos, sample runs, scan status and campaign attribution.",
      },
      { property: "og:title", content: "Campaign demo scans — Aislix" },
      {
        property: "og:description",
        content: "Review every anonymous shelf scan captured from the Aislix LinkedIn campaign landing pages.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function statusTone(status: string | null) {
  if (status === "completed") return "default" as const;
  if (status === "processing") return "secondary" as const;
  return "destructive" as const;
}

function DemoScansPage() {
  const [days, setDays] = useState("7");
  const [sort, setSort] = useState("newest");
  const fetchScans = useServerFn(listLandingDemoScans);
  const query = useQuery({
    queryKey: ["landing-demo-scans", days],
    queryFn: () => fetchScans({ data: { days: Number(days) } }),
    staleTime: 30_000,
  });

  const sortedRows = (query.data?.rows ?? [])
    .slice()
    .sort((a, b) =>
      sort === "oldest"
        ? new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        : new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

  return (
    <AppShell
      title="Campaign demo scans"
      description="Every anonymous shelf scan from the homepage and LinkedIn landing pages, with the uploaded photo where available."
      actions={
        <div className="flex items-center gap-2">
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Last 24 hours</SelectItem>
              <SelectItem value="2">Last 2 days</SelectItem>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="180">Last 6 months</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="w-40" aria-label="Sort by date">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="oldest">Oldest first</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}>
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
          title="Could not load demo scans"
          description={query.error instanceof Error ? query.error.message : "Please try again."}
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : !query.data || query.data.rows.length === 0 ? (
        <EmptyState
          icon={<ImageIcon className="size-5" />}
          title="No demo scans in this period"
          description="Anonymous scans from the campaign landing pages will appear here as visitors try the live demo."
        />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Scan attempts", value: query.data.totals.attempts },
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
            {sortedRows.map((row) => (
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
                    <span className="text-xs">
                      {row.source === "sample" ? `Sample scan${row.sample_id ? ` · ${row.sample_id}` : ""}` : "No stored photo"}
                    </span>
                  </div>
                )}
                <CardContent className="space-y-2 p-4 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{new Date(row.created_at).toLocaleString()}</span>
                    <Badge variant={statusTone(row.scan_status)}>{row.scan_status ?? "unknown"}</Badge>
                  </div>
                  <p className="text-muted-foreground">
                    {row.source === "uploaded" ? "Visitor upload" : "Sample shelf"}
                    {row.products != null ? ` · ${row.products} products` : ""}
                    {row.shelf_health != null ? ` · ${Math.round(row.shelf_health)}% shelf health` : ""}
                  </p>
                  {row.lead_email ? <p className="text-muted-foreground">Lead: {row.lead_email}</p> : null}
                  {row.utm_source || row.utm_campaign ? (
                    <p className="text-xs text-muted-foreground">
                      {[row.utm_source, row.utm_campaign].filter(Boolean).join(" · ")}
                    </p>
                  ) : null}
                  {row.scan_error ? <p className="text-xs text-destructive">{row.scan_error}</p> : null}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </AppShell>
  );
}
