import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AnnotatedImageViewer } from "@/components/scan-results/ResultParts";
import {
  buildPositionComparisons,
  buildShelfExecutionSummary,
  STATUS_ACCENT,
  STATUS_PILL,
  type PositionComparisonRow,
} from "@/lib/planogram-comparison-display";
import {
  downloadComparisonCsv,
  downloadExceptionsCsv,
} from "@/lib/planogram-comparison-export";
import { planogramRowsFromResult } from "@/lib/execution-metrics";
import type { PlanogramComparison } from "@/lib/planogram-compliance";
import type { ScanResult } from "@/lib/scan-results";
import { cn } from "@/lib/utils";

function SummaryChip({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-lg border border-border/80 bg-card px-3 py-2 shadow-sm">
      <p className="text-lg font-semibold tabular-nums tracking-tight text-foreground">{value}</p>
      <p className="text-[10px] leading-snug text-muted-foreground">{label}</p>
    </div>
  );
}

function PositionDetail({ position }: { position: PositionComparisonRow }) {
  return (
    <div className="mt-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2.5 text-[11px]">
      <p className="font-semibold text-foreground">
        {position.row.brand} {position.row.product_name}
      </p>
      <dl className="mt-2 grid gap-1 sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Expected SKU</dt>
          <dd className="font-medium">{position.row.sku}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Observed SKU</dt>
          <dd className="font-medium">{position.observed_sku ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Expected facings</dt>
          <dd className="font-medium">{position.expected_facings}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Observed facings</dt>
          <dd className="font-medium">{position.observed_facings}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-muted-foreground">Status</dt>
          <dd className="font-medium">{position.status_short}</dd>
        </div>
        {position.status_detail ? (
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">Issue</dt>
            <dd>{position.status_detail}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}

function ExpectedPositionCard({
  position,
  selected,
  onSelect,
}: {
  position: PositionComparisonRow;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-lg border border-l-[3px] bg-card px-3 py-2.5 text-left text-xs shadow-sm transition-shadow hover:shadow-md",
        STATUS_ACCENT[position.status],
        selected && "ring-2 ring-brand/25",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-foreground">
          {position.row.brand} {position.row.product_name}
        </p>
        <Badge
          variant="secondary"
          className={cn("shrink-0 text-[9px] font-medium", STATUS_PILL[position.status])}
        >
          {position.status_short}
        </Badge>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Expected: {position.shelf_label} · {position.expected_facings} facing
        {position.expected_facings === 1 ? "" : "s"}
      </p>
      {position.status === "moved" && position.observed_location ? (
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          Observed: {position.observed_location}
        </p>
      ) : null}
      {selected ? <PositionDetail position={position} /> : null}
    </button>
  );
}

function ExpectedShelfGrid({
  positions,
  selectedId,
  onSelect,
}: {
  positions: PositionComparisonRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const shelves = useMemo(() => {
    const grouped = new Map<string, PositionComparisonRow[]>();
    for (const p of positions) {
      const list = grouped.get(p.shelf_key) ?? [];
      list.push(p);
      grouped.set(p.shelf_key, list);
    }
    return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));
  }, [positions]);

  if (!positions.length) {
    return (
      <div className="flex min-h-[240px] items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
        No expected shelf setup on this audit. Upload a planogram or assign from Store Master.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {shelves.map(([shelfKey, cells]) => (
        <div key={shelfKey} className="rounded-lg border border-border/60 bg-muted/20 p-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-foreground/70">
            {cells[0]?.shelf_label ?? shelfKey}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {cells.map((cell) => (
              <ExpectedPositionCard
                key={cell.position_id}
                position={cell}
                selected={selectedId === cell.position_id}
                onSelect={() => onSelect(cell.position_id)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function PlanogramSideBySidePanel({
  data,
  comparison,
  imageUrl,
  loading,
}: {
  data?: ScanResult | null;
  comparison?: PlanogramComparison | null;
  imageUrl?: string | null;
  loading?: boolean;
}) {
  const [selectedPositionId, setSelectedPositionId] = useState<string | null>(null);
  const rows = useMemo(() => planogramRowsFromResult(data), [data]);
  const positions = useMemo(
    () => (data ? buildPositionComparisons(data, comparison) : []),
    [data, comparison],
  );
  const summary = useMemo(() => buildShelfExecutionSummary(positions), [positions]);
  const selected = positions.find((p) => p.position_id === selectedPositionId) ?? null;
  const hasPlanogram = Boolean(data?.planogram?.requested) || rows.length > 0;

  if (!hasPlanogram) return null;

  return (
    <section id="audit-section-planogram" className="rounded-xl border border-border/70 bg-muted/30 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight sm:text-lg">
            Actual Shelf vs Expected Shelf
          </h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
            See what Aislix found on the shelf compared with the products and positions expected for
            this audit.
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Click a shelf position to see what was expected, what was found and whether it needs
            attention.
          </p>
        </div>
        {data ? (
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-lg text-xs"
              onClick={() => downloadComparisonCsv(data, comparison)}
            >
              <Download className="mr-1.5 size-3.5" />
              Download Comparison CSV
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-lg text-xs"
              onClick={() => downloadExceptionsCsv(data, comparison)}
            >
              <Download className="mr-1.5 size-3.5" />
              Download Exceptions CSV
            </Button>
          </div>
        ) : null}
      </div>

      <div className="mt-4 rounded-lg border border-border/60 bg-card px-4 py-3 shadow-sm">
        <p className="text-xs font-semibold tracking-tight text-foreground">Shelf Execution</p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          Aislix compared your shelf photo with the expected shelf setup.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <SummaryChip
            value={`${summary.matched} / ${summary.total}`}
            label="Expected positions matched"
          />
          <SummaryChip value={summary.placement_issues} label="Placement issues" />
          <SummaryChip value={summary.facing_deviations} label="Facing deviations" />
          <SummaryChip value={summary.needs_review} label="Needs review" />
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border/80 bg-card p-3 shadow-sm">
          <h3 className="text-sm font-semibold tracking-tight text-foreground">What Aislix Saw</h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Your shelf photo with detected products and issues highlighted.
          </p>
          <div className="mt-3">
            <AnnotatedImageViewer
              src={imageUrl ?? data?.annotated_image_url}
              originalSrc={data?.original_image_url}
              scanId={data?.scan_id}
              loading={loading}
              embedded
              downloadTooltip="Download Annotated Image"
              highlightLabel={
                selected
                  ? `Highlighting ${selected.position_id} · ${selected.status_short}`
                  : undefined
              }
            />
          </div>
        </div>

        <div className="rounded-lg border border-border/80 bg-card p-3 shadow-sm">
          <h3 className="text-sm font-semibold tracking-tight text-foreground">
            What Should Be There
          </h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            The expected products, positions and facings from your shelf setup.
          </p>
          <div className="mt-3 max-h-[32rem] overflow-y-auto pr-1">
            <ExpectedShelfGrid
              positions={positions}
              selectedId={selectedPositionId}
              onSelect={(id) => setSelectedPositionId((prev) => (prev === id ? null : id))}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
