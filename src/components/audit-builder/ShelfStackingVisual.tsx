import { cn } from "@/lib/utils";

type ShelfCell = {
  label: string;
  status: "expected" | "actual_match" | "wrong_sku" | "missing";
};

type Props = {
  expectedRows: number;
  expectedCols: number;
  expectedSku: string;
  actualCells: ShelfCell[];
  expectedTotal?: number;
  actualTotal?: number;
  wrongSkuCount?: number;
  compliancePct?: number;
  className?: string;
};

function cellClass(status: ShelfCell["status"]) {
  switch (status) {
    case "expected":
      return "border-brand/40 bg-brand-soft/30 text-brand";
    case "actual_match":
      return "border-success/40 bg-success/10 text-success";
    case "wrong_sku":
      return "border-destructive/40 bg-destructive/10 text-destructive";
    case "missing":
      return "border-dashed border-muted-foreground/30 bg-muted/20 text-muted-foreground";
  }
}

function ShelfGrid({
  title,
  rows,
  cols,
  cells,
}: {
  title: string;
  rows: number;
  cols: number;
  cells: ShelfCell[];
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: rows * cols }, (_, i) => {
          const cell = cells[i] ?? { label: "—", status: "missing" as const };
          return (
            <div
              key={i}
              className={cn(
                "flex h-8 items-center justify-center rounded border px-1 text-[0.6rem] font-medium truncate",
                cellClass(cell.status),
              )}
              title={cell.label}
            >
              {cell.label.slice(0, 8)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ShelfStackingVisual({
  expectedRows,
  expectedCols,
  expectedSku,
  actualCells,
  expectedTotal,
  actualTotal,
  wrongSkuCount,
  compliancePct,
  className,
}: Props) {
  const expectedCells: ShelfCell[] = Array.from({ length: expectedRows * expectedCols }, () => ({
    label: expectedSku,
    status: "expected",
  }));

  return (
    <div className={cn("space-y-4 rounded-xl border bg-muted/10 p-4", className)}>
      <div className="grid gap-6 md:grid-cols-2">
        <ShelfGrid title="Expected" rows={expectedRows} cols={expectedCols} cells={expectedCells} />
        <ShelfGrid title="Actual" rows={expectedRows} cols={expectedCols} cells={actualCells} />
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        {expectedTotal != null ? (
          <span>
            Expected: <strong>{expectedTotal}</strong>
          </span>
        ) : null}
        {actualTotal != null ? (
          <span>
            Actual visible: <strong>{actualTotal}</strong>
          </span>
        ) : null}
        {wrongSkuCount != null && wrongSkuCount > 0 ? (
          <span className="text-destructive">
            Wrong SKU: <strong>{wrongSkuCount}</strong>
          </span>
        ) : null}
        {compliancePct != null ? (
          <span>
            Stacking compliance: <strong>{compliancePct}%</strong>
          </span>
        ) : null}
      </div>
    </div>
  );
}
