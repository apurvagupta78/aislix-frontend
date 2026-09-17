import { cn } from "@/lib/utils";

export interface MpBarDatum {
  label: string;
  value: number;
  color?: string;
}

export interface MpDonutSlice {
  label: string;
  value: number;
  color: string;
}

export function MpRadialGauge({
  value,
  label,
  sublabel,
  color = "#AEDEF9",
  size = 168,
}: {
  value: number;
  label: string;
  sublabel?: string;
  color?: string;
  size?: number;
}) {
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const sweep = 0.75;
  const dash = circumference * sweep * (Math.min(Math.max(value, 0), 100) / 100);

  return (
    <div className="flex flex-col items-center">
      <div className="relative overflow-hidden" style={{ width: size, height: size * 0.8 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block">
          <g transform={`rotate(135 ${size / 2} ${size / 2})`}>
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="#E7EDF0"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${circumference * sweep} ${circumference}`}
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circumference}`}
            />
          </g>
        </svg>
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center">
          <p className="font-display text-[34px] font-semibold leading-none text-navy">{value}%</p>
          <p className="mt-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-mp-muted">{label}</p>
        </div>
      </div>
      {sublabel ? <p className="-mt-1 text-[13px] text-mp-muted">{sublabel}</p> : null}
    </div>
  );
}

export function MpDonut({
  slices,
  total,
  totalLabel,
  size = 148,
}: {
  slices: MpDonutSlice[];
  total: number;
  totalLabel: string;
  size?: number;
}) {
  const stroke = 16;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const sum = slices.reduce((acc, slice) => acc + slice.value, 0) || 1;
  let offset = 0;

  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            {slices.map((slice) => {
              const length = (slice.value / sum) * circumference;
              const element = (
                <circle
                  key={slice.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={slice.color}
                  strokeWidth={stroke}
                  strokeDasharray={`${length} ${circumference - length}`}
                  strokeDashoffset={-offset}
                />
              );
              offset += length;
              return element;
            })}
          </g>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-2xl font-semibold text-navy">{total}</span>
          <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-mp-muted">{totalLabel}</span>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-2">
        {slices.map((slice) => (
          <li key={slice.label} className="flex items-center gap-2.5 text-[13px]">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 shrink-0 rounded-sm ring-1 ring-inset ring-navy/10"
              style={{ background: slice.color }}
            />
            <span className="truncate text-mp-muted">{slice.label}</span>
            <span className="ml-auto font-semibold text-navy">{slice.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MpRankBars({ data, max, unit = "" }: { data: MpBarDatum[]; max?: number; unit?: string }) {
  const ceiling = max ?? Math.max(...data.map((item) => item.value), 1);
  return (
    <ul className="space-y-3">
      {data.map((item) => (
        <li key={item.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
            <span className="truncate text-navy">{item.label}</span>
            <span className="font-semibold tabular-nums text-navy">
              {item.value}
              {unit}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface">
            <div
              className="h-full rounded-full transition-[width] duration-200"
              style={{
                width: `${(item.value / ceiling) * 100}%`,
                background: item.color ?? "#AEDEF9",
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function MpColumnTrend({
  data,
  height = 140,
  goal,
}: {
  data: MpBarDatum[];
  height?: number;
  goal?: number;
}) {
  const ceiling = Math.max(...data.map((item) => item.value), goal ?? 0, 1);
  return (
    <div>
      <div className="relative flex items-end gap-2" style={{ height }}>
        {goal !== undefined ? (
          <div
            className="pointer-events-none absolute inset-x-0 border-t border-dashed border-market-line"
            style={{ bottom: `${(goal / ceiling) * 100}%` }}
          >
            <span className="absolute -top-5 right-0 rounded-full border border-market-line bg-market-bg px-2 py-0.5 text-[10px] font-bold text-navy">
              Goal {goal}%
            </span>
          </div>
        ) : null}
        {data.map((item) => (
          <div key={item.label} className="flex h-full flex-1 flex-col justify-end">
            <div
              className="w-full rounded-t-md border-b-0"
              style={{
                height: `${(item.value / ceiling) * 100}%`,
                background: item.color ?? "#CFEEFF",
                borderTop: "2px solid #AEDEF9",
              }}
              title={`${item.label}: ${item.value}%`}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        {data.map((item) => (
          <span key={item.label} className="flex-1 text-center text-[11px] text-mp-muted">
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

const tileTone: Record<string, string> = {
  active: "bg-warehouse-bg border-warehouse-line",
  healthy: "bg-market-bg border-market-line",
  attention: "bg-dark-bg border-dark-line",
  neutral: "bg-neutral-bg border-neutral-line",
};

export function MpTileGrid({
  tiles,
}: {
  tiles: Array<{ label: string; value: string; tone: "active" | "healthy" | "attention" | "neutral" }>;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-6">
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className={cn("rounded-lg border px-2.5 py-2", tileTone[tile.tone])}
          title={`${tile.label}: ${tile.value}`}
        >
          <p className="font-display text-[15px] font-semibold leading-none text-navy">{tile.value}</p>
          <p className="mt-1 truncate text-[10px] font-medium text-mp-muted">{tile.label}</p>
        </div>
      ))}
    </div>
  );
}
