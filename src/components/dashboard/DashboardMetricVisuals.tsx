import { AISLIX } from "@/lib/aislix-theme";
import { AISLIX_PALETTE, CHART_SERIES } from "@/lib/ai-audit/kpi-palette";
import { MpDonut } from "@/components/control-tower/MpCharts";

const PALETTE = CHART_SERIES.slice(0, 5);
const DONUT_MAX_SLICES = 5;

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function Unavailable() {
  return <p className="text-sm text-[#667085]">Data unavailable</p>;
}

function RankBarList({
  rows,
  unit = "",
  max,
  colorAt,
  limit = 5,
}: {
  rows: { label: string; value: number; context?: string }[];
  unit?: string;
  max?: number;
  colorAt: (index: number) => string;
  limit?: number;
}) {
  const top = rows.slice(0, limit);
  if (!top.length) return <Unavailable />;
  const ceiling = max ?? Math.max(...top.map((r) => r.value), 1);
  return (
    <ul className="space-y-3">
      {top.map((row, i) => (
        <li key={`${row.label}-${i}`}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-medium text-[#102A43]" title={row.label}>
              <span className="mr-2 text-xs text-[#667085]">#{i + 1}</span>
              {row.label}
            </span>
            <span className="shrink-0 tabular-nums font-semibold text-[#102A43]">
              {round1(row.value)}
              {unit}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full border border-[#D9E2E8] bg-white">
            <div
              className="h-full rounded-full transition-[width] duration-200"
              style={{
                width: `${Math.min(100, Math.max(0, (row.value / ceiling) * 100))}%`,
                background: colorAt(i),
                boxShadow: "inset 0 0 0 1px rgba(16, 42, 67, 0.18)",
              }}
            />
          </div>
          {row.context ? <p className="mt-1 text-[11px] text-[#667085]">{row.context}</p> : null}
        </li>
      ))}
    </ul>
  );
}

/** Ranked share list (brands, stores) — horizontal bars, 0–100%. */
export function BrandShareMultiRing({
  rows,
  colorAt = (i: number) => PALETTE[i % PALETTE.length]!,
}: {
  rows: { label: string; value: number }[];
  colorAt?: (index: number) => string;
}) {
  return <RankBarList rows={rows} unit="%" max={100} colorAt={colorAt} />;
}

export function CategoryShareDonut({
  rows,
}: {
  rows: { label: string; value: number }[];
}) {
  if (!rows.length) return <Unavailable />;
  const sorted = [...rows].sort((a, b) => b.value - a.value);
  const head =
    sorted.length > DONUT_MAX_SLICES ? sorted.slice(0, DONUT_MAX_SLICES - 1) : sorted;
  const rest = sorted.slice(head.length);
  const slices = head.map((r, i) => ({
    label: r.label,
    value: round1(r.value),
    color: PALETTE[i % PALETTE.length]!,
  }));
  if (rest.length) {
    slices.push({
      label: "Other",
      value: round1(rest.reduce((sum, r) => sum + r.value, 0)),
      color: AISLIX_PALETTE.grey,
    });
  }
  const total = Math.round(slices.reduce((s, x) => s + x.value, 0));
  return <MpDonut slices={slices} total={total} totalLabel="%" size={140} />;
}

export function ProductRankingCards({
  rows,
}: {
  rows: { label: string; value: number }[];
}) {
  return (
    <RankBarList rows={rows} limit={6} colorAt={(i) => PALETTE[i % PALETTE.length]!} />
  );
}

export function PerformanceLeaderboard({
  rows,
  tone,
}: {
  rows: {
    storeName: string;
    score: number;
  }[];
  tone: "high" | "low";
}) {
  const color = tone === "high" ? AISLIX_PALETTE.green : AISLIX_PALETTE.pink;
  return (
    <RankBarList
      rows={rows.map((r) => ({ label: r.storeName, value: r.score }))}
      max={100}
      colorAt={() => color}
    />
  );
}

export const SUGGESTION_CHIP_PALETTE = [
  { bg: AISLIX.localBg, border: AISLIX.localBorder },
  { bg: AISLIX.supermarketBg, border: AISLIX.supermarketBorder },
  { bg: AISLIX.darkstoreBg, border: AISLIX.darkstoreBorder },
  { bg: AISLIX.warehouseBg, border: AISLIX.warehouseBorder },
  { bg: AISLIX.accentBg, border: AISLIX.accentBorder },
] as const;

export function chipStyle(index: number) {
  const p = SUGGESTION_CHIP_PALETTE[index % SUGGESTION_CHIP_PALETTE.length]!;
  return {
    backgroundColor: p.bg,
    borderColor: p.border,
    color: AISLIX.primary,
  };
}
