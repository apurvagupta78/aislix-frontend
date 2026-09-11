import { useMemo } from "react";
import { Columns2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AnnotatedImageViewer } from "@/components/scan-results/ResultParts";
import { ResultSection } from "@/components/scan-results/ResultParts";
import { issueBadgeClass, issueLabel, normalizeIssueType, type PlanogramComparison } from "@/lib/planogram-compliance";
import { planogramRowsFromResult } from "@/lib/execution-metrics";
import type { PlanogramRow } from "@/lib/planogram";
import type { ScanResult } from "@/lib/scan-results";
import { cn } from "@/lib/utils";

type GridCell = {
  key: string;
  row: PlanogramRow;
  issue?: string;
};

function shelfRowKey(row: PlanogramRow): string {
  const level = String(row.expected_shelf_level ?? "").trim();
  if (level) return level;
  const pos = String(row.shelf_position ?? row.expected_position ?? "").trim();
  if (!pos) return "Shelf";
  const match = pos.match(/^([A-Za-z]+)/);
  return match?.[1]?.toUpperCase() ?? "Shelf";
}

function shelfColKey(row: PlanogramRow): string {
  const pos = String(row.shelf_position ?? row.expected_position ?? "").trim();
  const match = pos.match(/(\d+)\s*$/);
  if (match) return match[1]!;
  return pos || row.sku || row.product_name;
}

function expectedFacings(row: PlanogramRow): number {
  if (row.expected_facings != null && Number.isFinite(Number(row.expected_facings))) {
    return Number(row.expected_facings);
  }
  const qty = Number(row.expected_qty);
  return Number.isFinite(qty) ? qty : 1;
}

function buildIssueMap(comparison?: PlanogramComparison | null): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of comparison?.lines ?? []) {
    if (normalizeIssueType(line.issue_type) === "ok") continue;
    const key = (line.expected_product ?? "").trim().toLowerCase();
    if (key) map.set(key, line.issue_type);
  }
  return map;
}

function ExpectedPlanogramGrid({
  rows,
  issueMap,
}: {
  rows: PlanogramRow[];
  issueMap: Map<string, string>;
}) {
  const shelves = useMemo(() => {
    const grouped = new Map<string, GridCell[]>();
    for (const row of rows) {
      const shelf = shelfRowKey(row);
      const list = grouped.get(shelf) ?? [];
      list.push({
        key: row.sku || row.match_key || `${row.brand}-${row.product_name}`,
        row,
        issue: issueMap.get(row.product_name.trim().toLowerCase()),
      });
      grouped.set(shelf, list);
    }
    for (const list of grouped.values()) {
      list.sort((a, b) => shelfColKey(a.row).localeCompare(shelfColKey(b.row), undefined, { numeric: true }));
    }
    return Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [rows, issueMap]);

  if (!rows.length) {
    return (
      <div className="flex h-full min-h-[240px] items-center justify-center rounded-xl border border-dashed border-border bg-surface p-6 text-center text-sm text-muted-foreground">
        No expected planogram rows on this scan. Upload a planogram or assign from Store Master.
      </div>
    );
  }

  return (
    <div className="space-y-3 overflow-y-auto pr-1">
      {shelves.map(([shelf, cells]) => (
        <div key={shelf} className="rounded-xl border border-brand/15 bg-brand-soft/20 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand">{shelf}</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {cells.map((cell) => {
              const issue = cell.issue ? normalizeIssueType(cell.issue) : "ok";
              return (
                <div
                  key={cell.key}
                  className={cn(
                    "rounded-lg border bg-card px-3 py-2 text-xs shadow-sm",
                    issue === "ok" ? "border-border" : "border-warning/30",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-foreground">{cell.row.product_name}</p>
                    {issue !== "ok" ? (
                      <Badge variant="outline" className={cn("shrink-0 rounded-full text-[10px]", issueBadgeClass(issue))}>
                        {issueLabel(issue)}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-muted-foreground">{cell.row.brand}</p>
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                    {cell.row.shelf_position || cell.row.expected_position || "—"} · {expectedFacings(cell.row)} facing
                    {expectedFacings(cell.row) === 1 ? "" : "s"}
                  </p>
                </div>
              );
            })}
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
  const rows = useMemo(() => planogramRowsFromResult(data), [data]);
  const issueMap = useMemo(() => buildIssueMap(comparison), [comparison]);
  const hasPlanogram = Boolean(data?.planogram?.requested) || rows.length > 0;

  if (!hasPlanogram) return null;

  return (
    <ResultSection
      title="Planogram vs shelf photo"
      description="Compare the expected shelf layout against what the AI detected in your photo."
      actions={
        <Badge variant="outline" className="rounded-full border-brand/25 bg-brand-soft/50 text-brand">
          <Columns2 className="size-3.5" /> Side by side
        </Badge>
      }
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="min-h-[280px] rounded-xl border border-border bg-surface p-2">
          <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Actual shelf (annotated)
          </p>
          <AnnotatedImageViewer
            src={imageUrl ?? data?.annotated_image_url}
            originalSrc={data?.original_image_url}
            scanId={data?.scan_id}
            loading={loading}
          />
        </div>
        <div className="min-h-[280px] rounded-xl border border-border bg-surface p-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Expected planogram
          </p>
          <ExpectedPlanogramGrid rows={rows} issueMap={issueMap} />
        </div>
      </div>
    </ResultSection>
  );
}
