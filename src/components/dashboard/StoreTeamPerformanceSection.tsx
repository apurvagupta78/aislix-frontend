import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Download,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EmptyState } from "@/components/States";
import { KPI_DASHBOARD_LABELS } from "@/lib/dashboard-config";
import type { WorkspaceDashboardData } from "@/lib/dashboard-intelligence";
import type { DashboardFilterState } from "@/lib/dashboard-filters";
import {
  exportPerformanceRankingsCsv,
  type PerformanceRankDimension,
  type PerformanceRankRow,
} from "@/lib/store-team-performance";
import type { AuditKpiId } from "@/lib/role-kpi-config";
import { cn } from "@/lib/utils";

type PerformanceMode = "best" | "attention";

const DIMENSION_OPTIONS: { value: PerformanceRankDimension; label: string }[] = [
  { value: "store", label: "Store" },
  { value: "city", label: "City" },
  { value: "country", label: "Country" },
  { value: "category", label: "Category" },
  { value: "sub_category", label: "Sub-category" },
  { value: "team_member", label: "Team Member" },
];

function sortRows(rows: PerformanceRankRow[], mode: PerformanceMode, reverse: boolean): PerformanceRankRow[] {
  const sorted = [...rows].sort((a, b) => {
    const av = a.performance_score ?? -1;
    const bv = b.performance_score ?? -1;
    if (mode === "best") return reverse ? av - bv : bv - av;
    return reverse ? bv - av : av - bv;
  });
  return sorted;
}

function changeLabel(change: number | null): string | null {
  if (change === null) return null;
  return `${change >= 0 ? "+" : ""}${change} pts`;
}

function SummaryCard({
  label,
  row,
}: {
  label: string;
  row: PerformanceRankRow | null;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card px-3.5 py-3 shadow-sm">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      {row ? (
        <>
          <p className="mt-1 truncate text-sm font-semibold text-foreground">{row.name}</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-brand">
            {row.performance_score !== null ? `${row.performance_score}` : "Not enough data"}
            {row.performance_score !== null ? (
              <span className="text-xs font-normal text-muted-foreground"> / 100</span>
            ) : null}
          </p>
        </>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">Not enough data</p>
      )}
    </div>
  );
}

function LeaderboardPanel({
  title,
  rows,
}: {
  title: string;
  rows: PerformanceRankRow[];
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-3.5 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {!rows.length ? (
        <p className="mt-2 text-xs text-muted-foreground">Not enough data</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {rows.map((row, i) => (
            <li key={row.id} className="flex items-start justify-between gap-2 text-xs">
              <div className="min-w-0">
                <p className="font-medium text-foreground">
                  {i + 1}. {row.name}
                </p>
                <p className="tabular-nums text-muted-foreground">
                  {row.performance_score !== null ? `${row.performance_score} / 100` : "—"}
                  {row.change !== null ? (
                    <span
                      className={cn(
                        "ml-1.5",
                        row.change > 0 && "text-accent-green",
                        row.change < 0 && "text-destructive",
                      )}
                    >
                      {changeLabel(row.change)}
                    </span>
                  ) : null}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PerformanceBarChart({
  rows,
  kpiIds,
  mode,
  onSelect,
  selectedId,
}: {
  rows: PerformanceRankRow[];
  kpiIds: AuditKpiId[];
  mode: PerformanceMode;
  onSelect: (row: PerformanceRankRow) => void;
  selectedId: string | null;
}) {
  const maxScore = Math.max(...rows.map((r) => r.performance_score ?? 0), 1);

  return (
    <div className="space-y-2">
      {rows.map((row) => {
        const score = row.performance_score;
        const width = score !== null ? Math.max(4, (score / maxScore) * 100) : 0;
        const isSelected = selectedId === row.id;
        return (
          <TooltipProvider key={row.id} delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => onSelect(row)}
                  className={cn(
                    "group grid w-full grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors",
                    isSelected ? "bg-brand-soft/40" : "hover:bg-brand-soft/25",
                  )}
                >
                  <span className="truncate text-xs font-medium text-foreground">{row.name}</span>
                  <div className="h-2 overflow-hidden rounded-full bg-muted/40">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        mode === "best" ? "bg-brand" : "bg-brand/70",
                        isSelected && "bg-brand",
                      )}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                  <span className="min-w-[2rem] text-right text-xs font-semibold tabular-nums text-brand">
                    {score !== null ? score : "—"}
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs rounded-xl p-3 text-xs">
                <p className="font-semibold text-foreground">{row.name}</p>
                <p className="mt-1 tabular-nums">
                  Performance Score{" "}
                  <span className="font-semibold text-brand">
                    {score !== null ? `${score}/100` : "Not enough data"}
                  </span>
                </p>
                <div className="mt-2 space-y-0.5 text-muted-foreground">
                  {kpiIds.map((kpiId) => {
                    const v = row.kpis[kpiId];
                    return (
                      <p key={kpiId}>
                        {KPI_DASHBOARD_LABELS[kpiId]}{" "}
                        {v !== null && v !== undefined ? `${Math.round(v)}%` : "—"}
                      </p>
                    );
                  })}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      })}
    </div>
  );
}

function buildSummaryCards(
  rankBy: PerformanceRankDimension,
  rankings: WorkspaceDashboardData["performance_rankings"],
): Array<{ label: string; row: PerformanceRankRow | null }> {
  const pick = (dim: PerformanceRankDimension, desc: boolean) => {
    const rows = [...rankings.by_dimension[dim]]
      .filter((r) => r.performance_score !== null)
      .sort((a, b) =>
        desc
          ? (b.performance_score ?? 0) - (a.performance_score ?? 0)
          : (a.performance_score ?? 0) - (b.performance_score ?? 0),
      );
    return rows[0] ?? null;
  };

  if (rankBy === "city") {
    return [
      { label: "Top City", row: pick("city", true) },
      { label: "Lowest City", row: pick("city", false) },
      { label: "Best Category", row: pick("category", true) },
      { label: "Top Team Member", row: pick("team_member", true) },
    ];
  }
  if (rankBy === "team_member") {
    return [
      { label: "Top Team Member", row: pick("team_member", true) },
      { label: "Lowest Team Member", row: pick("team_member", false) },
      { label: "Top Store", row: pick("store", true) },
      { label: "Best Category", row: pick("category", true) },
    ];
  }
  if (rankBy === "store") {
    return [
      { label: "Top Store", row: pick("store", true) },
      { label: "Lowest Store", row: pick("store", false) },
      { label: "Best City", row: pick("city", true) },
      { label: "Best Category", row: pick("category", true) },
    ];
  }
  if (rankBy === "category" || rankBy === "sub_category") {
    const dim = rankBy;
    return [
      { label: rankBy === "category" ? "Best Category" : "Top Sub-category", row: pick(dim, true) },
      { label: rankBy === "category" ? "Lowest Category" : "Lowest Sub-category", row: pick(dim, false) },
      { label: "Top Store", row: pick("store", true) },
      { label: "Top Team Member", row: pick("team_member", true) },
    ];
  }
  return [
    { label: "Top Store", row: pick("store", true) },
    { label: "Best City", row: pick("city", true) },
    { label: "Best Category", row: pick("category", true) },
    { label: "Top Team Member", row: pick("team_member", true) },
  ];
}

function applyRowToFilters(
  filters: DashboardFilterState,
  row: PerformanceRankRow,
): DashboardFilterState {
  const next = { ...filters };
  if (row.filter.store_id) next.storeId = row.filter.store_id;
  if (row.filter.country) {
    next.country = row.filter.country;
    next.city = "all";
    next.storeId = "all";
  }
  if (row.filter.city) {
    next.city = row.filter.city;
    next.storeId = "all";
  }
  if (row.filter.category) {
    next.category = row.filter.category;
    next.subCategory = "all";
  }
  if (row.filter.sub_category) next.subCategory = row.filter.sub_category;
  if (row.filter.team_member_id) {
    next.teamMemberId = row.filter.team_member_id;
    next.auditAssignment = "all";
  }
  return next;
}

export function StoreTeamPerformanceSection({
  data,
  filters,
  onFiltersChange,
}: {
  data: WorkspaceDashboardData;
  filters: DashboardFilterState;
  onFiltersChange: (next: DashboardFilterState) => void;
}) {
  const [rankBy, setRankBy] = useState<PerformanceRankDimension>("store");
  const [mode, setMode] = useState<PerformanceMode>("best");
  const [sortReverse, setSortReverse] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const rankings = data.performance_rankings;
  const kpiIds = rankings.role_kpi_ids;

  const rawRows = rankings.by_dimension[rankBy] ?? [];
  const hasScores = rawRows.some((r) => r.performance_score !== null);

  const sortedRows = useMemo(
    () => sortRows(rawRows.filter((r) => r.performance_score !== null), mode, sortReverse),
    [rawRows, mode, sortReverse],
  );

  const summaryCards = useMemo(
    () => buildSummaryCards(rankBy, rankings),
    [rankBy, rankings],
  );

  const topPerformers = sortedRows.slice(0, 3);
  const needsAttention = useMemo(() => {
    const asc = sortRows(rawRows.filter((r) => r.performance_score !== null), "attention", false);
    return asc.slice(0, 3);
  }, [rawRows]);

  const weightText = rankings.score_weights
    .map((w) => `${w.label} ${w.weight_percent}%`)
    .join(" · ");

  if (!rawRows.length || !hasScores) {
    return (
      <section className="mt-8">
        <div className="mb-4">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Store & team performance
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Compare execution across stores, locations, categories and team members.
          </p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
          <EmptyState
            title="Not enough data"
            description="Complete more audits to compare performance."
          />
        </div>
      </section>
    );
  }

  return (
    <section className="mt-8">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Store & team performance
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Compare execution across stores, locations, categories and team members.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 rounded-lg border-border/60 text-xs"
          onClick={() => exportPerformanceRankingsCsv(sortedRows, rankBy, kpiIds)}
        >
          <Download className="size-3.5" />
          Download CSV
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <SummaryCard key={card.label} label={card.label} row={card.row} />
        ))}
      </div>

      <div className="mt-4 rounded-2xl border border-border/60 bg-card shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-border/40 p-3 sm:p-4">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">Rank by</span>
            <Select value={rankBy} onValueChange={(v) => setRankBy(v as PerformanceRankDimension)}>
              <SelectTrigger className="h-8 w-[140px] rounded-lg text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DIMENSION_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex rounded-lg border border-border/60 p-0.5">
            <button
              type="button"
              onClick={() => setMode("best")}
              className={cn(
                "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                mode === "best" ? "bg-brand text-white" : "text-muted-foreground hover:text-foreground",
              )}
            >
              Best Performing
            </button>
            <button
              type="button"
              onClick={() => setMode("attention")}
              className={cn(
                "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                mode === "attention"
                  ? "bg-brand text-white"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Needs Attention
            </button>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="size-8 rounded-lg"
            onClick={() => setSortReverse((v) => !v)}
            aria-label="Reverse sort order"
          >
            {sortReverse ? <ArrowUp className="size-4" /> : <ArrowDown className="size-4" />}
          </Button>

          <div className="ml-auto flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground">Performance Score</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="text-muted-foreground hover:text-brand" aria-label="Score info">
                    <HelpCircle className="size-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs rounded-xl text-xs">
                  <p>
                    Combined score across the five KPI measures used for this role. It is calculated
                    from the selected audit data and configured KPI scoring rules.
                  </p>
                  <p className="mt-2 font-medium">How is this calculated?</p>
                  <p className="mt-1 text-muted-foreground">{weightText}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        <div className="grid gap-4 p-4 lg:grid-cols-[1fr_minmax(0,220px)_minmax(0,220px)]">
          <div>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {DIMENSION_OPTIONS.find((o) => o.value === rankBy)?.label} performance
            </p>
            <PerformanceBarChart
              rows={sortedRows.slice(0, 12)}
              kpiIds={kpiIds}
              mode={mode}
              selectedId={selectedId}
              onSelect={(row) => {
                setSelectedId(row.id);
                onFiltersChange(applyRowToFilters(filters, row));
              }}
            />
          </div>
          <LeaderboardPanel title="Top performers" rows={topPerformers} />
          <LeaderboardPanel title="Needs attention" rows={needsAttention} />
        </div>
      </div>
    </section>
  );
}
