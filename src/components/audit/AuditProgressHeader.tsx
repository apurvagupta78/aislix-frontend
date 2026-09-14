import { Progress } from "@/components/ui/progress";
import { CollectionMethodBadge, SyncBadge } from "@/components/audit/AuditStatusBadges";

export function AuditProgressHeader({
  storeName,
  totalSkus,
  completedSkus,
  binsWithPhoto,
  totalBins,
  offline,
  pendingSync,
}: {
  storeName: string;
  totalSkus: number;
  completedSkus: number;
  binsWithPhoto: number;
  totalBins: number;
  offline?: boolean;
  pendingSync?: number;
}) {
  const skuPct = totalSkus > 0 ? Math.round((completedSkus / totalSkus) * 100) : 0;
  const photoPct = totalBins > 0 ? Math.round((binsWithPhoto / totalBins) * 100) : 0;

  return (
    <div className="sticky top-0 z-10 -mx-4 border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:-mx-0 sm:rounded-xl sm:border sm:px-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Executing audit
          </p>
          <p className="font-semibold">{storeName}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CollectionMethodBadge mode="digital" />
          {offline ? (
            <SyncBadge state="offline" pendingCount={pendingSync} />
          ) : pendingSync ? (
            <SyncBadge state="pending" pendingCount={pendingSync} />
          ) : null}
        </div>
      </div>
      <div className="mt-3 space-y-2">
        <div>
          <div className="mb-1 flex justify-between text-xs">
            <span>SKU counts</span>
            <span className="tabular-nums">
              {completedSkus}/{totalSkus} ({skuPct}%)
            </span>
          </div>
          <Progress value={skuPct} className="h-2" />
        </div>
        <div>
          <div className="mb-1 flex justify-between text-xs">
            <span>Bin photos</span>
            <span className="tabular-nums">
              {binsWithPhoto}/{totalBins} ({photoPct}%)
            </span>
          </div>
          <Progress value={photoPct} className="h-2" />
        </div>
      </div>
    </div>
  );
}
