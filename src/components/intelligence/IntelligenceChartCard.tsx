import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AISLIX_PALETTE } from "@/lib/ai-audit/kpi-palette";
import type { IntelligenceChart, IntelligenceChartUnit } from "@/lib/intelligence/intelligence-charts";

const GRID = "#D9E2E8";
const AXIS = { fontSize: 11, fill: "#667085" };
/** Pale palette colours need an outline to read on white. */
const OUTLINE: Record<string, string> = {
  [AISLIX_PALETTE.pink]: "#ECBDCC",
  [AISLIX_PALETTE.grey]: "#D9E2E8",
};

const PREFERRED: Record<string, string> = {
  availability_by_audit: AISLIX_PALETTE.green,
  shelf_health_by_audit: AISLIX_PALETTE.purple,
  planogram_by_audit: AISLIX_PALETTE.green,
  availability_trend: AISLIX_PALETTE.purple,
  findings_by_type: AISLIX_PALETTE.blue,
  top_problem_products: AISLIX_PALETTE.purple,
  brand_facings: AISLIX_PALETTE.purple,
  variance_value_by_product: AISLIX_PALETTE.cyan,
};
const CYCLE = [AISLIX_PALETTE.purple, AISLIX_PALETTE.blue, AISLIX_PALETTE.green, AISLIX_PALETTE.cyan];

function isSingleSeries(chart: IntelligenceChart): boolean {
  return chart.type === "bar" || chart.type === "line";
}

/** Accent per chart in a 2-column grid: semantic colour first, never the same as the card beside or above. */
export function chartAccents(charts: IntelligenceChart[]): Array<string | null> {
  const out: Array<string | null> = [];
  charts.forEach((chart, i) => {
    if (!isSingleSeries(chart)) {
      out.push(null);
      return;
    }
    const neighbours = new Set([i % 2 === 1 ? out[i - 1] : null, out[i - 2]].filter(Boolean));
    const preferred = PREFERRED[chart.id] ?? CYCLE[0]!;
    out.push(neighbours.has(preferred) ? (CYCLE.find((c) => !neighbours.has(c)) ?? preferred) : preferred);
  });
  return out;
}

export function formatChartValue(value: number, unit: IntelligenceChartUnit): string {
  if (unit === "%") return `${value}%`;
  if (unit === "inr") {
    const abs = Math.abs(value).toLocaleString("en-IN", { maximumFractionDigits: 0 });
    return `${value < 0 ? "−" : ""}₹${abs}`;
  }
  if (unit === "facings") return `${value.toLocaleString("en-IN")} facing${value === 1 ? "" : "s"}`;
  return value.toLocaleString("en-IN");
}

/** Keeps the start and end of long names so product variants stay distinguishable. */
function shortTick(value: string): string {
  return value.length > 26 ? `${value.slice(0, 14).trimEnd()}…${value.slice(-11).trimStart()}` : value;
}

function CategoryTick({ x, y, payload }: { x?: number; y?: number; payload?: { value?: unknown } }) {
  const full = String(payload?.value ?? "");
  return (
    <text x={x} y={y} dy={4} textAnchor="end" fontSize={AXIS.fontSize} fill={AXIS.fill}>
      <title>{full}</title>
      {shortTick(full)}
    </text>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; payload?: Record<string, unknown> }>;
  label?: string;
  unit: IntelligenceChartUnit;
}) {
  if (!active || !payload?.length) return null;
  const title = label ?? String(payload[0]?.payload?.label ?? "");
  return (
    <div className="rounded-lg border border-[#D9E2E8] bg-white px-3 py-2 text-xs shadow-sm">
      <p className="font-medium text-[#04203F]">{title}</p>
      {payload.map((p, i) => (
        <p key={i} className="mt-0.5 text-[#667085]">
          {payload.length > 1 ? `${p.name}: ` : ""}
          <span className="font-medium tabular-nums text-[#04203F]">{formatChartValue(Number(p.value ?? 0), unit)}</span>
        </p>
      ))}
    </div>
  );
}

function ChartBody({ chart, accent }: { chart: IntelligenceChart; accent: string }) {
  const unit = chart.unit;
  const percentDomain: [number, number] | undefined = unit === "%" ? [0, 100] : undefined;

  if (chart.type === "line") {
    return (
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chart.data} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID} />
            <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} domain={percentDomain ?? ["auto", "auto"]} />
            <Tooltip content={<ChartTooltip unit={unit} />} />
            <Line
              type="monotone"
              dataKey="value"
              stroke={accent}
              strokeWidth={2}
              dot={{ r: 3, fill: accent }}
              animationDuration={250}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (chart.type === "donut") {
    const total = chart.data.reduce((s, d) => s + Number(d.value ?? 0), 0);
    return (
      <div className="flex flex-col items-center gap-4 sm:flex-row">
        <div className="relative size-40 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chart.data}
                dataKey="value"
                nameKey="label"
                innerRadius={48}
                outerRadius={72}
                paddingAngle={2}
                animationDuration={250}
              >
                {chart.series.map((s) => (
                  <Cell key={s.key} fill={s.color} stroke={OUTLINE[s.color] ?? s.color} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip unit={unit} />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-semibold tabular-nums text-[#04203F]">{total}</span>
            <span className="text-[11px] text-[#667085]">findings</span>
          </div>
        </div>
        <ul className="w-full space-y-1.5 text-sm">
          {chart.series.map((s, i) => (
            <li key={s.key} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-[#667085]">
                <span
                  aria-hidden
                  className="size-2 rounded-full"
                  style={{ background: s.color, boxShadow: OUTLINE[s.color] ? `0 0 0 1px ${OUTLINE[s.color]}` : undefined }}
                />
                {s.label}
              </span>
              <span className="font-medium tabular-nums text-[#04203F]">{Number(chart.data[i]?.value ?? 0)}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const height = Math.max(96, chart.data.length * 34 + 36);
  const stacked = chart.type === "stacked_bar";
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chart.data}
          layout="vertical"
          margin={{ top: 4, right: 16, bottom: 0, left: 4 }}
          barCategoryGap={8}
          maxBarSize={26}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={GRID} />
          <XAxis
            type="number"
            tick={AXIS}
            tickLine={false}
            axisLine={{ stroke: GRID }}
            allowDecimals={unit !== "count" && unit !== "facings"}
            domain={percentDomain}
            tickFormatter={(v: number) => (unit === "inr" ? formatChartValue(v, unit) : String(v))}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={160}
            tick={<CategoryTick />}
            tickLine={false}
            axisLine={false}
            interval={0}
          />
          <Tooltip cursor={{ fill: "#F4F7F9" }} content={<ChartTooltip unit={unit} />} />
          {stacked ? (
            chart.series.map((s) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                stackId="stack"
                fill={s.color}
                stroke={OUTLINE[s.color]}
                animationDuration={250}
              />
            ))
          ) : (
            <Bar dataKey="value" name={chart.series[0]?.label} fill={accent} radius={[0, 4, 4, 0]} animationDuration={250} />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function IntelligenceChartCard({ chart, accent }: { chart: IntelligenceChart; accent: string | null }) {
  const dot = accent ?? chart.series[0]?.color ?? AISLIX_PALETTE.blue;
  return (
    <figure className="min-w-0 rounded-xl border border-[#D9E2E8] bg-white p-4 sm:p-5">
      <figcaption>
        <p className="flex items-center gap-2 text-sm font-semibold text-[#04203F]">
          <span
            aria-hidden
            className="size-1.5 shrink-0 rounded-full"
            style={{ background: dot, boxShadow: OUTLINE[dot] ? `0 0 0 1px ${OUTLINE[dot]}` : undefined }}
          />
          {chart.title}
        </p>
        {chart.caption ? <p className="mt-1 text-sm text-[#667085]">{chart.caption}</p> : null}
      </figcaption>
      {chart.type === "stacked_bar" ? (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#667085]">
          {chart.series.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{ background: s.color, boxShadow: OUTLINE[s.color] ? `0 0 0 1px ${OUTLINE[s.color]}` : undefined }}
              />
              {s.label}
            </span>
          ))}
        </div>
      ) : null}
      <div className="mt-3">
        <ChartBody chart={chart} accent={accent ?? AISLIX_PALETTE.purple} />
      </div>
      <p className="mt-3 text-[11px] text-[#667085]">Drawn by Aislix from the selected audit data</p>
    </figure>
  );
}
