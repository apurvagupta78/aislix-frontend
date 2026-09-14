import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Archive,
  ArchiveRestore,
  Clock,
  MapPin,
  Pencil,
  Phone,
  ScanLine,
  User,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorState, Skeleton } from "@/components/States";
import { OrgStat, StoreFormDialog, useStoreActions } from "@/components/org/OrgParts";
import {
  Panel,
  StoreHealthTrend,
  StoreRecentScans,
  StoreRecommendations,
  StoreReports,
  StoreTeamPanel,
} from "@/components/org/StoreDashboardParts";
import {
  fetchStore,
  fetchStoreMetrics,
  formatConfidence,
  formatDateTime,
  formatNumber,
  formatScore,
  storeLocation,
} from "@/lib/organization";

export const Route = createFileRoute("/stores/$storeId")({
  head: () => ({
    meta: [
      { title: "Store dashboard — Aislix shelf intelligence" },
      {
        name: "description",
        content:
          "Store-level shelf health trend, recent scans, inventory reports, AI recommendations and team access.",
      },
      { property: "og:title", content: "Store dashboard — Aislix" },
      {
        property: "og:description",
        content: "Shelf health, alerts and reports for a single retail location.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StoreDashboard,
});

function StoreDashboard() {
  const { storeId } = Route.useParams();
  const [editing, setEditing] = useState(false);
  const { archive } = useStoreActions();

  const storeQuery = useQuery({
    queryKey: ["store", storeId],
    queryFn: ({ signal }) => fetchStore(storeId, signal),
    retry: false,
  });

  const metricsQuery = useQuery({
    queryKey: ["store-metrics", storeId],
    queryFn: ({ signal }) => fetchStoreMetrics(storeId, signal),
    retry: false,
  });

  const store = storeQuery.data;
  const metrics = metricsQuery.data ?? store?.metrics;
  const archived = store?.status === "archived";

  return (
    <AppShell
      title={store?.name ?? "Store dashboard"}
      description={
        store ? [store.store_code, storeLocation(store)].filter(Boolean).join(" · ") : "Loading store…"
      }
      actions={
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="rounded-xl">
            <Link to="/stores">
              <ArrowLeft className="size-4" /> All stores
            </Link>
          </Button>
          <Button
            variant="subtle"
            size="sm"
            className="rounded-xl"
            disabled={!store}
            onClick={() => setEditing(true)}
          >
            <Pencil className="size-4" /> Edit
          </Button>
          <Button
            variant="subtle"
            size="sm"
            className="rounded-xl"
            disabled={!store || archive.isPending}
            onClick={() => store && archive.mutate(store)}
          >
            {archived ? (
              <>
                <ArchiveRestore className="size-4" /> Restore
              </>
            ) : (
              <>
                <Archive className="size-4" /> Archive
              </>
            )}
          </Button>
          <Button asChild variant="brand" size="sm" className="rounded-xl">
            <Link to="/scan">
              <ScanLine className="size-4" /> New scan
            </Link>
          </Button>
        </div>
      }
    >
      {storeQuery.isError ? (
        <ErrorState
          title="Couldn't load this store"
          description={
            storeQuery.error instanceof Error
              ? storeQuery.error.message
              : "The store service did not return this location."
          }
          onRetry={() => void storeQuery.refetch()}
        />
      ) : (
        <div className="space-y-5">
          <Panel title="Store details" description="Used across scans, reports and invoices.">
            {storeQuery.isPending ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : (
              <div className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <Detail icon={<MapPin className="size-4" />} label="Address">
                  {[store?.address, storeLocation(store ?? { id: "", name: "" })]
                    .filter(Boolean)
                    .join(", ") || "—"}
                </Detail>
                <Detail icon={<User className="size-4" />} label="Store manager">
                  {store?.manager_name || "—"}
                </Detail>
                <Detail icon={<Phone className="size-4" />} label="Contact">
                  {store?.contact_number || "—"}
                </Detail>
                <Detail icon={<Clock className="size-4" />} label="Time zone">
                  {store?.timezone || "—"}
                  {archived && (
                    <Badge variant="secondary" className="ml-2 rounded-md">
                      Archived
                    </Badge>
                  )}
                </Detail>
                {store?.latitude != null && store?.longitude != null ? (
                  <Detail icon={<MapPin className="size-4" />} label="Geofence pin">
                    {store.latitude.toFixed(5)}, {store.longitude.toFixed(5)}
                    {store.geofence_radius_m ? ` · ${store.geofence_radius_m}m radius` : ""}
                  </Detail>
                ) : null}
              </div>
            )}
          </Panel>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <OrgStat
              label="Shelf health score"
              value={formatScore(metrics?.shelf_health_score)}
              loading={metricsQuery.isPending}
              accent
            />
            <OrgStat
              label="Total scans"
              value={formatNumber(metrics?.total_scans)}
              loading={metricsQuery.isPending}
            />
            <OrgStat
              label="Avg AI confidence"
              value={formatConfidence(metrics?.average_confidence)}
              loading={metricsQuery.isPending}
            />
            <OrgStat
              label="Low stock alerts"
              value={formatNumber(metrics?.low_stock_alerts)}
              loading={metricsQuery.isPending}
            />
            <OrgStat
              label="Out of stock alerts"
              value={formatNumber(metrics?.out_of_stock_alerts)}
              loading={metricsQuery.isPending}
            />
            <OrgStat
              label="Last scan"
              value={formatDateTime(metrics?.last_scan_at)}
              loading={metricsQuery.isPending}
            />
          </div>

          <StoreHealthTrend storeId={storeId} />
          <StoreRecentScans storeId={storeId} />

          <div className="grid gap-5 xl:grid-cols-2">
            <StoreRecommendations storeId={storeId} />
            <StoreReports storeId={storeId} />
          </div>

          <StoreTeamPanel storeId={storeId} />
        </div>
      )}

      <StoreFormDialog open={editing} store={store ?? null} onOpenChange={setEditing} />
    </AppShell>
  );
}

function Detail({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-surface p-4">
      <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <span className="text-muted-foreground">{icon}</span>
        {label}
      </p>
      <p className="mt-1.5 break-words text-sm text-foreground">{children}</p>
    </div>
  );
}
