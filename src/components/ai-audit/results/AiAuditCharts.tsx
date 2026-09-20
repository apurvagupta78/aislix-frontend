import { MpRankBars, type MpBarDatum } from "@/components/control-tower/MpCharts";
import { CHART_ACCENT } from "@/lib/ai-audit/kpi-palette";

const COLORS = [
  CHART_ACCENT.brandFacingShare,
  CHART_ACCENT.categoryFacingShare,
  CHART_ACCENT.rankByFacings,
  CHART_ACCENT.rankByUnits,
  CHART_ACCENT.aiConfidence,
  CHART_ACCENT.financialOos,
];

export function AiGroupedComparisonBars({
  items,
  unit = "",
  accent,
}: {
  items: Array<{ label: string; expected: number; actual: number | null }>;
  unit?: string;
  accent?: string;
}) {
  const max = Math.max(
    ...items.flatMap((i) => [i.expected, i.actual ?? 0]),
    1,
  );
  return (
    <ul className="space-y-3">
      {items.map((item, i) => {
        const color = accent ?? COLORS[i % COLORS.length]!;
        const actualLabel = item.actual == null ? "—" : `${item.actual}${unit}`;
        const actualWidth = item.actual == null ? 0 : (item.actual / max) * 100;
        return (
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
                      background: color,
                      opacity: 0.45,
                    }}
                  />
                </div>
                <span className="w-10 tabular-nums text-right">
                  {item.expected}
                  {unit}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <span className="w-14 text-muted-foreground">Actual</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${actualWidth}%`,
                      background: color,
                    }}
                  />
                </div>
                <span className="w-10 tabular-nums text-right">{actualLabel}</span>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function AiShareComparisonBars({
  items,
  accent,
}: {
  items: Array<{ label: string; expected: number; actual: number; variancePp: number }>;
  accent?: string;
}) {
  const data: MpBarDatum[] = items.map((item) => ({
    label: `${item.label} (${item.variancePp >= 0 ? "+" : ""}${item.variancePp.toFixed(1)}pp)`,
    value: Math.abs(item.actual),
    color: item.variancePp >= 0 ? CHART_ACCENT.brandFacingShare : CHART_ACCENT.financialOos,
  }));
  return (
    <div className="space-y-4">
      <AiGroupedComparisonBars
        items={items.map((i) => ({ label: i.label, expected: i.expected, actual: i.actual }))}
        unit="%"
        accent={accent ?? CHART_ACCENT.brandFacingShare}
      />
      <MpRankBars data={data} unit="%" />
    </div>
  );
}

export function AiVarianceBars({
  items,
  unit = "",
  accent,
}: {
  items: Array<{ label: string; variance: number }>;
  unit?: string;
  accent?: string;
}) {
  const data: MpBarDatum[] = items.map((item) => ({
    label: item.label,
    value: Math.abs(item.variance),
    color:
      item.variance === 0
        ? CHART_ACCENT.brandFacingShare
        : item.variance < 0
          ? CHART_ACCENT.financialOos
          : accent ?? CHART_ACCENT.rankByUnits,
  }));
  return <MpRankBars data={data} unit={unit} />;
}

export function statusDonutSlices(counts: Record<string, number>) {
  const palette = [
    CHART_ACCENT.brandFacingShare,
    CHART_ACCENT.categoryFacingShare,
    CHART_ACCENT.financialOos,
    CHART_ACCENT.rankByUnits,
    CHART_ACCENT.rankByFacings,
    CHART_ACCENT.aiConfidence,
  ];
  return Object.entries(counts)
    .filter(([, v]) => v > 0)
    .map(([label, value], i) => ({
      label,
      value,
      color: palette[i % palette.length]!,
    }));
}

export { COLORS as AI_CHART_COLORS };
