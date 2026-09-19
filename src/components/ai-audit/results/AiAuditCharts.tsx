import { MpRankBars, type MpBarDatum } from "@/components/control-tower/MpCharts";

const COLORS = ["#AEDEF9", "#86EFAC", "#FCD34D", "#FCA5A5", "#C4B5FD", "#F9A8D4"];

export function AiGroupedComparisonBars({
  items,
  unit = "",
}: {
  items: Array<{ label: string; expected: number; actual: number }>;
  unit?: string;
}) {
  const max = Math.max(...items.flatMap((i) => [i.expected, i.actual]), 1);
  return (
    <ul className="space-y-3">
      {items.map((item, i) => (
        <li key={item.label}>
          <p className="mb-1 truncate text-[12px] font-medium text-foreground">{item.label}</p>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-[11px]">
              <span className="w-14 text-muted-foreground">Expected</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(item.expected / max) * 100}%`,
                    background: COLORS[i % COLORS.length],
                    opacity: 0.45,
                  }}
                />
              </div>
              <span className="w-10 tabular-nums text-right">{item.expected}{unit}</span>
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              <span className="w-14 text-muted-foreground">Actual</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(item.actual / max) * 100}%`,
                    background: COLORS[i % COLORS.length],
                  }}
                />
              </div>
              <span className="w-10 tabular-nums text-right">{item.actual}{unit}</span>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function AiShareComparisonBars({
  items,
}: {
  items: Array<{ label: string; expected: number; actual: number; variancePp: number }>;
}) {
  const data: MpBarDatum[] = items.map((item, i) => ({
    label: `${item.label} (${item.variancePp >= 0 ? "+" : ""}${item.variancePp.toFixed(1)}pp)`,
    value: Math.abs(item.actual),
    color: item.variancePp >= 0 ? "#86EFAC" : "#FCA5A5",
  }));
  return (
    <div className="space-y-4">
      <AiGroupedComparisonBars
        items={items.map((i) => ({ label: i.label, expected: i.expected, actual: i.actual }))}
        unit="%"
      />
      <MpRankBars data={data} unit="%" />
    </div>
  );
}

export function AiVarianceBars({
  items,
  unit = "",
}: {
  items: Array<{ label: string; variance: number }>;
  unit?: string;
}) {
  const data: MpBarDatum[] = items.map((item) => ({
    label: item.label,
    value: Math.abs(item.variance),
    color: item.variance === 0 ? "#86EFAC" : item.variance < 0 ? "#FCA5A5" : "#AEDEF9",
  }));
  return <MpRankBars data={data} unit={unit} />;
}

export function statusDonutSlices(counts: Record<string, number>) {
  const palette = ["#86EFAC", "#FCD34D", "#FCA5A5", "#AEDEF9", "#C4B5FD", "#F9A8D4"];
  return Object.entries(counts)
    .filter(([, v]) => v > 0)
    .map(([label, value], i) => ({
      label,
      value,
      color: palette[i % palette.length]!,
    }));
}

export { COLORS as AI_CHART_COLORS };
