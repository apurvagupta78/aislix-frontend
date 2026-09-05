export type BrandShareRow = { brand: string; share: number };

/**
 * Compact "Top brands by shelf share" ranked list, matching the dashboard
 * chart's title/description and facings-weighted share values.
 */
export function TopBrandsByShelfShare({
  rows,
  limit = 8,
  className,
}: {
  rows: BrandShareRow[] | undefined;
  limit?: number;
  className?: string;
}) {
  const data = (rows ?? [])
    .filter((r) => r.brand && Number.isFinite(r.share) && r.share > 0)
    .sort((a, b) => b.share - a.share)
    .slice(0, limit);
  if (data.length === 0) return null;
  const max = data[0]!.share || 1;

  return (
    <div className={className}>
      <p className="text-sm font-semibold text-foreground">Top brands by shelf share</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">Share of visible facings per brand.</p>
      <ul className="mt-3 space-y-2">
        {data.map((row) => (
          <li key={row.brand} className="grid grid-cols-[7rem_1fr_3rem] items-center gap-2">
            <span className="truncate text-xs text-foreground" title={row.brand}>
              {row.brand}
            </span>
            <span className="h-2 rounded-full bg-muted">
              <span
                className="block h-2 rounded-full bg-brand"
                style={{ width: `${Math.max(4, (row.share / max) * 100)}%` }}
              />
            </span>
            <span className="text-right text-xs tabular-nums text-muted-foreground">
              {row.share.toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
