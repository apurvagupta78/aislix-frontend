import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3 } from "lucide-react";
import { EmptyState, Skeleton } from "@/components/States";
import { ResultSection } from "@/components/scan-results/ResultParts";
import { normalizeConfidence } from "@/lib/scan-results";
import type {
  BrandShare,
  CategorySlice,
  ConfidenceBucket,
  LowStockRow,
  QuantityBucket,
} from "@/lib/scan-results";

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--card)",
  color: "var(--foreground)",
  fontSize: 12,
} as const;

const axisProps = {
  tick: { fill: "var(--muted-foreground)", fontSize: 11 },
  stroke: "var(--border)",
} as const;

const sliceColors = [
  "var(--chart-2)",
  "var(--accent-green)",
  "var(--brand-muted)",
  "var(--brand-glow)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function ChartFrame({
  title,
  description,
  loading,
  empty,
  emptyText,
  children,
}: {
  title: string;
  description: string;
  loading?: boolean | undefined;
  empty: boolean;
  emptyText: string;
  children: React.ReactNode;
}) {
  return (
    <ResultSection title={title} description={description}>
      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : empty ? (
        <EmptyState icon={<BarChart3 className="size-5" />} title="No data yet" description={emptyText} />
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            {children as React.ReactElement}
          </ResponsiveContainer>
        </div>
      )}
    </ResultSection>
  );
}

export function TopBrandsChart({
  data,
  loading,
}: {
  data?: BrandShare[] | undefined;
  loading?: boolean | undefined;
}) {
  const rows = data ?? [];
  return (
    <ChartFrame
      title="Top brands by shelf share"
      description="Share of visible facings per brand."
      loading={loading}
      empty={rows.length === 0}
      emptyText="Brand shelf share appears here once the audit service returns it."
    >
      <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 16 }}>
        <CartesianGrid horizontal={false} stroke="var(--border)" />
        <XAxis type="number" unit="%" {...axisProps} />
        <YAxis type="category" dataKey="brand" width={92} {...axisProps} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v}%`, "Share"]} />
        <Bar dataKey="share" fill="var(--chart-2)" radius={[0, 8, 8, 0]} />
      </BarChart>
    </ChartFrame>
  );
}

export function ConfidenceDistributionChart({
  data,
  loading,
}: {
  data?: ConfidenceBucket[] | undefined;
  loading?: boolean | undefined;
}) {
  const rows = data ?? [];
  return (
    <ChartFrame
      title="Confidence distribution"
      description="Detections grouped by model confidence."
      loading={loading}
      empty={rows.length === 0}
      emptyText="Confidence buckets appear here once detections are returned."
    >
      <BarChart data={rows} margin={{ left: -12, right: 8 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="bucket" {...axisProps} />
        <YAxis allowDecimals={false} {...axisProps} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [v, "Detections"]} />
        <Bar dataKey="count" fill="var(--accent-green)" radius={[8, 8, 0, 0]} />
      </BarChart>
    </ChartFrame>
  );
}

export function CategoryDistributionChart({
  data,
  loading,
}: {
  data?: CategorySlice[] | undefined;
  loading?: boolean | undefined;
}) {
  const rows = data ?? [];
  return (
    <ChartFrame
      title="Product category distribution"
      description="Detected products split by category."
      loading={loading}
      empty={rows.length === 0}
      emptyText="Category distribution appears here once products are categorized."
    >
      <PieChart>
        <Pie
          data={rows}
          dataKey="count"
          nameKey="category"
          innerRadius={52}
          outerRadius={86}
          paddingAngle={2}
          isAnimationActive={false}
          stroke="var(--card)"
        >
          {rows.map((row, i) => (
            <Cell key={row.category} fill={sliceColors[i % sliceColors.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
      </PieChart>
    </ChartFrame>
  );
}

export function QuantityDistributionChart({
  data,
  loading,
}: {
  data?: QuantityBucket[] | undefined;
  loading?: boolean | undefined;
}) {
  const rows = data ?? [];
  return (
    <ChartFrame
      title="Product quantity distribution"
      description="Detected facings grouped by quantity band."
      loading={loading}
      empty={rows.length === 0}
      emptyText="Quantity bands appear here once the audit service returns inventory."
    >
      <BarChart data={rows} margin={{ left: -12, right: 8 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="bucket" {...axisProps} />
        <YAxis allowDecimals={false} {...axisProps} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [v, "Products"]} />
        <Bar dataKey="count" fill="var(--chart-2)" radius={[8, 8, 0, 0]} />
      </BarChart>
    </ChartFrame>
  );
}

export function LowStockSummaryChart({
  data,
  loading,
}: {
  data?: LowStockRow[] | undefined;
  loading?: boolean | undefined;
}) {
  const rows = data ?? [];
  return (
    <ChartFrame
      title="Low stock summary"
      description="Low and out-of-stock facings by brand or category."
      loading={loading}
      empty={rows.length === 0}
      emptyText="Low stock breakdown appears here once stock levels are returned."
    >
      <BarChart data={rows} margin={{ left: -12, right: 8 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" {...axisProps} />
        <YAxis allowDecimals={false} {...axisProps} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="low_stock" name="Low stock" stackId="s" fill="var(--chart-4)" radius={[0, 0, 0, 0]} />
        <Bar dataKey="out_of_stock" name="Out of stock" stackId="s" fill="var(--destructive)" radius={[8, 8, 0, 0]} />
      </BarChart>
    </ChartFrame>
  );
}

export function ShelfHealthChart({
  score,
  loading,
}: {
  score?: number | undefined;
  loading?: boolean | undefined;
}) {
  const value = typeof score === "number" && Number.isFinite(score) ? normalizeConfidence(score) : undefined;
  return (
    <ChartFrame
      title="Shelf health score"
      description="Composite of availability, compliance and detection confidence."
      loading={loading}
      empty={value === undefined}
      emptyText="The shelf health score appears here once the audit service returns it."
    >
      <RadialBarChart
        data={[{ name: "Shelf health", value: Math.round(value ?? 0), fill: "var(--accent-green)" }]}
        innerRadius="72%"
        outerRadius="102%"
        startAngle={210}
        endAngle={-30}
      >
        <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
        <RadialBar dataKey="value" cornerRadius={12} background={{ fill: "var(--muted)" }} />
        <text
          x="50%"
          y="52%"
          textAnchor="middle"
          className="fill-foreground text-3xl font-semibold tabular-nums"
        >
          {Math.round(value ?? 0)}
        </text>
        <text x="50%" y="66%" textAnchor="middle" className="fill-muted-foreground text-xs">
          out of 100
        </text>
      </RadialBarChart>
    </ChartFrame>
  );
}
