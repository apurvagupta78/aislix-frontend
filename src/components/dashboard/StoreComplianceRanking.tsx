import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Store } from "lucide-react";
import { Skeleton, ErrorState } from "@/components/States";
import { Panel } from "@/components/dashboard/DashboardParts";
import { complianceTone } from "@/lib/planogram-compliance";
import { fetchStoreComplianceRanking, type StoreComplianceRow } from "@/lib/dashboard";

export function StoreComplianceRanking({ territoryId }: { territoryId?: string | null }) {
  const query = useQuery({
    queryKey: ["store-compliance-ranking", territoryId ?? "all"],
    queryFn: () => fetchStoreComplianceRanking("30d", territoryId ?? null),
    retry: false,
  });

  return (
    <Panel title="Store execution ranking" description="Avg planogram compliance by store (30 days)">
      {query.isPending ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState
          title="Couldn't load store ranking"
          description={(query.error as Error).message}
          onRetry={() => void query.refetch()}
        />
      ) : !query.data?.length ? (
        <p className="text-sm text-muted-foreground">No completed scans in the last 30 days.</p>
      ) : (
        <ul className="space-y-2">
          {query.data.map((row, index) => (
            <StoreRow key={row.store_id} row={row} rank={index + 1} />
          ))}
        </ul>
      )}
    </Panel>
  );
}

function StoreRow({ row, rank }: { row: StoreComplianceRow; rank: number }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-muted text-xs font-semibold">
          {rank}
        </span>
        <div className="min-w-0">
          <Link
            to="/stores/$storeId"
            params={{ storeId: row.store_id }}
            className="truncate font-medium hover:text-brand"
          >
            {row.store_name}
          </Link>
          {row.territory_name && (
            <p className="truncate text-xs text-muted-foreground">{row.territory_name}</p>
          )}
        </div>
      </div>
      <div className="text-right">
        <p className={`font-semibold tabular-nums ${complianceTone(row.avg_compliance)}`}>
          {row.avg_compliance !== null ? `${Math.round(row.avg_compliance)}%` : "—"}
        </p>
        <p className="text-xs text-muted-foreground">{row.scan_count} scans</p>
      </div>
    </li>
  );
}
