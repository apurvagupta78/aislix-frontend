import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3 } from "lucide-react";
import { EmptyState, Skeleton } from "@/components/States";
import { ResultSection } from "@/components/scan-results/ResultParts";
import type { BrandShare, CategorySlice, ConfidenceBucket } from "@/lib/scan-results";

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
  data?: BrandShare[];
  loading?: boolean;
}) {
  const rows = data ?? [];
  return (
    <ChartFrame
      title="Top brands by shelf share"
      description="Share of visible facings per brand."
      loading={loading}
      empty={rows.length === 0}
      emptyText="Brand shelf share appears here once the scan service returns it."
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
  data?: ConfidenceBucket[];
  loading?: boolean;
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
  data?: CategorySlice[];
  loading?: boolean;
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
