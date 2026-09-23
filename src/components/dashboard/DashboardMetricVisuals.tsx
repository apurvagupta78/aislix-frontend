import { AISLIX } from "@/lib/aislix-theme";
import { MpDonut, MpRadialGauge } from "@/components/control-tower/MpCharts";

const PALETTE = [
  AISLIX.localBorder,
  AISLIX.supermarketBorder,
  AISLIX.darkstoreBorder,
  AISLIX.warehouseBorder,
  AISLIX.accentBorder,
] as const;

export function BrandShareMultiRing({
  rows,
}: {
  rows: { label: string; value: number }[];
}) {
  const top = rows.slice(0, 4);
  if (!top.length) {
    return <p className="text-sm text-[#667085]">Data unavailable</p>;
  }
  return (
    <div className="flex flex-wrap items-center justify-center gap-4">
      {top.map((row, i) => (
        <MpRadialGauge
          key={row.label}
          value={Math.round(row.value)}
          label={row.label.length > 10 ? `${row.label.slice(0, 10)}…` : row.label}
          color={PALETTE[i % PALETTE.length]}
          size={112}
        />
      ))}
    </div>
  );
}

export function CategoryShareDonut({
  rows,
}: {
  rows: { label: string; value: number }[];
}) {
  const slices = rows.slice(0, 5).map((r, i) => ({
    label: r.label,
    value: Math.round(r.value * 10) / 10,
    color: PALETTE[i % PALETTE.length]!,
  }));
  if (!slices.length) {
    return <p className="text-sm text-[#667085]">Data unavailable</p>;
  }
  const total = Math.round(slices.reduce((s, x) => s + x.value, 0));
  return <MpDonut slices={slices} total={total} totalLabel="%" size={140} />;
}

export function ProductRankingCards({
  rows,
}: {
  rows: { label: string; value: number }[];
}) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  if (!rows.length) {
    return <p className="text-sm text-[#667085]">Data unavailable</p>;
  }
  return (
    <ul className="space-y-2">
      {rows.slice(0, 6).map((row, i) => (
        <li
          key={row.label}
          className="rounded-xl border border-[#D9E2E8] bg-[#F4F7F9]/60 px-3 py-2"
        >
          <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
            <span className="truncate font-medium text-[#102A43]">
              <span className="mr-2 text-xs text-[#667085]">#{i + 1}</span>
              {row.label}
            </span>
            <span className="shrink-0 tabular-nums text-[#102A43]">
              {Math.round(row.value * 10) / 10}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white">
            <div
              className="h-full rounded-full transition-[width] duration-200"
              style={{
                width: `${(row.value / max) * 100}%`,
                background: PALETTE[i % PALETTE.length],
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function CircularComplianceScores({
  rows,
}: {
  rows: { storeName: string; compliancePct: number }[];
}) {
  if (!rows.length) {
    return <p className="text-sm text-[#667085]">Data unavailable</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {rows.map((row, i) => (
        <div key={row.storeName} className="flex justify-center">
          <MpRadialGauge
            value={Math.round(row.compliancePct)}
            label={row.storeName}
            color={i === 0 ? AISLIX.darkstoreBorder : PALETTE[i % PALETTE.length]}
            size={108}
          />
        </div>
      ))}
    </div>
  );
}

function MiniSparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = Math.max(max - min, 1);
  const w = 64;
  const h = 20;
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / span) * h;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} className="shrink-0 overflow-visible" aria-hidden>
      <polyline fill="none" stroke={color} strokeWidth="1.5" points={pts} />
    </svg>
  );
}

export function PerformanceLeaderboard({
  rows,
  tone,
}: {
  rows: {
    storeName: string;
    score: number;
    sparkline?: number[];
  }[];
  tone: "high" | "low";
}) {
  if (!rows.length) {
    return <p className="text-sm text-[#667085]">Data unavailable</p>;
  }
  const ringColor = tone === "high" ? AISLIX.supermarketBorder : AISLIX.darkstoreBorder;
  return (
    <ul className="space-y-3">
      {rows.slice(0, 5).map((row, i) => (
        <li
          key={row.storeName}
          className="flex items-center gap-3 rounded-xl border border-[#D9E2E8] bg-white px-2 py-1.5"
        >
          <div className="relative flex size-12 shrink-0 items-center justify-center">
            <svg width="48" height="48" viewBox="0 0 48 48" className="-rotate-90">
              <circle cx="24" cy="24" r="18" fill="none" stroke="#EEF1F4" strokeWidth="4" />
              <circle
                cx="24"
                cy="24"
                r="18"
                fill="none"
                stroke={ringColor}
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={`${(Math.min(100, Math.max(0, row.score)) / 100) * 113} 113`}
              />
            </svg>
            <span className="absolute text-[10px] font-bold tabular-nums text-[#102A43]">
              {Math.round(row.score)}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[#102A43]">
              <span className="mr-1 text-xs text-[#667085]">#{i + 1}</span>
              {row.storeName}
            </p>
            <p className="text-[11px] text-[#667085]">
              {tone === "high" ? "Highest audit performance" : "Needs attention"}
            </p>
          </div>
          <MiniSparkline
            values={row.sparkline ?? [row.score * 0.7, row.score * 0.85, row.score]}
            color={ringColor}
          />
        </li>
      ))}
    </ul>
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
